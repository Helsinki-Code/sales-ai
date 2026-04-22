import { z } from "zod";
import {
  ParallelApiError,
  ParallelClient,
  computeLeadScore,
  isRetryableParallelError,
  leadGradeFromScore,
  runPythonJsonCommand,
  type LeadV2Item,
  type SellerProfile
} from "@sales-ai/shared";
import { getEnv } from "./config.js";
import { logger } from "./logger.js";
import { supabaseAdmin } from "./supabase.js";

const env = getEnv();

const leadsInputSchema = z.object({
  url: z.string().url(),
  count: z.number().int().min(5).max(100)
});

const taskEnrichmentSchema = z.object({
  company_name: z.string().default(""),
  company_website: z.string().default(""),
  company_industry: z.string().default(""),
  company_size_employees: z.string().default(""),
  company_location: z.string().default(""),
  company_funding_total: z.string().default(""),
  company_funding_recent_date: z.string().default(""),
  company_linkedin: z.string().default(""),
  company_description: z.string().default(""),
  contact_name: z.string().default("Unknown"),
  contact_title: z.string().default(""),
  contact_email: z.string().default(""),
  contact_linkedin: z.string().default(""),
  contact_phone: z.string().default(""),
  email_confidence: z.enum(["confirmed", "pattern_derived", "unknown"]).default("unknown"),
  recent_funding_flag: z.boolean().default(false),
  recent_hiring_flag: z.boolean().default(false),
  tech_stack_match_flag: z.boolean().default(false),
  growth_signal_flag: z.boolean().default(false),
  tech_evidence: z.string().default(""),
  hiring_evidence: z.string().default(""),
  growth_evidence: z.string().default(""),
  fit_reason: z.string().default(""),
  enrichment_confidence: z.enum(["high", "medium", "low"]).default("medium")
});

export type LeadsEngineProgress = {
  stage: string;
  progress: number;
  message: string;
  metadata?: Record<string, unknown>;
};

export class LeadsEngineError extends Error {
  constructor(
    public readonly code:
      | "PARALLEL_AUTH_ERROR"
      | "PARALLEL_RATE_LIMITED"
      | "PARALLEL_TIMEOUT"
      | "PARALLEL_SCHEMA_INVALID"
      | "PARALLEL_UPSTREAM_ERROR"
      | "INSUFFICIENT_QUALIFIED_LEADS",
    message: string
  ) {
    super(message);
    this.name = "LeadsEngineError";
  }
}

type LeadsEngineRunInput = {
  jobId: string;
  orgId: string;
  workspaceId: string;
  input: Record<string, unknown>;
  onProgress: (progress: LeadsEngineProgress) => Promise<void>;
};

type LeadRunStats = {
  findallRunIds: string[];
  taskRunIds: string[];
  retryCount: number;
  parallelApiCalls: number;
  generatorUsed: string;
  matchedCandidates: number;
  dedupedCandidates: number;
  enrichedCandidates: number;
  filteredCandidates: number;
  qualifiedCandidates: number;
  evidenceCoverage: number;
};

type FindAllMatchCondition = { name: string; description: string };
type CompactBasisEntry = { field: string; value: string; citations: string[] };

