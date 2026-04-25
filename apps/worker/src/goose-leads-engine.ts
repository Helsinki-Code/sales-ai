import dns from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import {
  computeLeadScore,
  leadGradeFromScore,
  ParallelApiError,
  ParallelClient,
  isRetryableParallelError,
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
  runtime: z.string().default("firecrawl_primary"),
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

const gooseContinuationStateSchema = z.object({
  slice_index: z.number().int().min(0).default(0),
  accepted_leads: z.array(z.any()).default([]),
  accepted_domains: z.array(z.string()).default([]),
  reviewed_domains: z.array(z.string()).default([]),
  seen_domains: z.array(z.string()).default([]),
  stats: z
    .object({
      cycleIndex: z.number().int().default(0),
      crawlerRuns: z.number().int().default(0),
      pagesCrawled: z.number().int().default(0),
      searchResultsSeen: z.number().int().default(0),
      verifiedEmailCount: z.number().int().default(0),
      rejectedQuality: z.number().int().default(0),
      rejectedEmail: z.number().int().default(0),
      acceptedCount: z.number().int().default(0),
      queries: z.array(z.string()).default([]),
      enrichmentAttempts: z.number().int().default(0),
      enrichmentSuccesses: z.number().int().default(0)
    })
    .default({
      cycleIndex: 0,
      crawlerRuns: 0,
      pagesCrawled: 0,
      searchResultsSeen: 0,
      verifiedEmailCount: 0,
      rejectedQuality: 0,
      rejectedEmail: 0,
      acceptedCount: 0,
      queries: [],
      enrichmentAttempts: 0,
      enrichmentSuccesses: 0
    }),
  seller_profile: z.any().optional(),
  extracted_icp: z.any().optional(),
  rejection_by_reason: z.record(z.number().int()).default({})
});

type LeadRunStats = {
  cycleIndex: number;
  crawlerRuns: number;
  pagesCrawled: number;
  searchResultsSeen: number;
  verifiedEmailCount: number;
  rejectedQuality: number;
  rejectedEmail: number;
  acceptedCount: number;
  queries: string[];
  enrichmentAttempts: number;
  enrichmentSuccesses: number;
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
      | "PARALLEL_AUTH_ERROR"
      | "PARALLEL_RATE_LIMITED"
      | "PARALLEL_TIMEOUT"
      | "PARALLEL_SCHEMA_INVALID"
      | "PARALLEL_UPSTREAM_ERROR"
      | "EMAIL_VERIFICATION_FAILED"
      | "INSUFFICIENT_QUALIFIED_LEADS"
      | "JOB_CANCELLED",
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

type FirecrawlSearchResult = {
  url: string;
  title: string;
  description: string;
};

const contactEnrichmentOutputSchema = z.object({
  contact_name: z.string().default(""),
  contact_title: z.string().default(""),
  contact_email: z.string().default(""),
  contact_phone: z.string().default(""),
  contact_linkedin: z.string().default(""),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  basis: z.array(z.string()).default([])
});

class FirecrawlError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly operation?: "search" | "scrape",
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2";
const EXCLUDED_DISCOVERY_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "reddit.com",
  "wikipedia.org",
  "crunchbase.com",
  "g2.com",
  "capterra.com"
];
const DISCOVERY_LINK_KEYWORDS = ["about", "team", "leadership", "contact", "company", "careers", "jobs", "blog", "press"];
const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const LINKEDIN_COMPANY_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-z0-9\-_/]+/i;

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

const CONTACT_ENRICHMENT_SCHEMA_JSON: Record<string, unknown> = {
  type: "object",
  properties: {
    contact_name: { type: "string" },
    contact_title: { type: "string" },
    contact_email: { type: "string" },
    contact_phone: { type: "string" },
    contact_linkedin: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    basis: { type: "array", items: { type: "string" } }
  },
  required: ["contact_name", "contact_title", "contact_email", "contact_phone", "contact_linkedin", "confidence", "basis"],
  additionalProperties: false
};

const ROLE_EMAIL_PREFIXES = new Set([
  "info",
  "sales",
  "hello",
  "support",
  "contact",
  "admin",
  "team",
  "office",
  "hr",
  "jobs",
  "careers",
  "marketing",
  "press",
  "media",
  "billing",
  "accounts",
  "service"
]);

