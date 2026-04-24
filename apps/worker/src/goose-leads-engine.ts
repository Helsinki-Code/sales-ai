import dns from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import {
  computeLeadScore,
  leadGradeFromScore,
  runAgent,
  runPythonJsonCommand,
  type LeadV2Item,
  type LlmProvider,
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

const icpExtractionSchema = z.object({
  industry_taxonomy: z.array(z.string()).min(1),
  company_size_bands: z.array(z.string()).default([]),
  geo_hints: z.array(z.string()).default([]),
  persona_titles: z.array(z.string()).min(1),
  must_have_use_case_signals: z.array(z.string()).min(1),
  negative_filters: z.array(z.string()).default([]),
  strict_must_match: z.array(z.string()).min(1),
  confidence: z.enum(["high", "medium", "low"]),
  rationale: z.string().default("")
});

const qualityDecisionSchema = z.object({
  candidate_id: z.string(),
  verdict: z.enum(["accept", "reject"]),
  icp_match_reasons: z.array(z.string()).default([]),
  rejection_flags: z.array(z.string()).default([]),
  quality_review_confidence: z.enum(["high", "medium", "low"])
});

const qualityReviewSchema = z.object({
  decisions: z.array(qualityDecisionSchema).default([])
});

const gooseCrawlerCandidateSchema = z.object({
  company_name: z.string().default(""),
  company_website: z.string().default(""),
  company_description: z.string().default(""),
  company_linkedin: z.string().default(""),
  evidence_urls: z.array(z.string()).default([]),
  intent_signals: z.array(z.string()).default([]),
  pages_crawled: z.number().int().default(0),
  email_candidates: z
    .array(
      z.object({
        email: z.string().default(""),
        source_url: z.string().default(""),
        confidence: z.string().default("unknown")
      })
    )
    .default([]),
  contact_candidates: z
    .array(
      z.object({
        name: z.string().default(""),
        title: z.string().default(""),
        email: z.string().default(""),
        source_url: z.string().default("")
      })
    )
    .default([])
});

const gooseCrawlerOutputSchema = z.object({
  runtime: z.string().default("browser_harness_primary"),
  used_browser_harness: z.boolean().default(false),
  queries: z.array(z.string()).default([]),
  company_candidates: z.array(gooseCrawlerCandidateSchema).default([]),
  crawl_stats: z
    .object({
      search_results: z.number().int().default(0),
      pages_crawled: z.number().int().default(0),
      companies_crawled: z.number().int().default(0)
    })
    .default({
      search_results: 0,
      pages_crawled: 0,
      companies_crawled: 0
    })
});

type ExtractedIcp = z.output<typeof icpExtractionSchema>;
type GooseCrawlerCandidate = z.output<typeof gooseCrawlerCandidateSchema>;
type GooseCrawlerOutput = z.output<typeof gooseCrawlerOutputSchema>;
type QualityDecision = z.output<typeof qualityDecisionSchema>;

type LeadsEngineRunInput = {
  jobId: string;
  orgId: string;
  workspaceId: string;
  input: Record<string, unknown>;
  llm: {
    provider: LlmProvider;
    model: string;
    apiKey: string;
  };
  onProgress: (progress: LeadsEngineProgress) => Promise<void>;
};

type LeadRunStats = {
  cycleIndex: number;
  crawlerRuns: number;
  pagesCrawled: number;
  verifiedEmailCount: number;
  rejectedQuality: number;
  rejectedEmail: number;
  acceptedCount: number;
  queries: string[];
};

export type LeadsEngineProgress = {
  stage: string;
  progress: number;
  message: string;
  metadata?: Record<string, unknown>;
};

export class LeadsEngineError extends Error {
  constructor(
    public readonly code:
      | "CRAWLER_TIMEOUT"
      | "CRAWLER_BLOCKED"
      | "EMAIL_VERIFICATION_FAILED"
      | "INSUFFICIENT_QUALIFIED_LEADS",
    message: string
  ) {
    super(message);
    this.name = "LeadsEngineError";
  }
}

type EmailVerificationResult = {
  status: "deliverable" | "undeliverable";
  verification_source: "smtp" | "mx";
  verification_confidence: "high" | "medium" | "low";
  reason: string;
  verified_at: string;
};

const ICP_SYSTEM_PROMPT = `
You are a strict ICP extraction system.
Return valid JSON only with this exact schema:
{
  "industry_taxonomy": string[],
  "company_size_bands": string[],
  "geo_hints": string[],
  "persona_titles": string[],
  "must_have_use_case_signals": string[],
  "negative_filters": string[],
  "strict_must_match": string[],
  "confidence": "high" | "medium" | "low",
  "rationale": string
}
Rules:
- Derive only from seller website signals provided.
- strict_must_match must contain hard requirements.
- Do not add keys outside schema.
`.trim();

const QUALITY_SYSTEM_PROMPT = `
You are a strict B2B lead quality reviewer.
Return valid JSON only:
{
  "decisions": [
    {
      "candidate_id": string,
      "verdict": "accept" | "reject",
      "icp_match_reasons": string[],
      "rejection_flags": string[],
      "quality_review_confidence": "high" | "medium" | "low"
    }
  ]
}
Rules:
- Accept only candidates matching strict ICP.
- Reject ambiguous candidates.
- Provide compact reasons and flags.
`.trim();

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function extractDomain(input: string): string {
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return input.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]?.toLowerCase() ?? input;
  }
}