const TASK_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    company_name: { type: "string", description: "Company legal/common name" },
    company_website: { type: "string", description: "Canonical company website URL" },
    company_industry: { type: "string", description: "Primary industry classification" },
    company_size_employees: { type: "string", description: "Employee range or estimate" },
    company_location: { type: "string", description: "Headquarters location" },
    company_funding_total: { type: "string", description: "Total funding amount if available" },
    company_funding_recent_date: { type: "string", description: "Most recent funding date or period" },
    company_linkedin: { type: "string", description: "LinkedIn company profile URL" },
    company_description: { type: "string", description: "One-line company description" },
    contact_name: { type: "string", description: "Best decision-maker contact name" },
    contact_title: { type: "string", description: "Decision-maker job title" },
    contact_email: { type: "string", description: "Decision-maker email if found" },
    contact_linkedin: { type: "string", description: "Decision-maker LinkedIn URL" },
    contact_phone: { type: "string", description: "Decision-maker phone number if found" },
    email_confidence: {
      type: "string",
      enum: ["confirmed", "pattern_derived", "unknown"],
      description: "Confidence level for contact email"
    },
    recent_funding_flag: { type: "boolean", description: "True if recent funding signal exists" },
    recent_hiring_flag: { type: "boolean", description: "True if active hiring signal exists" },
    tech_stack_match_flag: { type: "boolean", description: "True if tech stack overlap exists" },
    growth_signal_flag: { type: "boolean", description: "True if growth signal exists" },
    tech_evidence: { type: "string", description: "Evidence text for tech stack signal" },
    hiring_evidence: { type: "string", description: "Evidence text for hiring signal" },
    growth_evidence: { type: "string", description: "Evidence text for growth signal" },
    fit_reason: { type: "string", description: "One sentence fit explanation" },
    enrichment_confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Overall enrichment confidence"
    }
  },
  required: [
    "company_name",
    "company_website",
    "company_industry",
    "company_size_employees",
    "company_location",
    "company_funding_total",
    "company_funding_recent_date",
    "company_linkedin",
    "company_description",
    "contact_name",
    "contact_title",
    "contact_email",
    "contact_linkedin",
    "contact_phone",
    "email_confidence",
    "recent_funding_flag",
    "recent_hiring_flag",
    "tech_stack_match_flag",
    "growth_signal_flag",
    "tech_evidence",
    "hiring_evidence",
    "growth_evidence",
    "fit_reason",
    "enrichment_confidence"
  ],
  additionalProperties: false
};

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSellerProfile(raw: Record<string, unknown>): SellerProfile {
  const companyName =
    typeof raw.company_name === "string" && raw.company_name.trim().length > 0
      ? raw.company_name.trim()
      : "Unknown Company";

  const description =
    typeof raw.description === "string" && raw.description.trim().length > 0
      ? raw.description.trim()
      : "";

  const industries =
    Array.isArray(raw.industry_signals) && raw.industry_signals.every((item) => typeof item === "string")
      ? raw.industry_signals
      : [];

  const techStack =
    Array.isArray(raw.tech_stack) && raw.tech_stack.every((item) => typeof item === "string")
      ? raw.tech_stack
      : [];

  return {
    company_name: companyName,
    description,
    industries,
    company_size_signals:
      typeof raw.company_size_signals === "object" && raw.company_size_signals !== null
        ? (raw.company_size_signals as Record<string, unknown>)
        : {},
    has_job_postings: Boolean(raw.has_job_postings),
    tech_stack: techStack,
    social_links: typeof raw.social_links === "object" && raw.social_links !== null ? (raw.social_links as Record<string, unknown>) : {}
  };
}

function buildObjective(url: string, profile: SellerProfile, targetCount: number): string {
  const industries = profile.industries.length > 0 ? profile.industries.join(", ") : "B2B technology";
  const descriptor = profile.description.length > 0 ? profile.description : "sales-focused growth platform";
  return `FindAll ${targetCount * 3} companies likely to buy ${descriptor}. Prioritize industries: ${industries}. Seller URL: ${url}.`;
}

function buildFallbackMatchConditions(profile: SellerProfile): FindAllMatchCondition[] {
  const industryHint = profile.industries.length > 0 ? profile.industries.join(", ") : "B2B technology";
  return [
    {
      name: "industry_fit_check",
      description: `Company operates in or adjacent to ${industryHint}.`
    },
    {
      name: "growth_signal_check",
      description: "Company shows active growth signal such as hiring, funding, expansion, or product launch."
    },
    {
      name: "buyer_relevance_check",
      description: "Company likely has a sales, revops, or go-to-market function that can adopt external sales tooling."
    }
  ];
}

function extractDomain(input: string): string {
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return input.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]?.toLowerCase() ?? input;
  }
}