function incrementCount(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

function toTaskMetadata(values: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    output[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return output;
}

async function withParallelRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = isRetryableParallelError(error);
      if (!retryable || attempt >= maxAttempts) break;
      const waitMs = Math.min(12000, 1000 * 2 ** attempt);
      logger.warn({ label, attempt, waitMs, error }, "Parallel enrichment failed; retrying.");
      await sleep(waitMs);
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

function normalizePhoneE164Like(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let normalized = trimmed.replace(/[^\d+]/g, "");
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (!normalized.startsWith("+")) {
    const digits = normalized.replace(/\D/g, "");
    if (digits.length === 10) {
      normalized = `+1${digits}`;
    } else if (digits.length >= 8 && digits.length <= 15) {
      normalized = `+${digits}`;
    } else {
      return "";
    }
  }
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return `+${digits}`;
}

function isValidContactLinkedin(url: string): boolean {
  return /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9\-_%]+\/?$/i.test(url.trim());
}

function isValidContactName(name: string): boolean {
  const cleaned = name.trim();
  if (!cleaned) return false;
  if (/^unknown$/i.test(cleaned)) return false;
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  return /^[a-zA-Z][a-zA-Z' -]+$/.test(cleaned);
}

function isDirectPersonEmail(email: string, companyDomain: string): boolean {
  const normalized = email.trim().toLowerCase();
  const basicEmailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!basicEmailRegex.test(normalized)) return false;
  const [localPart, domainPart] = normalized.split("@");
  if (!localPart || !domainPart) return false;
  if (ROLE_EMAIL_PREFIXES.has(localPart)) return false;
  if (!domainPart.endsWith(companyDomain)) return false;
  return true;
}

async function getJobStatus(jobId: string, workspaceId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("status")
    .eq("id", jobId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) return null;
  return typeof data?.status === "string" ? data.status : null;
}

async function runParallelContactEnrichment(params: {
  client: ParallelClient;
  candidate: GooseCrawlerCandidate;
  sellerUrl: string;
  icp: ExtractedIcp;
  cycleIndex: number;
  jobId: string;
}): Promise<z.output<typeof contactEnrichmentOutputSchema>> {
  const inputPayload = {
    seller_url: params.sellerUrl,
    candidate: {
      company_name: params.candidate.company_name,
      company_website: params.candidate.company_website,
      company_description: params.candidate.company_description,
      email_candidates: params.candidate.email_candidates,
      contact_candidates: params.candidate.contact_candidates,
      evidence_urls: params.candidate.evidence_urls
    },
    icp_persona_titles: params.icp.persona_titles.slice(0, 6),
    strict_requirement:
      "Return a direct person contact with deliverable corporate email, person linkedin profile and phone number."
  };

  const created = await withParallelRetry("contact_enrichment_run_create", () =>
    params.client.createTaskRun({
      input: inputPayload,
      processor: env.PARALLEL_TASK_PROCESSOR,
      task_spec: {
        output_schema: {
          type: "json",
          json_schema: CONTACT_ENRICHMENT_SCHEMA_JSON
        }
      },
      metadata: toTaskMetadata({
        job_id: params.jobId,
        cycle_index: params.cycleIndex,
        company: params.candidate.company_name || params.candidate.company_website
      })
    })
  );

  const result = await withParallelRetry("contact_enrichment_run_result", () =>
    params.client.retrieveTaskRunResult(created.run_id, 240)
  );

  if (result.run.status !== "completed") {
    const detail = result.run.error?.message?.trim() || `status ${result.run.status}`;
    throw new LeadsEngineError("PARALLEL_UPSTREAM_ERROR", `contact_enrichment failed: ${detail}`);
  }

  const parsed = contactEnrichmentOutputSchema.safeParse(result.output.content);
  if (!parsed.success) {
    throw new LeadsEngineError("PARALLEL_SCHEMA_INVALID", "contact_enrichment failed: Invalid task output schema.");
  }
  return parsed.data;
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWebsite(value: string): string {
  const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
  return `${parsed.protocol}//${parsed.hostname}`;
}

function isDomainExcluded(domain: string, sellerDomain: string): boolean {
  const normalized = domain.toLowerCase();
  if (!normalized || !normalized.includes(".")) return true;
  if (normalized === sellerDomain) return true;
  return EXCLUDED_DISCOVERY_DOMAINS.some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`)
  );
}

function extractMarkdownLinks(markdown: string): string[] {
  const urls = new Set<string>();
  const regex = /\[[^\]]+]\((https?:\/\/[^\s)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const url = match[1]?.trim();
    if (!url) continue;
    urls.add(url);
    if (urls.size >= 80) break;
  }
  return Array.from(urls);
}

function extractEmails(text: string): string[] {
  const emails = new Set<string>();
  const matches = text.match(EMAIL_REGEX) ?? [];
  for (const match of matches) {
    const email = match.trim().toLowerCase();
    if (email.endsWith(".png") || email.endsWith(".jpg") || email.endsWith(".jpeg") || email.endsWith(".svg")) continue;
    emails.add(email);
  }
  return Array.from(emails).slice(0, 12);
}

function inferContactCandidatesFromEmails(
  emails: string[]
): Array<{ name: string; title: string; email: string; source_url: string }> {
  return emails
    .slice(0, 8)
    .map((email) => {
      const local = email.split("@")[0] ?? "";
      const normalized = local.replace(/[_-]/g, ".").split(".").filter((part) => part.length > 0);
      const maybeName =
        normalized.length >= 2 && normalized.length <= 3
          ? normalized.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
          : "";
      return {
        name: maybeName,
        title: "",
        email,
        source_url: ""
      };
    })
    .filter((entry) => entry.email.length > 0);
}

function buildBaseQueries(icp: ExtractedIcp, sellerDomain: string): string[] {
  const industries = icp.industry_taxonomy.slice(0, 3);
  const useCases = icp.must_have_use_case_signals.slice(0, 3);
  const geos = icp.geo_hints.slice(0, 2);
  const strict = icp.strict_must_match.slice(0, 3);

  const queries = new Set<string>();
  for (const industry of industries.length > 0 ? industries : ["b2b software"]) {
    queries.add(`${industry} companies`);
    for (const signal of useCases) {
      queries.add(`${industry} ${signal} companies`);
    }
    for (const geo of geos) {
      queries.add(`${industry} companies ${geo}`);
    }
  }
  for (const constraint of strict) {
    queries.add(`${constraint} b2b companies`);
  }
  queries.add(`companies similar to ${sellerDomain}`);
  return Array.from(queries).slice(0, 24);
}

function mutateQuery(baseQuery: string, mutationRound: number, icp: ExtractedIcp): string {
  const adjacentTerms = [
    ...icp.must_have_use_case_signals.slice(0, 3),
    ...icp.persona_titles.slice(0, 2)
  ].filter((value) => value.trim().length > 0);
  const adjacent = adjacentTerms.length > 0 ? adjacentTerms[mutationRound % adjacentTerms.length] : "";

  switch (mutationRound % 5) {
    case 1:
      return `${baseQuery} b2b saas`;
    case 2:
      return `${baseQuery} venture backed startup`;
    case 3:
      return adjacent ? `${baseQuery} ${adjacent}` : `${baseQuery} engineering team`;
    case 4:
      return `${baseQuery} leadership contact email`;
    default:
      return baseQuery;
  }
}

function buildCycleQueries(icp: ExtractedIcp, sellerDomain: string, cycleIndex: number): string[] {
  const baseQueries = buildBaseQueries(icp, sellerDomain);
  const selectedBase = baseQueries[(cycleIndex - 1) % baseQueries.length] ?? `companies similar to ${sellerDomain}`;
  const mutationRound = Math.floor((cycleIndex - 1) / Math.max(1, baseQueries.length));
  const primary = mutateQuery(selectedBase, mutationRound, icp);
  const secondarySignal = icp.must_have_use_case_signals[(cycleIndex - 1) % Math.max(1, icp.must_have_use_case_signals.length)] ?? "";
  const secondary = secondarySignal ? `${primary} ${secondarySignal}` : `${primary} b2b`;
  return Array.from(new Set([primary, secondary])).slice(0, 2);
}

async function firecrawlRequest(
  operation: "search" | "scrape",
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const apiKey = env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new FirecrawlError("FIRECRAWL_API_KEY is missing for goose_v1.", 500, operation, false);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/${operation}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const raw = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new FirecrawlError(
        `Firecrawl ${operation} failed with status ${response.status}: ${raw.slice(0, 220)}`,
        response.status,
        operation,
        retryable
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof FirecrawlError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new FirecrawlError(`Firecrawl ${operation} timed out after ${timeoutMs}ms`, 408, operation, true);
    }
    const message = error instanceof Error ? error.message : `Firecrawl ${operation} failed`;
    throw new FirecrawlError(message, undefined, operation, true);
  } finally {
    clearTimeout(timer);
  }
}

async function firecrawlSearch(query: string, limit: number): Promise<FirecrawlSearchResult[]> {
  const response = await firecrawlRequest(
    "search",
    {
      query,
      limit
    },
    Math.max(10000, env.GOOSE_CRAWLER_TIMEOUT_MS)
  );
  const data = (response.data as Record<string, unknown> | unknown[] | undefined) ?? response;
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown> | undefined)?.web)
    ? (((data as Record<string, unknown>).web as unknown[]) ?? [])
    : [];
  const parsed: FirecrawlSearchResult[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const url = typeof value.url === "string" ? value.url : typeof value.link === "string" ? value.link : "";
    if (!url) continue;
    parsed.push({
      url,
      title: typeof value.title === "string" ? value.title : "",
      description: typeof value.description === "string" ? value.description : typeof value.snippet === "string" ? value.snippet : ""
    });
  }
  return parsed;
}

async function firecrawlScrape(url: string): Promise<{ markdown: string; links: string[]; title: string }> {
  const response = await firecrawlRequest(
    "scrape",
    {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: env.FIRECRAWL_SCRAPE_TIMEOUT_MS
    },
    env.FIRECRAWL_SCRAPE_TIMEOUT_MS + 6000
  );
  const data = ((response.data as Record<string, unknown> | undefined) ?? response) as Record<string, unknown>;
  const markdown = typeof data.markdown === "string" ? data.markdown : "";
  const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
  const title = typeof metadata.title === "string" ? metadata.title : "";
  const linksFromPayload = Array.isArray(data.links) ? data.links.filter((v): v is string => typeof v === "string") : [];
  const links = Array.from(new Set([...linksFromPayload, ...extractMarkdownLinks(markdown)])).slice(0, 80);
  return { markdown, links, title };
}

function buildIntentSignals(icp: ExtractedIcp, content: string): string[] {
  const lowerContent = content.toLowerCase();
  const terms = Array.from(
    new Set(
      [...icp.industry_taxonomy, ...icp.must_have_use_case_signals, ...icp.strict_must_match]
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
  return terms.filter((term) => lowerContent.includes(term.toLowerCase())).slice(0, 12);
}

function inferCompanyName(searchTitle: string, fallbackDomain: string, scrapedTitle: string): string {
  const value = [scrapedTitle, searchTitle]
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  if (value) {
    return value.split("|")[0]?.split("-")[0]?.trim() ?? value;
  }
  return fallbackDomain.split(".")[0]?.replace(/[-_]/g, " ") ?? fallbackDomain;
}

async function discoverWithFirecrawl(params: {
  sellerUrl: string;
  icp: ExtractedIcp;
  cycleIndex: number;
  missingCount: number;
  seenDomains: Set<string>;
}): Promise<GooseCrawlerOutput> {
  const sellerDomain = extractDomain(params.sellerUrl);
  const cycleQueries = buildCycleQueries(params.icp, sellerDomain, params.cycleIndex);
  const searchLimit = Math.max(5, Math.min(env.FIRECRAWL_SEARCH_LIMIT, params.missingCount * 3));
  const candidateLimit = Math.max(4, Math.min(env.FIRECRAWL_PER_CYCLE_MAX_CANDIDATES, params.missingCount + 2));
  const perCompanyPageCap = Math.max(2, Math.min(4, env.GOOSE_CRAWLER_MAX_PAGES));

  const allResults: FirecrawlSearchResult[] = [];
  for (const query of cycleQueries) {
    const rows = await firecrawlSearch(query, searchLimit);
    allResults.push(...rows);
  }

  const selected: FirecrawlSearchResult[] = [];
  for (const row of allResults) {
    try {
      const domain = extractDomain(row.url);
      if (isDomainExcluded(domain, sellerDomain)) continue;
      if (params.seenDomains.has(domain)) continue;
      params.seenDomains.add(domain);
      selected.push(row);
      if (selected.length >= candidateLimit) break;
    } catch {
      continue;
    }
  }

  const companyCandidates: GooseCrawlerCandidate[] = [];
  let totalPagesCrawled = 0;
  for (const row of selected) {
    let rootUrl = "";
    try {
      rootUrl = normalizeWebsite(row.url);
    } catch {
      continue;
    }

    const pagesToScrape = new Set<string>([rootUrl, row.url]);
    const evidenceUrls: string[] = [];
    const contentChunks: string[] = [];
    const emailSourceMap = new Map<string, string>();
    let linkedinCompany = "";
    let discoveredLinks: string[] = [];
    let scrapedTitle = "";

    for (const pageUrl of Array.from(pagesToScrape).slice(0, perCompanyPageCap)) {
      try {
        const scraped = await firecrawlScrape(pageUrl);
        totalPagesCrawled += 1;
        evidenceUrls.push(pageUrl);
        if (scraped.title) scrapedTitle = scrapedTitle || scraped.title;
        if (scraped.markdown) {
          contentChunks.push(scraped.markdown.slice(0, 6000));
          const emails = extractEmails(scraped.markdown);
          for (const email of emails) {
            if (!emailSourceMap.has(email)) emailSourceMap.set(email, pageUrl);
          }
          const linkedin = scraped.markdown.match(LINKEDIN_COMPANY_REGEX)?.[0];
          if (linkedin && !linkedinCompany) linkedinCompany = linkedin;
        }
        discoveredLinks = discoveredLinks.concat(scraped.links);
      } catch {
        continue;
      }
    }

    if (discoveredLinks.length > 0) {
      const internalFocus = discoveredLinks
        .filter((link) => extractDomain(link) === extractDomain(rootUrl))
        .filter((link) => DISCOVERY_LINK_KEYWORDS.some((keyword) => link.toLowerCase().includes(keyword)))
        .slice(0, Math.max(0, perCompanyPageCap - evidenceUrls.length));
      for (const link of internalFocus) {
        if (evidenceUrls.includes(link)) continue;
        try {
          const scraped = await firecrawlScrape(link);
          totalPagesCrawled += 1;
          evidenceUrls.push(link);
          if (scraped.markdown) {
            contentChunks.push(scraped.markdown.slice(0, 6000));
            const emails = extractEmails(scraped.markdown);
            for (const email of emails) {
              if (!emailSourceMap.has(email)) emailSourceMap.set(email, link);
            }
            const linkedin = scraped.markdown.match(LINKEDIN_COMPANY_REGEX)?.[0];
            if (linkedin && !linkedinCompany) linkedinCompany = linkedin;
          }
        } catch {
          continue;
        }
      }
    }

    const combinedContent = contentChunks.join("\n");
    const emails = Array.from(emailSourceMap.keys()).slice(0, 12);
    const emailCandidates = emails.map((email) => ({
      email,
      source_url: emailSourceMap.get(email) ?? rootUrl,
      confidence: "pattern_derived"
    }));
    const contactCandidates = inferContactCandidatesFromEmails(emails).map((entry) => ({
      ...entry,
      source_url: emailSourceMap.get(entry.email) ?? rootUrl
    }));
    const domain = extractDomain(rootUrl);
    const intentSignals = buildIntentSignals(params.icp, combinedContent);
    const description = row.description || combinedContent.slice(0, 400);

    companyCandidates.push({
      company_name: inferCompanyName(row.title, domain, scrapedTitle),
      company_website: rootUrl,
      company_description: description,
      company_linkedin: linkedinCompany,
      evidence_urls: Array.from(new Set(evidenceUrls)).slice(0, 20),
      intent_signals: intentSignals,
      pages_crawled: evidenceUrls.length,
      email_candidates: emailCandidates,
      contact_candidates: contactCandidates
    });
  }

  return gooseCrawlerOutputSchema.parse({
    runtime: "firecrawl_primary",
    used_browser_harness: false,
    queries: cycleQueries,
    company_candidates: companyCandidates,
    crawl_stats: {
      search_results: allResults.length,
      pages_crawled: totalPagesCrawled,
      companies_crawled: companyCandidates.length
    }
  });
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
  extras?: {
    rejectionByReason?: Record<string, number>;
    acceptedLeads?: LeadV2Item[];
    acceptedDomains?: string[];
    reviewedDomains?: string[];
    seenDomains?: string[];
    sliceIndex?: number;
  },
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
    verification_runs: stats.enrichmentAttempts,
    cycle_diagnostics: {
      queries: stats.queries,
      firecrawl_results_seen: stats.searchResultsSeen,
      firecrawl_pages_scraped: stats.pagesCrawled,
      rejection_by_reason: extras?.rejectionByReason ?? {},
      accepted_leads: extras?.acceptedLeads ?? [],
      accepted_domains: extras?.acceptedDomains ?? [],
      reviewed_domains: extras?.reviewedDomains ?? [],
      seen_domains: extras?.seenDomains ?? [],
      continuation_slice_index: extras?.sliceIndex ?? 0,
      enrichment_attempts: stats.enrichmentAttempts,
      enrichment_successes: stats.enrichmentSuccesses
    }
  };

  const { error } = await supabaseAdmin.from("leads_runs").upsert(payload, { onConflict: "job_id" });
  if (error) {
    logger.warn({ jobId, error }, "Failed to persist goose leads snapshot");
  }
}

export async function runGooseLeadsEngine(input: LeadsEngineRunInput): Promise<{
  leads: LeadV2Item[];
  needsContinuation: boolean;
  cancelled?: boolean;
  continuationState?: Record<string, unknown>;
  rejectionByReason: Record<string, number>;
  sliceIndex: number;
  stats: {
    crawlerRuns: number;
    pagesCrawled: number;
    verifiedEmailCount: number;
    rejectedQuality: number;
    rejectedEmail: number;
    cycleIndex: number;
    enrichmentAttempts: number;
    enrichmentSuccesses: number;
  };
}> {
  const startedAt = Date.now();
  const continuationRaw =
    input.input && typeof input.input === "object" && "__goose_state" in input.input
      ? (input.input.__goose_state as unknown)
      : undefined;
  const continuationState = gooseContinuationStateSchema.safeParse(continuationRaw).success
    ? gooseContinuationStateSchema.parse(continuationRaw)
    : null;

  const parsedInput = leadsInputSchema.parse(input.input);
  const normalizedUrl = normalizeUrl(parsedInput.url);
  const requestedCount = parsedInput.count;
  const sellerDomain = extractDomain(normalizedUrl);
  const maxCyclesPerSlice = Math.max(1, env.GOOSE_MAX_CYCLES_PER_SLICE);
  const sliceIndex = (continuationState?.slice_index ?? 0) + 1;
  const rejectionByReason: Record<string, number> = { ...(continuationState?.rejection_by_reason ?? {}) };

  await input.onProgress({
    stage: "normalize_input",
    progress: 5,
    message: "Validated lead request input.",
    metadata: {
      requested_count: requestedCount,
      seller_domain: sellerDomain,
      continuation_slice_index: sliceIndex
    }
  });

  let sellerProfile: SellerProfile;
  let extractedIcp: ExtractedIcp;
  if (continuationState?.seller_profile && continuationState?.extracted_icp) {
    sellerProfile = continuationState.seller_profile as SellerProfile;
    extractedIcp = icpExtractionSchema.parse(continuationState.extracted_icp);
  } else {
    await input.onProgress({
      stage: "seller_profile",
      progress: 12,
      message: "Extracting seller profile from website."
    });

    const sellerProfileRaw = await runPythonJsonCommand<Record<string, unknown>>("analyze_prospect.py", {
      args: ["--url", normalizedUrl, "--output", "json"],
      timeoutMs: 90000
    });
    sellerProfile = toSellerProfile(sellerProfileRaw);

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

    extractedIcp = icpExtractionSchema.parse(icpResult.data);
    if (extractedIcp.confidence === "low") {
      throw new LeadsEngineError("INSUFFICIENT_QUALIFIED_LEADS", "ICP extraction confidence is low for strict matching.");
    }
  }

  const acceptedLeads: LeadV2Item[] = Array.isArray(continuationState?.accepted_leads)
    ? (continuationState?.accepted_leads as LeadV2Item[])
    : [];
  const acceptedDomains = new Set<string>(continuationState?.accepted_domains ?? []);
  const reviewedDomains = new Set<string>(continuationState?.reviewed_domains ?? []);

  const stats: LeadRunStats = {
    cycleIndex: continuationState?.stats.cycleIndex ?? 0,
    crawlerRuns: continuationState?.stats.crawlerRuns ?? 0,
    pagesCrawled: continuationState?.stats.pagesCrawled ?? 0,
    searchResultsSeen: continuationState?.stats.searchResultsSeen ?? 0,
    verifiedEmailCount: continuationState?.stats.verifiedEmailCount ?? 0,
    rejectedQuality: continuationState?.stats.rejectedQuality ?? 0,
    rejectedEmail: continuationState?.stats.rejectedEmail ?? 0,
    acceptedCount: continuationState?.stats.acceptedCount ?? acceptedLeads.length,
    queries: continuationState?.stats.queries ?? [],
    enrichmentAttempts: continuationState?.stats.enrichmentAttempts ?? 0,
    enrichmentSuccesses: continuationState?.stats.enrichmentSuccesses ?? 0
  };
  const seenDomains = new Set<string>([sellerDomain, ...(continuationState?.seen_domains ?? [])]);
  let consecutiveZeroAcceptCycles = 0;
  let cyclesThisSlice = 0;

  if (!env.PARALLEL_API_KEY) {
    throw new LeadsEngineError("PARALLEL_AUTH_ERROR", "PARALLEL_API_KEY is required for premium contact enrichment.");
  }
  const parallelClient = new ParallelClient({
    apiKey: env.PARALLEL_API_KEY,
    baseUrl: env.PARALLEL_BASE_URL,
    timeoutMs: env.PARALLEL_TIMEOUT_MS,
    findAllBetaHeader: env.PARALLEL_FINDALL_BETA_HEADER
  });

  while (acceptedLeads.length < requestedCount && cyclesThisSlice < maxCyclesPerSlice) {
    const jobStatus = await getJobStatus(input.jobId, input.workspaceId);
    if (jobStatus === "cancelled") {
      await saveLeadRunSnapshot(
        input.jobId,
        input.orgId,
        input.workspaceId,
        stats,
        "running",
        Date.now() - startedAt,
        {
          rejectionByReason,
          acceptedLeads,
          acceptedDomains: Array.from(acceptedDomains),
          reviewedDomains: Array.from(reviewedDomains),
          seenDomains: Array.from(seenDomains),
          sliceIndex
        }
      );
      return {
        leads: acceptedLeads.slice(0, requestedCount),
        needsContinuation: false,
        cancelled: true,
        rejectionByReason,
        sliceIndex,
        stats: {
          crawlerRuns: stats.crawlerRuns,
          pagesCrawled: stats.pagesCrawled,
          verifiedEmailCount: stats.verifiedEmailCount,
          rejectedQuality: stats.rejectedQuality,
          rejectedEmail: stats.rejectedEmail,
          cycleIndex: stats.cycleIndex,
          enrichmentAttempts: stats.enrichmentAttempts,
          enrichmentSuccesses: stats.enrichmentSuccesses
        }
      };
    }

    cyclesThisSlice += 1;
    stats.cycleIndex += 1;
    const missingCount = requestedCount - acceptedLeads.length;
    const acceptedBeforeCycle = acceptedLeads.length;

    await input.onProgress({
      stage: "crawler_discovery",
      progress: Math.min(55, 20 + stats.cycleIndex * 8),
      message: `Cycle ${stats.cycleIndex}: running Firecrawl discovery for ${missingCount} missing leads.`,
      metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
        firecrawl_queries_used: stats.queries.slice(-5),
        firecrawl_results_seen: stats.searchResultsSeen,
        firecrawl_pages_scraped: stats.pagesCrawled,
        continuation_slice_index: sliceIndex
      })
    });

    let crawlerOutput: GooseCrawlerOutput;
    try {
      crawlerOutput = await discoverWithFirecrawl({
        sellerUrl: normalizedUrl,
        icp: extractedIcp,
        cycleIndex: stats.cycleIndex,
        missingCount,
        seenDomains
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Firecrawl discovery failed.";
      if (error instanceof FirecrawlError && (error.retryable || error.status === 429)) {
        const retryDelayMs = Math.min(45000, 2500 * Math.max(1, stats.cycleIndex % 6));
        await input.onProgress({
          stage: "crawler_discovery",
          progress: Math.min(60, 22 + stats.cycleIndex * 8),
          message: `Cycle ${stats.cycleIndex}: Firecrawl ${error.operation ?? "request"} retry in ${Math.round(
            retryDelayMs / 1000
          )}s.`,
          metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
            firecrawl_error_status: error.status ?? "unknown",
            firecrawl_error_message: message.slice(0, 220),
            firecrawl_queries_used: stats.queries.slice(-5),
            firecrawl_results_seen: stats.searchResultsSeen,
            firecrawl_pages_scraped: stats.pagesCrawled
          })
        });
        await sleep(retryDelayMs);
        continue;
      }
      if (error instanceof FirecrawlError && error.status === 408) {
        throw new LeadsEngineError("CRAWLER_TIMEOUT", message);
      }
      throw new LeadsEngineError("CRAWLER_BLOCKED", message);
    }

    stats.crawlerRuns += 1;
    stats.pagesCrawled += crawlerOutput.crawl_stats.pages_crawled;
    stats.searchResultsSeen += crawlerOutput.crawl_stats.search_results;
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
        pages_crawled: stats.pagesCrawled,
        firecrawl_queries_used: crawlerOutput.queries,
        firecrawl_results_seen: stats.searchResultsSeen,
        firecrawl_pages_scraped: stats.pagesCrawled
      })
    });

    if (dedupedCandidates.length === 0) {
      const noCandidateBackoffMs = Math.min(60000, 3000 + stats.cycleIndex * 500);
      await input.onProgress({
        stage: "crawler_discovery",
        progress: Math.min(68, 30 + stats.cycleIndex * 8),
        message: `Cycle ${stats.cycleIndex}: no new candidates from Firecrawl, backoff ${Math.round(
          noCandidateBackoffMs / 1000
        )}s before next strict cycle.`,
        metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
          crawler_runtime: crawlerOutput.runtime,
          firecrawl_queries_used: crawlerOutput.queries,
          firecrawl_results_seen: stats.searchResultsSeen,
          firecrawl_pages_scraped: stats.pagesCrawled
        })
      });
      await sleep(noCandidateBackoffMs);
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
      if (!decision || decision.verdict !== "accept" || decision.quality_review_confidence !== "high") {
        stats.rejectedQuality += 1;
        incrementCount(rejectionByReason, !decision ? "missing_quality_decision" : decision.verdict !== "accept" ? "quality_reject" : "quality_confidence_not_high");
        continue;
      }

      await input.onProgress({
        stage: "contact_enrichment",
        progress: Math.min(86, 44 + stats.cycleIndex * 6),
        message: `Cycle ${stats.cycleIndex}: enriching contact profile for ${candidate.company_name || candidate.company_website}.`,
        metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
          enrichment_attempts: stats.enrichmentAttempts,
          enrichment_successes: stats.enrichmentSuccesses
        })
      });

      stats.enrichmentAttempts += 1;
      let enrichedContact: z.output<typeof contactEnrichmentOutputSchema> | null = null;
      try {
        enrichedContact = await runParallelContactEnrichment({
          client: parallelClient,
          candidate,
          sellerUrl: normalizedUrl,
          icp: extractedIcp,
          cycleIndex: stats.cycleIndex,
          jobId: input.jobId
        });
        stats.enrichmentSuccesses += 1;
      } catch (error) {
        stats.rejectedQuality += 1;
        incrementCount(rejectionByReason, "enrichment_failed");
        if (error instanceof LeadsEngineError && error.code === "PARALLEL_AUTH_ERROR") throw error;
        continue;
      }

      const inferredContact = inferContact(candidate);
      const contactName = (enrichedContact.contact_name || inferredContact.name || "").trim();
      const contactTitle = (enrichedContact.contact_title || inferredContact.title || "").trim();
      const contactLinkedin = (enrichedContact.contact_linkedin || inferredContact.linkedin || "").trim();
      const normalizedPhone = normalizePhoneE164Like(enrichedContact.contact_phone || inferredContact.phone || "");

      if (!isValidContactName(contactName)) {
        stats.rejectedQuality += 1;
        incrementCount(rejectionByReason, "missing_contact_name");
        continue;
      }
      if (!isValidContactLinkedin(contactLinkedin)) {
        stats.rejectedQuality += 1;
        incrementCount(rejectionByReason, "missing_linkedin");
        continue;
      }
      if (!normalizedPhone) {
        stats.rejectedQuality += 1;
        incrementCount(rejectionByReason, "missing_phone");
        continue;
      }

      const leadDomain = extractDomain(candidate.company_website || candidate.company_name);
      const emailCandidates = Array.from(
        new Set(
          [enrichedContact.contact_email, ...candidate.email_candidates.map((entry) => entry.email)]
            .map((entry) => entry.trim().toLowerCase())
            .filter((entry) => entry.length > 0)
        )
      );
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
        if (!isDirectPersonEmail(email, leadDomain)) {
          continue;
        }
        const emailVerification = await verifyEmailDeliverable(email);
        if (emailVerification.status === "deliverable") {
          selectedEmail = email;
          verification = emailVerification;
          break;
        }
      }

      if (!verification || !selectedEmail) {
        stats.rejectedEmail += 1;
        incrementCount(rejectionByReason, "role_inbox_email");
        continue;
      }

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
      if (scoreBreakdown.total < 60) {
        stats.rejectedQuality += 1;
        incrementCount(rejectionByReason, "low_score");
        continue;
      }

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
        contact_name: contactName,
        contact_title: contactTitle,
        contact_email: selectedEmail,
        contact_linkedin: contactLinkedin,
        contact_phone: normalizedPhone,
        email_confidence: verification.verification_confidence === "high" ? "confirmed" : "pattern_derived",
        recent_funding_flag: candidate.evidence_urls.some((url) => /fund|series|invest/i.test(url)),
        recent_hiring_flag: candidate.evidence_urls.some((url) => /career|job|hiring/i.test(url)),
        tech_stack_match_flag: candidate.intent_signals.length > 0,
        growth_signal_flag: candidate.intent_signals.length > 1,
        score: scoreBreakdown.total,
        fit_reason: `Strict ICP match with verified deliverable email. Grade ${leadGradeFromScore(scoreBreakdown.total)}.`,
        source_provider: "managed",
        source_run_id: `goose_cycle_${stats.cycleIndex}`,
        enrichment_confidence: enrichedContact.confidence,
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
        },
        firecrawl_telemetry: {
          firecrawl_queries_used: stats.queries.slice(-8),
          firecrawl_results_seen: stats.searchResultsSeen,
          firecrawl_pages_scraped: stats.pagesCrawled
        },
        rejection_by_reason: rejectionByReason,
        enrichment_attempts: stats.enrichmentAttempts,
        enrichment_successes: stats.enrichmentSuccesses,
        contact_completeness_rate: acceptedLeads.length > 0 ? 1 : 0
      })
    });

    const acceptedThisCycle = acceptedLeads.length - acceptedBeforeCycle;
    if (acceptedThisCycle === 0) {
      consecutiveZeroAcceptCycles += 1;
      const adaptiveBackoffMs = Math.min(120000, 3500 * 2 ** Math.min(5, consecutiveZeroAcceptCycles - 1));
      await input.onProgress({
        stage: "crawler_discovery",
        progress: Math.min(90, 58 + stats.cycleIndex * 6),
        message: `Cycle ${stats.cycleIndex}: zero accepted leads, adaptive retry in ${Math.round(
          adaptiveBackoffMs / 1000
        )}s.`,
        metadata: buildCycleMetadata(stats.cycleIndex, acceptedLeads.length, requestedCount, {
          zero_accept_cycles: consecutiveZeroAcceptCycles,
          firecrawl_queries_used: stats.queries.slice(-8),
          firecrawl_results_seen: stats.searchResultsSeen,
          firecrawl_pages_scraped: stats.pagesCrawled
        })
      });
      await sleep(adaptiveBackoffMs);
    } else {
      consecutiveZeroAcceptCycles = 0;
    }
  }

  acceptedLeads.sort((a, b) => b.score - a.score);
  const finalLeads = acceptedLeads.slice(0, requestedCount);
  const needsContinuation = finalLeads.length < requestedCount;

  await saveLeadRunSnapshot(
    input.jobId,
    input.orgId,
    input.workspaceId,
    stats,
    needsContinuation ? "running" : "complete",
    Date.now() - startedAt,
    {
      rejectionByReason,
      acceptedLeads: finalLeads,
      acceptedDomains: Array.from(acceptedDomains),
      reviewedDomains: Array.from(reviewedDomains),
      seenDomains: Array.from(seenDomains),
      sliceIndex
    }
  );

  await input.onProgress({
    stage: needsContinuation ? "slice_pause" : "persist_result",
    progress: needsContinuation ? 92 : 96,
    message: needsContinuation
      ? `Slice ${sliceIndex} complete: ${finalLeads.length}/${requestedCount}. Queueing continuation.`
      : "Goose leads result is ready for persistence.",
    metadata: buildCycleMetadata(stats.cycleIndex, finalLeads.length, requestedCount, {
      verified_email_count: stats.verifiedEmailCount,
      rejection_counts: {
        quality: stats.rejectedQuality,
        email: stats.rejectedEmail
      },
      crawler_coverage: {
        runs: stats.crawlerRuns,
        pages_crawled: stats.pagesCrawled
      },
      firecrawl_telemetry: {
        firecrawl_queries_used: stats.queries.slice(-10),
        firecrawl_results_seen: stats.searchResultsSeen,
        firecrawl_pages_scraped: stats.pagesCrawled
      },
      rejection_by_reason: rejectionByReason,
      enrichment_attempts: stats.enrichmentAttempts,
      enrichment_successes: stats.enrichmentSuccesses,
      continuation_slice_index: sliceIndex,
      contact_completeness_rate: finalLeads.length > 0 ? 1 : 0
    })
  });

  return {
    leads: finalLeads,
    needsContinuation,
    continuationState: needsContinuation
      ? {
          slice_index: sliceIndex,
          accepted_leads: finalLeads,
          accepted_domains: Array.from(acceptedDomains),
          reviewed_domains: Array.from(reviewedDomains),
          seen_domains: Array.from(seenDomains),
          seller_profile: sellerProfile,
          extracted_icp: extractedIcp,
          rejection_by_reason: rejectionByReason,
          stats
        }
      : undefined,
    rejectionByReason,
    sliceIndex,
    stats: {
      crawlerRuns: stats.crawlerRuns,
      pagesCrawled: stats.pagesCrawled,
      verifiedEmailCount: stats.verifiedEmailCount,
      rejectedQuality: stats.rejectedQuality,
      rejectedEmail: stats.rejectedEmail,
      cycleIndex: stats.cycleIndex,
      enrichmentAttempts: stats.enrichmentAttempts,
      enrichmentSuccesses: stats.enrichmentSuccesses
    }
  };
}