function toSellerProfile(raw: Record<string, unknown>): SellerProfile {
  const companyName =
    typeof raw.company_name === "string" && raw.company_name.trim().length > 0
      ? raw.company_name.trim()
      : "Unknown Company";
  const description =
    typeof raw.description === "string" && raw.description.trim().length > 0 ? raw.description.trim() : "";
  const industries = Array.isArray(raw.industry_signals)
    ? raw.industry_signals.filter((item): item is string => typeof item === "string").slice(0, 10)
    : [];
  const techStack = Array.isArray(raw.tech_stack)
    ? raw.tech_stack.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];
  return {
    company_name: companyName,
    description,
    industries,
    company_size_signals:
      raw.company_size_signals && typeof raw.company_size_signals === "object" && !Array.isArray(raw.company_size_signals)
        ? (raw.company_size_signals as Record<string, unknown>)
        : {},
    has_job_postings: Boolean(raw.has_job_postings),
    tech_stack: techStack,
    social_links:
      raw.social_links && typeof raw.social_links === "object" && !Array.isArray(raw.social_links)
        ? (raw.social_links as Record<string, unknown>)
        : {}
  };
}

function buildQualityReviewInput(icp: ExtractedIcp, candidates: GooseCrawlerCandidate[]): Record<string, unknown> {
  return {
    strict_icp: icp,
    candidates: candidates.map((candidate, index) => ({
      candidate_id: candidateKey(candidate, index),
      company_name: candidate.company_name,
      company_website: candidate.company_website,
      company_description: candidate.company_description,
      intent_signals: candidate.intent_signals.slice(0, 12),
      evidence_urls: candidate.evidence_urls.slice(0, 10),
      email_candidates: candidate.email_candidates.slice(0, 8),
      contact_candidates: candidate.contact_candidates.slice(0, 8)
    }))
  };
}

function candidateKey(candidate: GooseCrawlerCandidate, index: number): string {
  const domain = extractDomain(candidate.company_website || candidate.company_name);
  return domain || `candidate_${index + 1}`;
}

function inferCompanyIndustry(candidate: GooseCrawlerCandidate, icp: ExtractedIcp): string {
  const text = `${candidate.company_description} ${candidate.intent_signals.join(" ")}`.toLowerCase();
  for (const industry of icp.industry_taxonomy) {
    if (text.includes(industry.toLowerCase())) return industry;
  }
  return icp.industry_taxonomy[0] ?? "Unknown";
}

function inferContact(candidate: GooseCrawlerCandidate): { name: string; title: string; linkedin: string; phone: string } {
  const firstContact = candidate.contact_candidates[0];
  if (firstContact) {
    return {
      name: firstContact.name || "Unknown",
      title: firstContact.title || "",
      linkedin: "",
      phone: ""
    };
  }
  return {
    name: "Unknown",
    title: "",
    linkedin: "",
    phone: ""
  };
}