function summarizeEvidence(basis: unknown[]): { citationsCount: number; basisFields: string[]; sources: string[] } {
  const fields: string[] = [];
  const sources = new Set<string>();
  let citationsCount = 0;

  for (const row of basis) {
    if (!row || typeof row !== "object") continue;
    const field = "field" in row && typeof (row as { field?: unknown }).field === "string" ? (row as { field: string }).field : undefined;
    if (field) fields.push(field);
    if ("citations" in row && Array.isArray((row as { citations?: unknown[] }).citations)) {
      for (const citation of (row as { citations: unknown[] }).citations) {
        if (!citation || typeof citation !== "object") continue;
        citationsCount += 1;
        if ("url" in citation && typeof (citation as { url?: unknown }).url === "string") {
          sources.add((citation as { url: string }).url);
        }
      }
    }
  }

  return {
    citationsCount,
    basisFields: Array.from(new Set(fields)),
    sources: Array.from(sources).slice(0, 10)
  };
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function toCompactBasisEntries(basis: unknown[], maxEntries: number): CompactBasisEntry[] {
  const compact: CompactBasisEntry[] = [];

  for (const row of basis) {
    if (compact.length >= maxEntries) break;
    if (!row || typeof row !== "object") continue;

    const fieldRaw = "field" in row ? (row as { field?: unknown }).field : "";
    const field = typeof fieldRaw === "string" ? clampText(fieldRaw, 60) : "unknown";

    const valueRaw = "value" in row ? (row as { value?: unknown }).value : "";
    let value = "";
    if (typeof valueRaw === "string") value = valueRaw;
    else if (typeof valueRaw === "number" || typeof valueRaw === "boolean") value = String(valueRaw);
    else value = JSON.stringify(valueRaw ?? "");

    const citations: string[] = [];
    const rawCitations = "citations" in row ? (row as { citations?: unknown }).citations : [];
    if (Array.isArray(rawCitations)) {
      for (const citation of rawCitations) {
        if (citations.length >= 3) break;
        if (!citation || typeof citation !== "object") continue;
        const url = "url" in citation ? (citation as { url?: unknown }).url : "";
        if (typeof url === "string" && url.trim().length > 0) citations.push(clampText(url, 180));
      }
    }

    compact.push({
      field,
      value: clampText(value, 280),
      citations
    });
  }

  return compact;
}

function stringifySize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 999999;
  }
}

function buildTaskInput(
  candidate: {
    name: string;
    url: string;
    description: string;
    basis: unknown[];
  },
  sellerProfile: SellerProfile
): Record<string, unknown> {
  const basisCount = Array.isArray(candidate.basis) ? candidate.basis.length : 0;
  let basisEntries = toCompactBasisEntries(candidate.basis, 8);
  const sellerIndustries = sellerProfile.industries.slice(0, 8).map((item) => clampText(item, 80));
  let sellerTechStack = sellerProfile.tech_stack.slice(0, 10).map((item) => clampText(item, 80));
  let sellerDescription = clampText(sellerProfile.description || "", 700);
  let candidateDescription = clampText(candidate.description || "", 700);

  const makeInput = (): Record<string, unknown> => ({
    candidate_name: clampText(candidate.name || "", 180),
    candidate_url: clampText(candidate.url || "", 240),
    candidate_description: candidateDescription,
    candidate_basis_count: basisCount,
    candidate_basis_summary: basisEntries,
    seller_company: clampText(sellerProfile.company_name || "", 180),
    seller_description: sellerDescription,
    seller_industries: sellerIndustries,
    seller_tech_stack: sellerTechStack
  });

  let payload = makeInput();
  const maxChars = 11500;

  if (stringifySize(payload) > maxChars) {
    basisEntries = basisEntries.slice(0, 4);
    payload = makeInput();
  }
  if (stringifySize(payload) > maxChars) {
    basisEntries = basisEntries.slice(0, 2);
    payload = makeInput();
  }
  if (stringifySize(payload) > maxChars) {
    basisEntries = [];
    payload = makeInput();
  }
  if (stringifySize(payload) > maxChars) {
    candidateDescription = clampText(candidateDescription, 260);
    sellerDescription = clampText(sellerDescription, 260);
    payload = makeInput();
  }
  if (stringifySize(payload) > maxChars) {
    sellerTechStack = sellerTechStack.slice(0, 4);
    payload = makeInput();
  }

  return payload;
}

async function withParallelRetry<T>(
  label: string,
  stats: LeadRunStats,
  operation: () => Promise<T>
): Promise<T> {
  const maxAttempts = 3;
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await operation();
      if (attempt > 1) stats.retryCount += attempt - 1;
      return result;
    } catch (error) {
      lastError = error;
      const retryable = isRetryableParallelError(error);
      if (!retryable || attempt >= maxAttempts) break;
      const backoff = 1000 * Math.pow(2, attempt);
      logger.warn({ label, attempt, backoff, error }, "Parallel operation failed; retrying.");
      await sleep(backoff);
    }
  }

  if (lastError instanceof ParallelApiError) {
    throw new LeadsEngineError(lastError.code, `${label} failed: ${lastError.message}`);
  }

  if (lastError instanceof Error) {
    throw new LeadsEngineError("PARALLEL_UPSTREAM_ERROR", `${label} failed: ${lastError.message}`);
  }

  throw new LeadsEngineError("PARALLEL_UPSTREAM_ERROR", `${label} failed due to unknown error.`);
}

async function saveLeadRunSnapshot(
  jobId: string,
  orgId: string,
  workspaceId: string,
  stats: LeadRunStats,
  state: "running" | "complete" | "failed",
  durationMs: number,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  const payload = {
    job_id: jobId,
    org_id: orgId,
    workspace_id: workspaceId,
    status: state,
    generator_used: stats.generatorUsed,
    findall_run_ids: stats.findallRunIds,
    task_run_ids: stats.taskRunIds,
    retry_count: stats.retryCount,
    parallel_api_calls: stats.parallelApiCalls,
    matched_candidates: stats.matchedCandidates,
    deduped_candidates: stats.dedupedCandidates,
    enriched_candidates: stats.enrichedCandidates,
    filtered_candidates: stats.filteredCandidates,
    qualified_candidates: stats.qualifiedCandidates,
    evidence_coverage: stats.evidenceCoverage,
    duration_ms: durationMs,
    error_code: errorCode ?? null,
    error_message: errorMessage ?? null,
    updated_at: new Date().toISOString()
  };

  try {
    await supabaseAdmin.from("leads_runs").upsert(payload, { onConflict: "job_id" });
  } catch (error) {
    logger.warn({ jobId, error }, "Unable to persist leads run snapshot.");
  }
}