async function verifyEmailDeliverable(email: string): Promise<EmailVerificationResult> {
  const normalized = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const basicEmailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!basicEmailRegex.test(normalized)) {
    return {
      status: "undeliverable",
      verification_source: "mx",
      verification_confidence: "low",
      reason: "invalid_syntax",
      verified_at: nowIso
    };
  }

  const domain = normalized.split("@")[1] ?? "";
  if (!domain) {
    return {
      status: "undeliverable",
      verification_source: "mx",
      verification_confidence: "low",
      reason: "missing_domain",
      verified_at: nowIso
    };
  }

  let mxRecords: Array<{ exchange: string; priority: number }> = [];
  try {
    mxRecords = await dns.resolveMx(domain);
  } catch {
    mxRecords = [];
  }

  if (mxRecords.length === 0) {
    return {
      status: "undeliverable",
      verification_source: "mx",
      verification_confidence: "low",
      reason: "mx_not_found",
      verified_at: nowIso
    };
  }

  const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority).slice(0, 2);
  for (const mx of sortedMx) {
    const smtpResult = await smtpRcptCheck(mx.exchange, normalized);
    if (smtpResult === "accepted") {
      return {
        status: "deliverable",
        verification_source: "smtp",
        verification_confidence: "high",
        reason: "smtp_rcpt_accepted",
        verified_at: nowIso
      };
    }
  }

  return {
    status: "deliverable",
    verification_source: "mx",
    verification_confidence: "medium",
    reason: "mx_verified_only",
    verified_at: nowIso
  };
}

async function smtpRcptCheck(host: string, recipient: string): Promise<"accepted" | "rejected" | "unknown"> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: 25 });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve("unknown");
    }, 8000);

    let stage = 0;
    let buffer = "";
    const sender = "verify@tokenflame.local";

    const writeLine = (value: string) => {
      socket.write(`${value}\r\n`);
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (!buffer.includes("\n")) return;
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] ?? "";
      const code = Number(last.slice(0, 3));

      if (stage === 0 && code >= 200 && code < 400) {
        writeLine("EHLO tokenflame.local");
        stage = 1;
        buffer = "";
        return;
      }
      if (stage === 1 && code >= 200 && code < 400) {
        writeLine(`MAIL FROM:<${sender}>`);
        stage = 2;
        buffer = "";
        return;
      }
      if (stage === 2 && code >= 200 && code < 400) {
        writeLine(`RCPT TO:<${recipient}>`);
        stage = 3;
        buffer = "";
        return;
      }
      if (stage === 3) {
        clearTimeout(timeout);
        socket.destroy();
        if (code >= 200 && code < 300) {
          resolve("accepted");
          return;
        }
        if (code >= 500) {
          resolve("rejected");
          return;
        }
        resolve("unknown");
      }
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      resolve("unknown");
    });

    socket.on("close", () => {
      clearTimeout(timeout);
      if (stage < 3) resolve("unknown");
    });
  });
}

function buildCycleMetadata(
  cycleIndex: number,
  acceptedSoFar: number,
  requestedCount: number,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    cycle_index: cycleIndex,
    accepted_so_far: acceptedSoFar,
    missing_count: Math.max(0, requestedCount - acceptedSoFar),
    ...(extra ?? {})
  };
}

async function saveLeadRunSnapshot(
  jobId: string,
  orgId: string,
  workspaceId: string,
  stats: LeadRunStats,
  status: string,
  durationMs: number,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  const payload = {
    job_id: jobId,
    org_id: orgId,
    workspace_id: workspaceId,
    status,
    generator_used: "goose_v1",
    findall_run_ids: [],
    task_run_ids: [],
    retry_count: 0,
    parallel_api_calls: 0,
    matched_candidates: 0,
    deduped_candidates: 0,
    enriched_candidates: stats.verifiedEmailCount,
    filtered_candidates: stats.rejectedQuality + stats.rejectedEmail,
    qualified_candidates: stats.acceptedCount,
    evidence_coverage: null,
    duration_ms: durationMs,
    error_code: errorCode ?? null,
    error_message: errorMessage ?? null,
    cycle_index: stats.cycleIndex,
    accepted_so_far: stats.acceptedCount,
    missing_count: 0,
    rejected_count: stats.rejectedQuality + stats.rejectedEmail,
    enriched_count: stats.verifiedEmailCount,
    crawler_runs: stats.crawlerRuns,
    pages_crawled: stats.pagesCrawled,
    verification_runs: stats.verifiedEmailCount,
    cycle_diagnostics: {
      queries: stats.queries
    }
  };

  const { error } = await supabaseAdmin.from("leads_runs").upsert(payload, { onConflict: "job_id" });
  if (error) {
    logger.warn({ jobId, error }, "Failed to persist goose leads snapshot");
  }
}