export async function runParallelLeadsEngine(input: LeadsEngineRunInput): Promise<{ leads: LeadV2Item[]; stats: LeadRunStats }> {
  const startedAt = Date.now();
  const parsedInput = leadsInputSchema.parse(input.input);
  const normalizedUrl = normalizeUrl(parsedInput.url);
  const requestedCount = parsedInput.count;

  if (!env.PARALLEL_API_KEY) {
    throw new LeadsEngineError("PARALLEL_AUTH_ERROR", "PARALLEL_API_KEY is not configured.");
  }

  const stats: LeadRunStats = {
    findallRunIds: [],
    taskRunIds: [],
    retryCount: 0,
    parallelApiCalls: 0,
    generatorUsed: env.PARALLEL_FINDALL_GENERATOR_DEFAULT,
    matchedCandidates: 0,
    dedupedCandidates: 0,
    enrichedCandidates: 0,
    filteredCandidates: 0,
    qualifiedCandidates: 0,
    evidenceCoverage: 0
  };

  await input.onProgress({
    stage: "normalize_input",
    progress: 8,
    message: "Validated leads input payload.",
    metadata: { requested_count: requestedCount, url: normalizedUrl }
  });

  const profileRaw = await runPythonJsonCommand<Record<string, unknown>>("analyze_prospect.py", {
    args: ["--url", normalizedUrl, "--output", "json"],
    timeoutMs: 120000
  });
  const sellerProfile = toSellerProfile(profileRaw);

  await input.onProgress({
    stage: "seller_profile",
    progress: 18,
    message: "Derived seller profile for ICP matching.",
    metadata: {
      seller_company: sellerProfile.company_name,
      seller_industries: sellerProfile.industries,
      seller_tech_stack_count: sellerProfile.tech_stack.length
    }
  });

  const client = new ParallelClient({
    apiKey: env.PARALLEL_API_KEY,
    baseUrl: env.PARALLEL_BASE_URL,
    timeoutMs: env.PARALLEL_TIMEOUT_MS,
    findAllBetaHeader: env.PARALLEL_FINDALL_BETA_HEADER
  });

  const runFindAll = async (generator: string): Promise<{
    findallId: string;
    matchedCandidates: Array<{ candidate_id: string; name: string; url: string; description: string; output: Record<string, unknown>; basis: unknown[] }>;
  }> => {
    const objective = buildObjective(normalizedUrl, sellerProfile, requestedCount);

    stats.parallelApiCalls += 1;
    const ingest = await withParallelRetry("findall_ingest", stats, () => client.ingestFindAll(objective));
    const matchConditions =
      ingest.match_conditions.length > 0
        ? ingest.match_conditions
        : buildFallbackMatchConditions(sellerProfile);

    const matchLimit = Math.min(Math.max(requestedCount * 3, 15), 250);

    stats.parallelApiCalls += 1;
    const created = await withParallelRetry("findall_run_create", stats, () =>
      client.createFindAllRun({
        objective: ingest.objective,
        entity_type: ingest.entity_type || "companies",
        match_conditions: matchConditions,
        generator,
        match_limit: matchLimit,
        metadata: {
          seller_domain: extractDomain(normalizedUrl),
          job_id: input.jobId
        }
      })
    );

    stats.findallRunIds.push(created.findall_id);

    const pollStart = Date.now();
    const maxPollMs = 8 * 60 * 1000;
    let pollStatus = "queued";
    while (Date.now() - pollStart < maxPollMs) {
      stats.parallelApiCalls += 1;
      const run = await withParallelRetry("findall_run_poll", stats, () => client.retrieveFindAllRun(created.findall_id));
      pollStatus = run.status.status;
      if (pollStatus === "completed") break;
      if (pollStatus === "failed" || pollStatus === "cancelled") {
        throw new LeadsEngineError("PARALLEL_UPSTREAM_ERROR", `FindAll run ${created.findall_id} ended with status ${pollStatus}.`);
      }
      await sleep(3000);
    }

    if (pollStatus !== "completed") {
      throw new LeadsEngineError("PARALLEL_TIMEOUT", `FindAll run ${created.findall_id} timed out.`);
    }

    stats.parallelApiCalls += 1;
    const result = await withParallelRetry("findall_result", stats, () => client.retrieveFindAllResult(created.findall_id));

    const matched = result.candidates
      .filter((candidate) => candidate.match_status === "matched")
      .map((candidate) => ({
        candidate_id: candidate.candidate_id,
        name: candidate.name,
        url: candidate.url,
        description: candidate.description,
        output: candidate.output ?? {},
        basis: candidate.basis ?? []
      }));

    return { findallId: created.findall_id, matchedCandidates: matched };
  };

  await input.onProgress({
    stage: "findall_discovery",
    progress: 30,
    message: `Starting FindAll discovery with generator ${env.PARALLEL_FINDALL_GENERATOR_DEFAULT}.`
  });

  const primaryRun = await runFindAll(env.PARALLEL_FINDALL_GENERATOR_DEFAULT);
  let workingCandidates = primaryRun.matchedCandidates;
  stats.generatorUsed = env.PARALLEL_FINDALL_GENERATOR_DEFAULT;

  if (
    workingCandidates.length < requestedCount &&
    env.PARALLEL_FINDALL_ESCALATION_GENERATOR &&
    env.PARALLEL_FINDALL_ESCALATION_GENERATOR !== env.PARALLEL_FINDALL_GENERATOR_DEFAULT
  ) {
    await input.onProgress({
      stage: "findall_discovery",
      progress: 38,
      message: `Escalating FindAll generator to ${env.PARALLEL_FINDALL_ESCALATION_GENERATOR}.`,
      metadata: {
        matched_candidates_primary: workingCandidates.length,
        requested_count: requestedCount
      }
    });

    const escalatedRun = await runFindAll(env.PARALLEL_FINDALL_ESCALATION_GENERATOR);
    workingCandidates = escalatedRun.matchedCandidates;
    stats.generatorUsed = env.PARALLEL_FINDALL_ESCALATION_GENERATOR;
  }

  stats.matchedCandidates = workingCandidates.length;

  const seenDomains = new Set<string>();
  const dedupedCandidates = workingCandidates.filter((candidate) => {
    const domain = extractDomain(candidate.url || candidate.name);
    if (!domain || seenDomains.has(domain)) return false;
    seenDomains.add(domain);
    return true;
  });
  stats.dedupedCandidates = dedupedCandidates.length;

  await input.onProgress({
    stage: "candidate_dedupe",
    progress: 46,
    message: "Deduplicated matched candidates.",
    metadata: {
      matched_candidates: stats.matchedCandidates,
      deduped_candidates: stats.dedupedCandidates
    }
  });

  const enrichmentCandidates = dedupedCandidates.slice(0, Math.min(dedupedCandidates.length, requestedCount * 2));
  const leads: LeadV2Item[] = [];
  const evidenceScores: number[] = [];

  const concurrency = 4;
  let activeIndex = 0;
  let completed = 0;

  const workers = Array.from({ length: Math.min(concurrency, enrichmentCandidates.length) }, async () => {
    while (activeIndex < enrichmentCandidates.length) {
      const currentIndex = activeIndex;
      activeIndex += 1;
      const candidate = enrichmentCandidates[currentIndex];
      if (!candidate) continue;

      const taskInput = buildTaskInput(
        {
          name: candidate.name,
          url: candidate.url,
          description: candidate.description,
          basis: candidate.basis
        },
        sellerProfile
      );

      stats.parallelApiCalls += 1;
      const taskRun = await withParallelRetry("task_run_create", stats, () =>
        client.createTaskRun({
          input: taskInput,
          processor: env.PARALLEL_TASK_PROCESSOR,
          task_spec: {
            output_schema: {
              type: "json",
              json_schema: TASK_OUTPUT_SCHEMA
            }
          },
          metadata: {
            job_id: input.jobId,
            candidate_id: candidate.candidate_id
          }
        })
      );

      stats.taskRunIds.push(taskRun.run_id);

      stats.parallelApiCalls += 1;
      const taskResult = await withParallelRetry("task_run_result", stats, () =>
        client.retrieveTaskRunResult(taskRun.run_id, 600)
      );

      if (taskResult.run.status !== "completed") {
        throw new LeadsEngineError(
          "PARALLEL_UPSTREAM_ERROR",
          `Task run ${taskRun.run_id} ended with status ${taskResult.run.status}.`
        );
      }

      const parsedTask = taskEnrichmentSchema.safeParse(taskResult.output.content);
      if (!parsedTask.success) {
        throw new LeadsEngineError("PARALLEL_SCHEMA_INVALID", `Task output schema invalid for run ${taskRun.run_id}.`);
      }

      const enriched = parsedTask.data;
      const basis = Array.isArray(taskResult.output.basis) ? taskResult.output.basis : [];
      const basisSummary = summarizeEvidence(basis);
      const evidenceCoverage = basisSummary.citationsCount > 0 ? Math.min(1, basisSummary.citationsCount / 6) : 0;

      const scoreBreakdown = computeLeadScore({
        companyIndustry: enriched.company_industry,
        companySizeEmployees: enriched.company_size_employees,
        companyLocation: enriched.company_location,
        companyFundingRecentDate: enriched.company_funding_recent_date,
        sellerIndustries: sellerProfile.industries,
        sellerTechStack: sellerProfile.tech_stack,
        techEvidence: enriched.tech_evidence,
        hiringEvidence: enriched.hiring_evidence,
        growthEvidence: enriched.growth_evidence,
        hasTechStackMatchFlag: enriched.tech_stack_match_flag,
        hasRecentFundingFlag: enriched.recent_funding_flag,
        hasRecentHiringFlag: enriched.recent_hiring_flag,
        hasGrowthSignalFlag: enriched.growth_signal_flag
      });

      const summaryReason =
        enriched.fit_reason.trim().length > 0
          ? enriched.fit_reason
          : `${enriched.company_name || candidate.name} scored ${scoreBreakdown.total}/100 based on ICP, hiring, funding, and growth signals.`;

      const lead: LeadV2Item = {
        company_name: enriched.company_name || candidate.name,
        company_website: normalizeUrl(enriched.company_website || candidate.url || ""),
        company_industry: enriched.company_industry,
        company_size_employees: enriched.company_size_employees,
        company_location: enriched.company_location,
        company_funding_total: enriched.company_funding_total,
        company_funding_recent_date: enriched.company_funding_recent_date,
        company_linkedin: enriched.company_linkedin,
        company_description: enriched.company_description || candidate.description || "",
        contact_name: enriched.contact_name || "Unknown",
        contact_title: enriched.contact_title,
        contact_email: enriched.contact_email.toLowerCase(),
        contact_linkedin: enriched.contact_linkedin,
        contact_phone: enriched.contact_phone,
        email_confidence: enriched.email_confidence,
        recent_funding_flag: enriched.recent_funding_flag,
        recent_hiring_flag: enriched.recent_hiring_flag,
        tech_stack_match_flag: enriched.tech_stack_match_flag,
        growth_signal_flag: enriched.growth_signal_flag,
        score: scoreBreakdown.total,
        fit_reason: summaryReason,
        source_provider: "parallel",
        source_run_id: taskRun.run_id,
        enrichment_confidence: enriched.enrichment_confidence,
        evidence: {
          citationsCount: basisSummary.citationsCount,
          basisFields: basisSummary.basisFields,
          sources: basisSummary.sources,
          summary: `Citations: ${basisSummary.citationsCount}, Fields: ${basisSummary.basisFields.length}`
        },
        score_breakdown: scoreBreakdown,
        normalization_version: "leads_parallel_v2_2026_04_21"
      };

      const isEvidenceQualified =
        lead.evidence.citationsCount >= 1 &&
        lead.company_name.trim().length > 0 &&
        lead.company_website.trim().length > 0;
      if (isEvidenceQualified) {
        leads.push(lead);
        evidenceScores.push(evidenceCoverage);
      } else {
        stats.filteredCandidates += 1;
      }

      completed += 1;
      stats.enrichedCandidates = completed;

      const progress = 52 + Math.floor((completed / enrichmentCandidates.length) * 34);
      await input.onProgress({
        stage: "task_enrichment",
        progress,
        message: `Enriched ${completed}/${enrichmentCandidates.length} candidates.`,
        metadata: {
          enriched_candidates: completed,
          filtered_candidates: stats.filteredCandidates
        }
      });
    }
  });

  await Promise.all(workers);

  leads.sort((a, b) => b.score - a.score);
  const qualifiedLeads = leads.slice(0, requestedCount);
  stats.qualifiedCandidates = qualifiedLeads.length;
  stats.evidenceCoverage =
    evidenceScores.length > 0
      ? Number((evidenceScores.reduce((sum, value) => sum + value, 0) / evidenceScores.length).toFixed(2))
      : 0;

  if (qualifiedLeads.length < requestedCount) {
    const error = new LeadsEngineError(
      "INSUFFICIENT_QUALIFIED_LEADS",
      `Only ${qualifiedLeads.length} qualified leads passed evidence requirements out of requested ${requestedCount}.`
    );
    await saveLeadRunSnapshot(
      input.jobId,
      input.orgId,
      input.workspaceId,
      stats,
      "failed",
      Date.now() - startedAt,
      error.code,
      error.message
    );
    throw error;
  }

  const leadsWithGrade = qualifiedLeads.map((lead) => {
    const grade = leadGradeFromScore(lead.score);
    return {
      ...lead,
      fit_reason: `${lead.fit_reason} Grade ${grade}.`
    };
  });

  await input.onProgress({
    stage: "deterministic_scoring",
    progress: 90,
    message: "Scored and ranked qualified leads.",
    metadata: {
      qualified_candidates: stats.qualifiedCandidates,
      evidence_coverage: stats.evidenceCoverage
    }
  });

  await saveLeadRunSnapshot(
    input.jobId,
    input.orgId,
    input.workspaceId,
    stats,
    "complete",
    Date.now() - startedAt
  );

  await input.onProgress({
    stage: "persist_result",
    progress: 96,
    message: "Leads result is ready for persistence.",
    metadata: {
      lead_count: leadsWithGrade.length,
      generator_used: stats.generatorUsed,
      findall_run_ids: stats.findallRunIds,
      task_runs: stats.taskRunIds.length
    }
  });

  return { leads: leadsWithGrade, stats };
}