export async function runGooseLeadsEngine(input: LeadsEngineRunInput): Promise<{
  leads: LeadV2Item[];
  stats: {
    crawlerRuns: number;
    pagesCrawled: number;
    verifiedEmailCount: number;
    rejectedQuality: number;
    rejectedEmail: number;
    cycleIndex: number;
  };
}> {
  const startedAt = Date.now();
  const parsedInput = leadsInputSchema.parse(input.input);
  const normalizedUrl = normalizeUrl(parsedInput.url);
  const requestedCount = parsedInput.count;
  const sellerDomain = extractDomain(normalizedUrl);

  await input.onProgress({
    stage: "normalize_input",
    progress: 5,
    message: "Validated lead request input.",
    metadata: { requested_count: requestedCount, seller_domain: sellerDomain }
  });

  await input.onProgress({
    stage: "seller_profile",
    progress: 12,
    message: "Extracting seller profile from website."
  });

  const sellerProfileRaw = await runPythonJsonCommand<Record<string, unknown>>("analyze_prospect.py", {
    args: ["--url", normalizedUrl, "--output", "json"],
    timeoutMs: 90000
  });
  const sellerProfile = toSellerProfile(sellerProfileRaw);

  await input.onProgress({
    stage: "icp_extraction",
    progress: 18,
    message: "Generating strict ICP from seller profile."
  });

  const icpResult = await runAgent<ExtractedIcp>({
    apiKey: input.llm.apiKey,
    provider: input.llm.provider,
    model: input.llm.model,
    systemPrompt: ICP_SYSTEM_PROMPT,
    userPrompt: JSON.stringify({
      seller_url: normalizedUrl,
      seller_profile: sellerProfile
    }),
    redis: null,
    maxTokens: 2000
  });

  const extractedIcp = icpExtractionSchema.parse(icpResult.data);
  if (extractedIcp.confidence === "low") {
    throw new LeadsEngineError("INSUFFICIENT_QUALIFIED_LEADS", "ICP extraction confidence is low for strict matching.");
  }

  const acceptedLeads: LeadV2Item[] = [];
  const acceptedDomains = new Set<string>();
  const reviewedDomains = new Set<string>();

  const stats: LeadRunStats = {
    cycleIndex: 0,
    crawlerRuns: 0,
    pagesCrawled: 0,
    verifiedEmailCount: 0,
    rejectedQuality: 0,
    rejectedEmail: 0,
    acceptedCount: 0,
    queries: []
  };

  while (acceptedLeads.length < requestedCount) {
    stats.cycleIndex += 1;
    const missingCount = requestedCount - acceptedLeads.length;

    await input.onProgress({
      stage: "crawler_discovery",
      progress: Math.min(55, 20 + stats.cycleIndex * 8),
      message: `Cycle ${stats.cycleIndex}: crawling candidate companies for ${missingCount} missing leads.`,
      metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount)
    });

    let crawlerOutputRaw: GooseCrawlerOutput;
    try {
      crawlerOutputRaw = await runPythonJsonCommand<GooseCrawlerOutput>("goose_crawler.py", {
        args: [
          "--url",
          normalizedUrl,
          "--count",
          String(missingCount),
          "--icp-json",
          JSON.stringify(extractedIcp),
          "--max-pages",
          String(env.GOOSE_CRAWLER_MAX_PAGES),
          "--timeout",
          String(Math.max(4, Math.round(env.GOOSE_CRAWLER_TIMEOUT_MS / 1000)))
        ],
        timeoutMs: env.GOOSE_CRAWLER_TIMEOUT_MS + 30000
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Goose crawler failed.";
      if (/timeout/i.test(message)) {
        throw new LeadsEngineError("CRAWLER_TIMEOUT", message);
      }
      throw new LeadsEngineError("CRAWLER_BLOCKED", message);
    }

    const crawlerOutput = gooseCrawlerOutputSchema.parse(crawlerOutputRaw);
    stats.crawlerRuns += 1;
    stats.pagesCrawled += crawlerOutput.crawl_stats.pages_crawled;
    stats.queries = Array.from(new Set([...stats.queries, ...crawlerOutput.queries])).slice(0, 20);

    const dedupedCandidates = crawlerOutput.company_candidates.filter((candidate, index) => {
      const key = candidateKey(candidate, index);
      if (reviewedDomains.has(key) || acceptedDomains.has(key)) return false;
      reviewedDomains.add(key);
      return true;
    });

    await input.onProgress({
      stage: "candidate_dedupe",
      progress: Math.min(63, 28 + stats.cycleIndex * 8),
      message: `Cycle ${stats.cycleIndex}: deduped ${dedupedCandidates.length} crawler candidates.`,
      metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
        candidates_discovered: crawlerOutput.company_candidates.length,
        candidates_deduped: dedupedCandidates.length,
        pages_crawled: stats.pagesCrawled
      })
    });

    if (dedupedCandidates.length === 0) {
      await input.onProgress({
        stage: "crawler_discovery",
        progress: Math.min(68, 30 + stats.cycleIndex * 8),
        message: `Cycle ${stats.cycleIndex}: no candidates found, retrying strict crawl.`,
        metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
          crawler_runtime: crawlerOutput.runtime,
          used_browser_harness: crawlerOutput.used_browser_harness
        })
      });
      continue;
    }

    const qualityReview = await runAgent<{ decisions: QualityDecision[] }>({
      apiKey: input.llm.apiKey,
      provider: input.llm.provider,
      model: input.llm.model,
      systemPrompt: QUALITY_SYSTEM_PROMPT,
      userPrompt: JSON.stringify(buildQualityReviewInput(extractedIcp, dedupedCandidates)),
      redis: null,
      maxTokens: 4000
    });
    const qualityDecisions = qualityReviewSchema.parse(qualityReview.data).decisions;
    const qualityMap = new Map(qualityDecisions.map((decision) => [decision.candidate_id, decision]));

    await input.onProgress({
      stage: "quality_review",
      progress: Math.min(76, 36 + stats.cycleIndex * 8),
      message: `Cycle ${stats.cycleIndex}: quality-reviewed ${dedupedCandidates.length} candidates.`,
      metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
        review_decisions: qualityDecisions.length
      })
    });

    for (let idx = 0; idx < dedupedCandidates.length; idx += 1) {
      if (acceptedLeads.length >= requestedCount) break;
      const candidate = dedupedCandidates[idx];
      if (!candidate) continue;
      const key = candidateKey(candidate, idx);
      const decision = qualityMap.get(key);
      if (!decision || decision.verdict !== "accept") {
        stats.rejectedQuality += 1;
        continue;
      }

      const emailCandidates = candidate.email_candidates
        .map((entry) => entry.email.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      let selectedEmail = "";
      let verification: EmailVerificationResult | null = null;

      await input.onProgress({
        stage: "contact_email_verify",
        progress: Math.min(88, 45 + stats.cycleIndex * 8),
        message: `Cycle ${stats.cycleIndex}: verifying candidate email deliverability.`,
        metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
          candidate: candidate.company_name || candidate.company_website,
          email_candidates: emailCandidates.length
        })
      });

      for (const email of emailCandidates) {
        const emailVerification = await verifyEmailDeliverable(email);
        if (emailVerification.status === "deliverable") {
          selectedEmail = email;
          verification = emailVerification;
          break;
        }
      }

      if (!verification || !selectedEmail) {
        stats.rejectedEmail += 1;
        continue;
      }

      const contact = inferContact(candidate);
      const scoreBreakdown = computeLeadScore({
        companyIndustry: inferCompanyIndustry(candidate, extractedIcp),
        companySizeEmployees: extractedIcp.company_size_bands[0] ?? "",
        companyLocation: extractedIcp.geo_hints[0] ?? "",
        companyFundingRecentDate: "",
        sellerIndustries: sellerProfile.industries,
        sellerTechStack: sellerProfile.tech_stack,
        techEvidence: candidate.intent_signals.join("; "),
        hiringEvidence: candidate.evidence_urls.find((url) => /career|job/i.test(url)) ?? "",
        growthEvidence: candidate.evidence_urls.find((url) => /press|blog|news/i.test(url)) ?? "",
        hasTechStackMatchFlag: candidate.intent_signals.length > 0,
        hasRecentFundingFlag: candidate.evidence_urls.some((url) => /fund|invest|series/i.test(url)),
        hasRecentHiringFlag: candidate.evidence_urls.some((url) => /career|job|hiring/i.test(url)),
        hasGrowthSignalFlag: candidate.intent_signals.length > 1
      });

      const leadDomain = extractDomain(candidate.company_website || candidate.company_name);
      if (leadDomain && acceptedDomains.has(leadDomain)) continue;
      if (leadDomain) acceptedDomains.add(leadDomain);

      const lead: LeadV2Item = {
        company_name: candidate.company_name || leadDomain,
        company_website: normalizeUrl(candidate.company_website),
        company_industry: inferCompanyIndustry(candidate, extractedIcp),
        company_size_employees: extractedIcp.company_size_bands[0] ?? "",
        company_location: extractedIcp.geo_hints[0] ?? "",
        company_funding_total: "",
        company_funding_recent_date: "",
        company_linkedin: candidate.company_linkedin,
        company_description: candidate.company_description,
        contact_name: contact.name,
        contact_title: contact.title,
        contact_email: selectedEmail,
        contact_linkedin: contact.linkedin,
        contact_phone: contact.phone,
        email_confidence: verification.verification_confidence === "high" ? "confirmed" : "pattern_derived",
        recent_funding_flag: candidate.evidence_urls.some((url) => /fund|series|invest/i.test(url)),
        recent_hiring_flag: candidate.evidence_urls.some((url) => /career|job|hiring/i.test(url)),
        tech_stack_match_flag: candidate.intent_signals.length > 0,
        growth_signal_flag: candidate.intent_signals.length > 1,
        score: scoreBreakdown.total,
        fit_reason: `Strict ICP match with verified deliverable email. Grade ${leadGradeFromScore(scoreBreakdown.total)}.`,
        source_provider: "managed",
        source_run_id: `goose_cycle_${stats.cycleIndex}`,
        enrichment_confidence: "medium",
        quality_review_confidence: decision.quality_review_confidence,
        icp_match_reasons: decision.icp_match_reasons,
        rejection_flags: [],
        evidence: {
          citationsCount: candidate.evidence_urls.length,
          basisFields: ["company_name", "company_website", "contact_email"],
          sources: candidate.evidence_urls.slice(0, 20),
          summary: `Citations: ${candidate.evidence_urls.length}, Signals: ${candidate.intent_signals.length}`
        },
        score_breakdown: scoreBreakdown,
        normalization_version: "leads_goose_v1_2026_04_24",
        email_verification_status: verification.status,
        email_verification_confidence: verification.verification_confidence,
        verification_source: verification.verification_source
      };

      acceptedLeads.push(lead);
      stats.verifiedEmailCount += 1;
      stats.acceptedCount = acceptedLeads.length;
    }

    await input.onProgress({
      stage: "deterministic_scoring",
      progress: Math.min(94, 55 + stats.cycleIndex * 8),
      message:
        acceptedLeads.length >= requestedCount
          ? `Cycle ${stats.cycleIndex}: target met.`
          : `Cycle ${stats.cycleIndex}: accepted ${acceptedLeads.length}/${requestedCount}, continuing strict fill.`,
      metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
        verified_email_count: stats.verifiedEmailCount,
        rejection_counts: {
          quality: stats.rejectedQuality,
          email: stats.rejectedEmail
        },
        crawler_coverage: {
          runs: stats.crawlerRuns,
          pages_crawled: stats.pagesCrawled
        }
      })
    });
  }

  acceptedLeads.sort((a, b) => b.score - a.score);
  const finalLeads = acceptedLeads.slice(0, requestedCount);

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
    message: "Goose leads result is ready for persistence.",
    metadata: buildCycleMetadata(stats.cycleIndex, finalLeads.length, requestedCount, {
      verified_email_count: stats.verifiedEmailCount,
      rejection_counts: {
        quality: stats.rejectedQuality,
        email: stats.rejectedEmail
      },
      crawler_coverage: {
        runs: stats.crawlerRuns,
        pages_crawled: stats.pagesCrawled
      }
    })
  });

  if (finalLeads.length < requestedCount) {
    const error = new LeadsEngineError(
      "INSUFFICIENT_QUALIFIED_LEADS",
      `Only ${finalLeads.length} leads passed strict quality + email verification gates out of ${requestedCount}.`
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

  return {
    leads: finalLeads,
    stats: {
      crawlerRuns: stats.crawlerRuns,
      pagesCrawled: stats.pagesCrawled,
      verifiedEmailCount: stats.verifiedEmailCount,
      rejectedQuality: stats.rejectedQuality,
      rejectedEmail: stats.rejectedEmail,
      cycleIndex: stats.cycleIndex
    }
  };
}
