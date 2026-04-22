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

const qualityReviewDecisionSchema = z.object({
  candidate_id: z.string(),
  verdict: z.enum(["accept", "reject"]),
  icp_match_reasons: z.array(z.string()).default([]),
  rejection_flags: z.array(z.string()).default([]),
  quality_review_confidence: z.enum(["high", "medium", "low"])
});

const qualityReviewResultSchema = z.object({
  decisions: z.array(qualityReviewDecisionSchema).default([])
});

type TaskEnrichment = z.output<typeof taskEnrichmentSchema>;

type ExtractedIcp = {
  industry_taxonomy: string[];
  company_size_bands: string[];
  geo_hints: string[];
  persona_titles: string[];
  must_have_use_case_signals: string[];
  negative_filters: string[];
  strict_must_match: string[];
  confidence: "high" | "medium" | "low";
  rationale: string;
};

type QualityReviewDecision = {
  candidate_id: string;
  verdict: "accept" | "reject";
  icp_match_reasons: string[];
  rejection_flags: string[];
  quality_review_confidence: "high" | "medium" | "low";
};

const REQUIRED_ENRICHMENT_FIELDS: Array<keyof TaskEnrichment> = [
  "company_name",
  "company_website",
  "company_industry",
  "company_size_employees",
  "company_location",
  "company_description",
  "contact_name",
  "contact_title"
];

const TASK_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    company_website: { type: "string" },
    company_industry: { type: "string" },
    company_size_employees: { type: "string" },
    company_location: { type: "string" },
    company_funding_total: { type: "string" },
    company_funding_recent_date: { type: "string" },
    company_linkedin: { type: "string" },
    company_description: { type: "string" },
    contact_name: { type: "string" },
    contact_title: { type: "string" },
    contact_email: { type: "string" },
    contact_linkedin: { type: "string" },
    contact_phone: { type: "string" },
    email_confidence: {
      type: "string",
      enum: ["confirmed", "pattern_derived", "unknown"]
    },
    recent_funding_flag: { type: "boolean" },
    recent_hiring_flag: { type: "boolean" },
    tech_stack_match_flag: { type: "boolean" },
    growth_signal_flag: { type: "boolean" },
    tech_evidence: { type: "string" },
    hiring_evidence: { type: "string" },
    growth_evidence: { type: "string" },
    fit_reason: { type: "string" },
    enrichment_confidence: {
      type: "string",
      enum: ["high", "medium", "low"]
    }
  },
  required: Object.keys(taskEnrichmentSchema.shape),
  additionalProperties: false
};

const ICP_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    industry_taxonomy: { type: "array", items: { type: "string" } },
    company_size_bands: { type: "array", items: { type: "string" } },
    geo_hints: { type: "array", items: { type: "string" } },
    persona_titles: { type: "array", items: { type: "string" } },
    must_have_use_case_signals: { type: "array", items: { type: "string" } },
    negative_filters: { type: "array", items: { type: "string" } },
    strict_must_match: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    rationale: { type: "string" }
  },
  required: [
    "industry_taxonomy",
    "persona_titles",
    "must_have_use_case_signals",
    "strict_must_match",
    "confidence"
  ],
  additionalProperties: false
};

const QUALITY_REVIEW_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidate_id: { type: "string" },
          verdict: { type: "string", enum: ["accept", "reject"] },
          icp_match_reasons: { type: "array", items: { type: "string" } },
          rejection_flags: { type: "array", items: { type: "string" } },
          quality_review_confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["candidate_id", "verdict", "quality_review_confidence"],
        additionalProperties: false
      }
    }
  },
  required: ["decisions"],
  additionalProperties: false
};

type FindAllMatchCondition = { name: string; description: string };
type CompactBasisEntry = { field: string; value: string; citations: string[] };

type FindAllCandidate = {
  findall_run_id: string;
  candidate_id: string;
  name: string;
  url: string;
  description: string;
  output: Record<string, unknown>;
  basis: unknown[];
};

type ReviewedCandidate = {
  candidate: FindAllCandidate;
  decision: QualityReviewDecision;
};

type CycleDiagnostic = {
  cycle_index: number;
  requested_in_cycle: number;
  discovered_candidates: number;
  deduped_candidates: number;
  strict_rejections: number;
  quality_rejections: number;
  enrichment_failures: number;
  accepted_in_cycle: number;
  accepted_so_far: number;
  missing_count: number;
  rejection_samples: Array<{ candidate: string; flags: string[]; reason: string }>;
  failure_samples: Array<{ candidate: string; reason: string }>;
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
  cyclesCompleted: number;
};

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 3))}...`;
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function coerceStringList(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const values = value
    .map((item) => safeString(item))
    .filter((item) => item.length > 0)
    .slice(0, maxItems)
    .map((item) => clampText(item, maxChars));
  return Array.from(new Set(values));
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
    typeof raw.description === "string" && raw.description.trim().length > 0
      ? raw.description.trim()
      : "";

  const industries = coerceStringList(raw.industry_signals, 10, 90);
  const techStack = coerceStringList(raw.tech_stack, 12, 80);

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

function buildIcpExtractionInput(
  url: string,
  profileRaw: Record<string, unknown>,
  sellerProfile: SellerProfile
): Record<string, unknown> {
  const socialPlatforms = Object.keys(safeRecord(profileRaw.social_links)).slice(0, 8);
  const pagesAnalyzed = coerceStringList(profileRaw.pages_analyzed, 12, 180);
  const pricingTiers = coerceStringList(profileRaw.pricing_tiers, 8, 100);

  return {
    seller_url: url,
    company_name: sellerProfile.company_name,
    description: clampText(sellerProfile.description, 1200),
    industry_signals: sellerProfile.industries.slice(0, 12),
    tech_stack: sellerProfile.tech_stack.slice(0, 15),
    has_job_postings: sellerProfile.has_job_postings,
    company_size_signals: sellerProfile.company_size_signals,
    social_platforms: socialPlatforms,
    pages_analyzed: pagesAnalyzed,
    pricing_tiers: pricingTiers,
    strict_policy:
      "Derive ICP only from this website context. Return strict must-match filters for prospect discovery. Avoid generic assumptions."
  };
}

function normalizeIcp(icpRaw: unknown): ExtractedIcp {
  const icp = icpExtractionSchema.parse(icpRaw);
  return {
    industry_taxonomy: Array.from(new Set(icp.industry_taxonomy.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    company_size_bands: Array.from(new Set(icp.company_size_bands.map((item) => item.trim()).filter(Boolean))).slice(0, 10),
    geo_hints: Array.from(new Set(icp.geo_hints.map((item) => item.trim()).filter(Boolean))).slice(0, 10),
    persona_titles: Array.from(new Set(icp.persona_titles.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    must_have_use_case_signals: Array.from(
      new Set(icp.must_have_use_case_signals.map((item) => item.trim()).filter(Boolean))
    ).slice(0, 12),
    negative_filters: Array.from(new Set(icp.negative_filters.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    strict_must_match: Array.from(new Set(icp.strict_must_match.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    confidence: icp.confidence,
    rationale: icp.rationale.trim()
  };
}

function buildStrictFindAllObjective(url: string, profile: SellerProfile, icp: ExtractedIcp, missingCount: number): string {
  const industry = icp.industry_taxonomy.slice(0, 5).join(", ");
  const useCases = icp.must_have_use_case_signals.slice(0, 4).join(", ");
  const personas = icp.persona_titles.slice(0, 4).join(", ");
  const sizeHint = icp.company_size_bands.length > 0 ? icp.company_size_bands.join(", ") : "not specified";
  return [
    `Find ${Math.max(missingCount * 4, 20)} companies that strictly match this ICP.`,
    `Seller URL: ${url}`,
    `Seller: ${profile.company_name}`,
    `Industries: ${industry}`,
    `Use-case signals: ${useCases}`,
    `Buyer personas: ${personas}`,
    `Company size bands: ${sizeHint}`,
    "Return companies only when they satisfy strict requirements."
  ].join(" ");
}

function buildStrictMatchConditions(icp: ExtractedIcp): FindAllMatchCondition[] {
  const conditions: FindAllMatchCondition[] = [];
  for (const phrase of icp.strict_must_match) {
    conditions.push({
      name: `must_match_${conditions.length + 1}`,
      description: `Candidate must explicitly match: ${phrase}`
    });
  }
  for (const phrase of icp.industry_taxonomy.slice(0, 4)) {
    conditions.push({
      name: `industry_${conditions.length + 1}`,
      description: `Candidate primary industry aligns with: ${phrase}`
    });
  }
  for (const phrase of icp.must_have_use_case_signals.slice(0, 4)) {
    conditions.push({
      name: `use_case_${conditions.length + 1}`,
      description: `Candidate has this buyer need/use case: ${phrase}`
    });
  }
  for (const phrase of icp.persona_titles.slice(0, 3)) {
    conditions.push({
      name: `persona_${conditions.length + 1}`,
      description: `Candidate should include a likely decision-maker such as: ${phrase}`
    });
  }
  if (icp.company_size_bands.length > 0) {
    conditions.push({
      name: `size_${conditions.length + 1}`,
      description: `Candidate size must be within: ${icp.company_size_bands.join(", ")}`
    });
  }
  if (icp.geo_hints.length > 0) {
    conditions.push({
      name: `geo_${conditions.length + 1}`,
      description: `Candidate geography should match one of: ${icp.geo_hints.join(", ")}`
    });
  }
  if (icp.negative_filters.length > 0) {
    conditions.push({
      name: `exclude_${conditions.length + 1}`,
      description: `Exclude candidates matching: ${icp.negative_filters.join(", ")}`
    });
  }
  return conditions.slice(0, 24);
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
      value: clampText(value, 260),
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

function pickString(record: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = safeString(record[key]);
    if (value.length > 0) return value;
  }
  return fallback;
}

function pickBoolean(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (["true", "yes", "1"].includes(lowered)) return true;
      if (["false", "no", "0"].includes(lowered)) return false;
    }
    if (typeof value === "number") return value !== 0;
  }
  return false;
}

function pickEmailConfidence(record: Record<string, unknown>): TaskEnrichment["email_confidence"] {
  const value = safeString(record.email_confidence).toLowerCase();
  if (value === "confirmed" || value === "pattern_derived") return value;
  return "unknown";
}

function pickEnrichmentConfidence(record: Record<string, unknown>): TaskEnrichment["enrichment_confidence"] {
  const value = safeString(record.enrichment_confidence).toLowerCase();
  if (value === "high" || value === "medium") return value;
  return "low";
}

function buildSeedEnrichment(candidate: FindAllCandidate): TaskEnrichment {
  const output = safeRecord(candidate.output);

  return {
    company_name: pickString(output, ["company_name", "name"], candidate.name),
    company_website: normalizeUrl(pickString(output, ["company_website", "website", "url"], candidate.url)),
    company_industry: pickString(output, ["company_industry", "industry"], ""),
    company_size_employees: pickString(output, ["company_size_employees", "employee_count", "company_size"], ""),
    company_location: pickString(output, ["company_location", "location", "hq_location"], ""),
    company_funding_total: pickString(output, ["company_funding_total", "funding_total"], ""),
    company_funding_recent_date: pickString(output, ["company_funding_recent_date", "funding_recent_date"], ""),
    company_linkedin: pickString(output, ["company_linkedin", "linkedin", "linkedin_company"], ""),
    company_description: pickString(output, ["company_description", "description"], candidate.description),
    contact_name: pickString(output, ["contact_name"], "Unknown"),
    contact_title: pickString(output, ["contact_title"], ""),
    contact_email: pickString(output, ["contact_email"], "").toLowerCase(),
    contact_linkedin: pickString(output, ["contact_linkedin"], ""),
    contact_phone: pickString(output, ["contact_phone"], ""),
    email_confidence: pickEmailConfidence(output),
    recent_funding_flag: pickBoolean(output, ["recent_funding_flag"]),
    recent_hiring_flag: pickBoolean(output, ["recent_hiring_flag"]),
    tech_stack_match_flag: pickBoolean(output, ["tech_stack_match_flag"]),
    growth_signal_flag: pickBoolean(output, ["growth_signal_flag"]),
    tech_evidence: pickString(output, ["tech_evidence"], ""),
    hiring_evidence: pickString(output, ["hiring_evidence"], ""),
    growth_evidence: pickString(output, ["growth_evidence"], ""),
    fit_reason: pickString(output, ["fit_reason"], ""),
    enrichment_confidence: pickEnrichmentConfidence(output)
  };
}

function mergeEnrichment(seed: TaskEnrichment, enriched: TaskEnrichment): TaskEnrichment {
  const merged: TaskEnrichment = { ...seed, ...enriched };
  const stringFields: Array<keyof TaskEnrichment> = [
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
    "tech_evidence",
    "hiring_evidence",
    "growth_evidence",
    "fit_reason"
  ];

  for (const field of stringFields) {
    const mergedValue = safeString(merged[field]);
    const seedValue = safeString(seed[field]);
    if (mergedValue.length === 0 && seedValue.length > 0) {
      (merged as Record<string, unknown>)[String(field)] = seedValue;
    }
  }

  return merged;
}

function missingRequiredFields(value: TaskEnrichment): Array<keyof TaskEnrichment> {
  return REQUIRED_ENRICHMENT_FIELDS.filter((field) => safeString(value[field]).length === 0);
}

function normalizeSearchText(parts: string[]): string {
  return parts.join(" ").toLowerCase();
}

function findKeywordHits(text: string, keywords: string[]): string[] {
  const hits: string[] = [];
  for (const phrase of keywords) {
    const normalized = phrase.trim().toLowerCase();
    if (!normalized) continue;
    if (text.includes(normalized)) hits.push(phrase);
  }
  return hits;
}

function evaluateStrictGate(
  candidate: FindAllCandidate,
  icp: ExtractedIcp,
  sellerDomain: string
): { accepted: boolean; icp_match_reasons: string[]; rejection_flags: string[] } {
  const candidateDomain = extractDomain(candidate.url || candidate.name);
  const output = safeRecord(candidate.output);
  const searchText = normalizeSearchText([
    candidate.name,
    candidate.url,
    candidate.description,
    safeString(output.company_industry),
    safeString(output.company_description),
    safeString(output.contact_title),
    JSON.stringify(output)
  ]);

  const rejectionFlags: string[] = [];
  const reasons: string[] = [];

  if (candidateDomain && candidateDomain === sellerDomain) {
    rejectionFlags.push("same_domain_as_seller");
  }

  const negativeHits = findKeywordHits(searchText, icp.negative_filters);
  if (negativeHits.length > 0) {
    rejectionFlags.push(`negative_filter:${negativeHits[0]}`);
  }

  const strictMustMatchHits = findKeywordHits(searchText, icp.strict_must_match);
  if (icp.strict_must_match.length > 0 && strictMustMatchHits.length === 0) {
    rejectionFlags.push("missing_strict_must_match");
  } else if (strictMustMatchHits.length > 0) {
    reasons.push(`strict:${strictMustMatchHits.slice(0, 2).join(", ")}`);
  }

  const positiveKeywords = [
    ...icp.industry_taxonomy,
    ...icp.must_have_use_case_signals,
    ...icp.persona_titles
  ];
  const positiveHits = findKeywordHits(searchText, positiveKeywords);
  if (positiveHits.length === 0) {
    rejectionFlags.push("missing_icp_keywords");
  } else {
    reasons.push(`keywords:${positiveHits.slice(0, 3).join(", ")}`);
  }

  if (rejectionFlags.length > 0) {
    return { accepted: false, icp_match_reasons: reasons, rejection_flags: rejectionFlags };
  }

  return {
    accepted: true,
    icp_match_reasons: reasons.length > 0 ? reasons : ["strict gate accepted"],
    rejection_flags: []
  };
}

function buildQualityReviewInput(
  sellerUrl: string,
  icp: ExtractedIcp,
  candidates: FindAllCandidate[]
): Record<string, unknown> {
  return {
    seller_url: sellerUrl,
    icp,
    review_policy:
      "Accept only if candidate strongly matches ICP. Reject weak, generic, ambiguous, or non-matching candidates. Return short structured reasons.",
    candidates: candidates.map((candidate) => {
      const output = safeRecord(candidate.output);
      return {
        candidate_id: candidate.candidate_id,
        name: clampText(candidate.name, 160),
        url: clampText(candidate.url, 220),
        description: clampText(candidate.description, 240),
        company_industry: clampText(safeString(output.company_industry), 140),
        company_size_employees: clampText(safeString(output.company_size_employees), 100),
        company_location: clampText(safeString(output.company_location), 120),
        contact_title: clampText(safeString(output.contact_title), 120),
        fit_reason: clampText(safeString(output.fit_reason), 200)
      };
    })
  };
}

function buildEnrichmentInput(
  candidate: FindAllCandidate,
  sellerProfile: SellerProfile,
  icp: ExtractedIcp,
  missingFields: string[]
): Record<string, unknown> {
  let basisEntries = toCompactBasisEntries(candidate.basis, 8);
  let candidateDescription = clampText(candidate.description || "", 700);
  let sellerDescription = clampText(sellerProfile.description || "", 700);
  const output = safeRecord(candidate.output);

  const buildPayload = (): Record<string, unknown> => ({
    missing_required_fields: missingFields,
    candidate_name: clampText(candidate.name, 180),
    candidate_url: clampText(candidate.url, 240),
    candidate_description: candidateDescription,
    candidate_output_snapshot: {
      company_industry: clampText(safeString(output.company_industry), 120),
      company_size_employees: clampText(safeString(output.company_size_employees), 80),
      company_location: clampText(safeString(output.company_location), 100),
      contact_title: clampText(safeString(output.contact_title), 100),
      fit_reason: clampText(safeString(output.fit_reason), 180)
    },
    candidate_basis_summary: basisEntries,
    seller_company: clampText(sellerProfile.company_name || "", 180),
    seller_description: sellerDescription,
    seller_industries: sellerProfile.industries.slice(0, 10),
    seller_tech_stack: sellerProfile.tech_stack.slice(0, 12),
    icp_reference: {
      industry_taxonomy: icp.industry_taxonomy.slice(0, 8),
      persona_titles: icp.persona_titles.slice(0, 8),
      must_have_use_case_signals: icp.must_have_use_case_signals.slice(0, 8),
      strict_must_match: icp.strict_must_match.slice(0, 8)
    }
  });

  const maxChars = 11500;
  let payload = buildPayload();
  if (stringifySize(payload) > maxChars) {
    basisEntries = basisEntries.slice(0, 4);
    payload = buildPayload();
  }
  if (stringifySize(payload) > maxChars) {
    basisEntries = basisEntries.slice(0, 2);
    payload = buildPayload();
  }
  if (stringifySize(payload) > maxChars) {
    basisEntries = [];
    payload = buildPayload();
  }
  if (stringifySize(payload) > maxChars) {
    candidateDescription = clampText(candidateDescription, 240);
    sellerDescription = clampText(sellerDescription, 240);
    payload = buildPayload();
  }

  return payload;
}

function buildCycleMetadata(
  cycleIndex: number,
  acceptedSoFar: number,
  requestedCount: number,
  lastCycle: CycleDiagnostic | null
): Record<string, unknown> {
  return {
    cycle_index: cycleIndex,
    accepted_so_far: acceptedSoFar,
    missing_count: Math.max(0, requestedCount - acceptedSoFar),
    last_cycle_rejections: lastCycle ? lastCycle.strict_rejections + lastCycle.quality_rejections : 0,
    last_cycle_failures: lastCycle ? lastCycle.enrichment_failures : 0
  };
}

function progressForCycle(acceptedSoFar: number, requestedCount: number, offset = 0): number {
  const ratio = requestedCount > 0 ? acceptedSoFar / requestedCount : 0;
  return Math.min(94, Math.max(24, Math.round(24 + ratio * 56 + offset)));
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

function toTaskMetadata(values: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    output[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return output;
}

async function runStructuredTask(params: {
  label: string;
  client: ParallelClient;
  stats: LeadRunStats;
  input: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timeoutSeconds?: number;
  validator: z.ZodTypeAny;
}): Promise<{ runId: string; output: unknown; basis: unknown[] }> {
  params.stats.parallelApiCalls += 1;
  const created = await withParallelRetry(`${params.label}_run_create`, params.stats, () =>
    params.client.createTaskRun({
      input: params.input,
      processor: env.PARALLEL_TASK_PROCESSOR,
      task_spec: {
        output_schema: {
          type: "json",
          json_schema: params.outputSchema
        }
      },
      metadata: toTaskMetadata(params.metadata)
    })
  );

  params.stats.taskRunIds.push(created.run_id);

  params.stats.parallelApiCalls += 1;
  const result = await withParallelRetry(`${params.label}_run_result`, params.stats, () =>
    params.client.retrieveTaskRunResult(created.run_id, params.timeoutSeconds ?? 600)
  );

  if (result.run.status !== "completed") {
    const upstreamError = result.run.error?.message?.trim();
    const detail = upstreamError || `status ${result.run.status}`;
    throw new LeadsEngineError("PARALLEL_UPSTREAM_ERROR", `${params.label} failed: ${detail}`);
  }

  const parsed = params.validator.safeParse(result.output.content);
  if (!parsed.success) {
    throw new LeadsEngineError("PARALLEL_SCHEMA_INVALID", `${params.label} failed: Invalid task output schema.`);
  }

  return {
    runId: created.run_id,
    output: parsed.data,
    basis: Array.isArray(result.output.basis) ? result.output.basis : []
  };
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
    evidenceCoverage: 0,
    cyclesCompleted: 0
  };

  await input.onProgress({
    stage: "normalize_input",
    progress: 6,
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
    progress: 14,
    message: "Derived URL-driven seller profile.",
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

  const icpTask = await runStructuredTask({
    label: "icp_extraction",
    client,
    stats,
    input: buildIcpExtractionInput(normalizedUrl, profileRaw, sellerProfile),
    outputSchema: ICP_OUTPUT_SCHEMA,
    validator: icpExtractionSchema,
    metadata: { job_id: input.jobId, seller_domain: extractDomain(normalizedUrl) },
    timeoutSeconds: 240
  });

  const extractedIcp = normalizeIcp(icpTask.output);
  if (extractedIcp.confidence === "low") {
    throw new LeadsEngineError(
      "PARALLEL_SCHEMA_INVALID",
      "icp_extraction failed: low confidence output for strict ICP."
    );
  }

  await input.onProgress({
    stage: "icp_extraction",
    progress: 22,
    message: "Extracted strict ICP from URL context.",
    metadata: {
      icp_confidence: extractedIcp.confidence,
      industry_count: extractedIcp.industry_taxonomy.length,
      persona_count: extractedIcp.persona_titles.length,
      strict_match_count: extractedIcp.strict_must_match.length
    }
  });

  const sellerDomain = extractDomain(normalizedUrl);
  const acceptedLeads: LeadV2Item[] = [];
  const acceptedDomains = new Set<string>();
  const attemptedDomains = new Set<string>();
  const cycleDiagnostics: CycleDiagnostic[] = [];

  const runFindAllWithGenerator = async (
    generator: string,
    cycleIndex: number,
    missingCount: number
  ): Promise<FindAllCandidate[]> => {
    const objective = buildStrictFindAllObjective(normalizedUrl, sellerProfile, extractedIcp, missingCount);
    const matchConditions = buildStrictMatchConditions(extractedIcp);
    const matchLimit = Math.min(Math.max(missingCount * 5, 20), 250);

    stats.parallelApiCalls += 1;
    const created = await withParallelRetry("findall_run_create", stats, () =>
      client.createFindAllRun({
        objective,
        entity_type: "companies",
        match_conditions: matchConditions,
        generator,
        match_limit: matchLimit,
        metadata: {
          seller_domain: sellerDomain,
          job_id: input.jobId,
          cycle_index: String(cycleIndex),
          missing_count: String(missingCount)
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
      .map(
        (candidate): FindAllCandidate => ({
          findall_run_id: created.findall_id,
          candidate_id: candidate.candidate_id,
          name: candidate.name,
          url: candidate.url,
          description: candidate.description,
          output: candidate.output ?? {},
          basis: candidate.basis ?? []
        })
      );

    return matched;
  };

  let cycleIndex = 0;
  while (acceptedLeads.length < requestedCount) {
    cycleIndex += 1;
    const missingCount = requestedCount - acceptedLeads.length;
    const lastCycle: CycleDiagnostic | null =
      cycleDiagnostics.length > 0 ? (cycleDiagnostics[cycleDiagnostics.length - 1] ?? null) : null;

    await input.onProgress({
      stage: "findall_discovery",
      progress: progressForCycle(acceptedLeads.length, requestedCount, 0),
      message: `Cycle ${cycleIndex}: Running strict FindAll discovery for ${missingCount} missing leads.`,
      metadata: buildCycleMetadata(cycleIndex, acceptedLeads.length, requestedCount, lastCycle)
    });

    const primaryCandidates = await runFindAllWithGenerator(env.PARALLEL_FINDALL_GENERATOR_DEFAULT, cycleIndex, missingCount);
    stats.generatorUsed = env.PARALLEL_FINDALL_GENERATOR_DEFAULT;
    let cycleCandidates = primaryCandidates;

    if (
      cycleCandidates.length < Math.max(missingCount * 2, 8) &&
      env.PARALLEL_FINDALL_ESCALATION_GENERATOR &&
      env.PARALLEL_FINDALL_ESCALATION_GENERATOR !== env.PARALLEL_FINDALL_GENERATOR_DEFAULT
    ) {
      await input.onProgress({
        stage: "findall_discovery",
        progress: progressForCycle(acceptedLeads.length, requestedCount, 2),
        message: `Cycle ${cycleIndex}: Escalating generator to ${env.PARALLEL_FINDALL_ESCALATION_GENERATOR}.`,
        metadata: {
          ...buildCycleMetadata(cycleIndex, acceptedLeads.length, requestedCount, lastCycle),
          matched_candidates_primary: cycleCandidates.length
        }
      });

      const escalated = await runFindAllWithGenerator(env.PARALLEL_FINDALL_ESCALATION_GENERATOR, cycleIndex, missingCount);
      const merged = new Map<string, FindAllCandidate>();
      for (const candidate of [...cycleCandidates, ...escalated]) {
        const key = candidate.candidate_id || candidate.url || candidate.name;
        if (!merged.has(key)) merged.set(key, candidate);
      }
      cycleCandidates = Array.from(merged.values());
      stats.generatorUsed = env.PARALLEL_FINDALL_ESCALATION_GENERATOR;
    }

    stats.matchedCandidates += cycleCandidates.length;

    const dedupedCycleCandidates = cycleCandidates.filter((candidate) => {
      const domain = extractDomain(candidate.url || candidate.name);
      const uniqueKey = domain || candidate.candidate_id;
      if (!uniqueKey) return false;
      if (acceptedDomains.has(uniqueKey) || attemptedDomains.has(uniqueKey)) return false;
      attemptedDomains.add(uniqueKey);
      return true;
    });
    stats.dedupedCandidates += dedupedCycleCandidates.length;

    await input.onProgress({
      stage: "candidate_dedupe",
      progress: progressForCycle(acceptedLeads.length, requestedCount, 4),
      message: `Cycle ${cycleIndex}: Deduplicated discovery candidates.`,
      metadata: {
        ...buildCycleMetadata(cycleIndex, acceptedLeads.length, requestedCount, lastCycle),
        matched_candidates: cycleCandidates.length,
        deduped_candidates: dedupedCycleCandidates.length
      }
    });

    const strictAccepted: FindAllCandidate[] = [];
    const rejectionSamples: Array<{ candidate: string; flags: string[]; reason: string }> = [];
    let strictRejections = 0;

    for (const candidate of dedupedCycleCandidates) {
      const gate = evaluateStrictGate(candidate, extractedIcp, sellerDomain);
      if (!gate.accepted) {
        strictRejections += 1;
        stats.filteredCandidates += 1;
        if (rejectionSamples.length < 8) {
          rejectionSamples.push({
            candidate: candidate.name || candidate.url || candidate.candidate_id,
            flags: gate.rejection_flags,
            reason: gate.icp_match_reasons.join("; ")
          });
        }
        continue;
      }
      strictAccepted.push(candidate);
    }

    const reviewedAccepted: ReviewedCandidate[] = [];
    let qualityRejections = 0;

    if (strictAccepted.length > 0) {
      const chunkSize = 20;
      const totalChunks = Math.ceil(strictAccepted.length / chunkSize);
      const decisionMap = new Map<string, QualityReviewDecision>();

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * chunkSize;
        const chunk = strictAccepted.slice(start, start + chunkSize);
        if (chunk.length === 0) continue;

        await input.onProgress({
          stage: "findall_quality_review",
          progress: progressForCycle(acceptedLeads.length, requestedCount, 7),
          message: `Cycle ${cycleIndex}: Reviewing candidate relevance (${chunkIndex + 1}/${totalChunks}).`,
          metadata: {
            ...buildCycleMetadata(cycleIndex, acceptedLeads.length, requestedCount, lastCycle),
            review_chunk: `${chunkIndex + 1}/${totalChunks}`,
            review_candidates: chunk.length
          }
        });

        const reviewTask = await runStructuredTask({
          label: "findall_quality_review",
          client,
          stats,
          input: buildQualityReviewInput(normalizedUrl, extractedIcp, chunk),
          outputSchema: QUALITY_REVIEW_OUTPUT_SCHEMA,
          validator: qualityReviewResultSchema,
          metadata: {
            job_id: input.jobId,
            cycle_index: cycleIndex,
            review_chunk: chunkIndex + 1
          },
          timeoutSeconds: 300
        });

        const reviewOutput = qualityReviewResultSchema.parse(reviewTask.output);
        const decisions = Array.isArray(reviewOutput.decisions) ? reviewOutput.decisions : [];
        for (const rawDecision of decisions) {
          const decision: QualityReviewDecision = {
            candidate_id: rawDecision.candidate_id,
            verdict: rawDecision.verdict,
            quality_review_confidence: rawDecision.quality_review_confidence,
            icp_match_reasons: rawDecision.icp_match_reasons ?? [],
            rejection_flags: rawDecision.rejection_flags ?? []
          };
          if (!decisionMap.has(decision.candidate_id)) {
            decisionMap.set(decision.candidate_id, decision);
          }
        }
      }

      for (const candidate of strictAccepted) {
        const decision = decisionMap.get(candidate.candidate_id);
        if (!decision) {
          qualityRejections += 1;
          stats.filteredCandidates += 1;
          if (rejectionSamples.length < 8) {
            rejectionSamples.push({
              candidate: candidate.name || candidate.url || candidate.candidate_id,
              flags: ["missing_quality_decision"],
              reason: "LLM reviewer returned no decision."
            });
          }
          continue;
        }

        if (decision.verdict !== "accept") {
          qualityRejections += 1;
          stats.filteredCandidates += 1;
          if (rejectionSamples.length < 8) {
            rejectionSamples.push({
              candidate: candidate.name || candidate.url || candidate.candidate_id,
              flags: decision.rejection_flags.length > 0 ? decision.rejection_flags : ["quality_reject"],
              reason: decision.icp_match_reasons.join("; ")
            });
          }
          continue;
        }

        reviewedAccepted.push({ candidate, decision });
      }
    }

    const acceptedInCycle: LeadV2Item[] = [];
    const failureSamples: Array<{ candidate: string; reason: string }> = [];
    let enrichmentFailures = 0;
    let reviewedProcessed = 0;

    const reviewedQueue = reviewedAccepted.slice(0, Math.max(missingCount * 2, missingCount));
    const enrichConcurrency = Math.min(3, reviewedQueue.length);
    let queueIndex = 0;

    const enrichWorkers = Array.from({ length: enrichConcurrency }, async () => {
      while (queueIndex < reviewedQueue.length) {
        const currentIndex = queueIndex;
        queueIndex += 1;
        const reviewed = reviewedQueue[currentIndex];
        if (!reviewed) continue;

        const seed = buildSeedEnrichment(reviewed.candidate);
        const missingFields = missingRequiredFields(seed).map((field) => String(field));
        let finalData = seed;
        let finalBasis = reviewed.candidate.basis;
        let sourceRunId = reviewed.candidate.findall_run_id;

        if (missingFields.length > 0) {
          try {
            const enrichmentTask = await runStructuredTask({
              label: "task_enrichment",
              client,
              stats,
              input: buildEnrichmentInput(reviewed.candidate, sellerProfile, extractedIcp, missingFields),
              outputSchema: TASK_OUTPUT_SCHEMA,
              validator: taskEnrichmentSchema,
              metadata: {
                job_id: input.jobId,
                cycle_index: cycleIndex,
                candidate_id: reviewed.candidate.candidate_id,
                missing_fields: missingFields.join(",")
              },
              timeoutSeconds: 600
            });
            const enrichedOutput = taskEnrichmentSchema.parse(enrichmentTask.output);
            finalData = mergeEnrichment(seed, enrichedOutput);
            finalBasis = enrichmentTask.basis.length > 0 ? enrichmentTask.basis : reviewed.candidate.basis;
            sourceRunId = enrichmentTask.runId;
            stats.enrichedCandidates += 1;
          } catch (error) {
            enrichmentFailures += 1;
            stats.filteredCandidates += 1;
            const reason = error instanceof Error ? error.message : "Unknown enrichment failure.";
            if (failureSamples.length < 8) {
              failureSamples.push({
                candidate: reviewed.candidate.name || reviewed.candidate.url || reviewed.candidate.candidate_id,
                reason
              });
            }
            continue;
          }
        }

        const stillMissing = missingRequiredFields(finalData);
        if (stillMissing.length > 0) {
          enrichmentFailures += 1;
          stats.filteredCandidates += 1;
          if (failureSamples.length < 8) {
            failureSamples.push({
              candidate: reviewed.candidate.name || reviewed.candidate.url || reviewed.candidate.candidate_id,
              reason: `Missing required fields after enrichment: ${stillMissing.join(", ")}`
            });
          }
          continue;
        }

        const basisSummary = summarizeEvidence(Array.isArray(finalBasis) ? finalBasis : []);
        if (basisSummary.citationsCount < 1) {
          enrichmentFailures += 1;
          stats.filteredCandidates += 1;
          if (failureSamples.length < 8) {
            failureSamples.push({
              candidate: reviewed.candidate.name || reviewed.candidate.url || reviewed.candidate.candidate_id,
              reason: "Missing evidence citations."
            });
          }
          continue;
        }

        const scoreBreakdown = computeLeadScore({
          companyIndustry: finalData.company_industry,
          companySizeEmployees: finalData.company_size_employees,
          companyLocation: finalData.company_location,
          companyFundingRecentDate: finalData.company_funding_recent_date,
          sellerIndustries: sellerProfile.industries,
          sellerTechStack: sellerProfile.tech_stack,
          techEvidence: finalData.tech_evidence,
          hiringEvidence: finalData.hiring_evidence,
          growthEvidence: finalData.growth_evidence,
          hasTechStackMatchFlag: finalData.tech_stack_match_flag,
          hasRecentFundingFlag: finalData.recent_funding_flag,
          hasRecentHiringFlag: finalData.recent_hiring_flag,
          hasGrowthSignalFlag: finalData.growth_signal_flag
        });

        const leadDomain = extractDomain(finalData.company_website || reviewed.candidate.url);
        const uniqueLeadKey = leadDomain || reviewed.candidate.candidate_id;
        if (uniqueLeadKey && acceptedDomains.has(uniqueLeadKey)) {
          continue;
        }
        if (uniqueLeadKey) {
          acceptedDomains.add(uniqueLeadKey);
        }

        const summaryReason =
          finalData.fit_reason.trim().length > 0
            ? finalData.fit_reason
            : `${finalData.company_name || reviewed.candidate.name} matched strict ICP signals and passed quality review.`;

        const lead: LeadV2Item = {
          company_name: finalData.company_name || reviewed.candidate.name,
          company_website: normalizeUrl(finalData.company_website || reviewed.candidate.url || ""),
          company_industry: finalData.company_industry,
          company_size_employees: finalData.company_size_employees,
          company_location: finalData.company_location,
          company_funding_total: finalData.company_funding_total,
          company_funding_recent_date: finalData.company_funding_recent_date,
          company_linkedin: finalData.company_linkedin,
          company_description: finalData.company_description || reviewed.candidate.description || "",
          contact_name: finalData.contact_name || "Unknown",
          contact_title: finalData.contact_title,
          contact_email: finalData.contact_email.toLowerCase(),
          contact_linkedin: finalData.contact_linkedin,
          contact_phone: finalData.contact_phone,
          email_confidence: finalData.email_confidence,
          recent_funding_flag: finalData.recent_funding_flag,
          recent_hiring_flag: finalData.recent_hiring_flag,
          tech_stack_match_flag: finalData.tech_stack_match_flag,
          growth_signal_flag: finalData.growth_signal_flag,
          score: scoreBreakdown.total,
          fit_reason: summaryReason,
          source_provider: "parallel",
          source_run_id: sourceRunId,
          enrichment_confidence: finalData.enrichment_confidence,
          quality_review_confidence: reviewed.decision.quality_review_confidence,
          icp_match_reasons: reviewed.decision.icp_match_reasons,
          rejection_flags: [],
          evidence: {
            citationsCount: basisSummary.citationsCount,
            basisFields: basisSummary.basisFields,
            sources: basisSummary.sources,
            summary: `Citations: ${basisSummary.citationsCount}, Fields: ${basisSummary.basisFields.length}`
          },
          score_breakdown: scoreBreakdown,
          normalization_version: "leads_managed_v3_2026_04_22"
        };

        acceptedInCycle.push(lead);

        reviewedProcessed += 1;
        await input.onProgress({
          stage: "task_enrichment",
          progress: progressForCycle(acceptedLeads.length + acceptedInCycle.length, requestedCount, 11),
          message: `Cycle ${cycleIndex}: Enriched and validated ${reviewedProcessed}/${reviewedQueue.length} reviewed candidates.`,
          metadata: {
            ...buildCycleMetadata(cycleIndex, acceptedLeads.length + acceptedInCycle.length, requestedCount, lastCycle),
            enriched_count: stats.enrichedCandidates,
            filtered_count: stats.filteredCandidates
          }
        });
      }
    });

    await Promise.all(enrichWorkers);

    acceptedLeads.push(...acceptedInCycle);
    if (acceptedLeads.length > requestedCount) {
      acceptedLeads.splice(requestedCount);
    }

    stats.cyclesCompleted = cycleIndex;
    const cycleDiagnostic: CycleDiagnostic = {
      cycle_index: cycleIndex,
      requested_in_cycle: missingCount,
      discovered_candidates: cycleCandidates.length,
      deduped_candidates: dedupedCycleCandidates.length,
      strict_rejections: strictRejections,
      quality_rejections: qualityRejections,
      enrichment_failures: enrichmentFailures,
      accepted_in_cycle: acceptedInCycle.length,
      accepted_so_far: acceptedLeads.length,
      missing_count: Math.max(0, requestedCount - acceptedLeads.length),
      rejection_samples: rejectionSamples,
      failure_samples: failureSamples
    };
    cycleDiagnostics.push(cycleDiagnostic);

    await input.onProgress({
      stage: "task_enrichment",
      progress: progressForCycle(acceptedLeads.length, requestedCount, 13),
      message:
        acceptedLeads.length >= requestedCount
          ? `Cycle ${cycleIndex}: Target lead count met.`
          : `Cycle ${cycleIndex}: Accepted ${acceptedInCycle.length} leads, rerunning strict discovery for remaining ${requestedCount - acceptedLeads.length}.`,
      metadata: {
        ...buildCycleMetadata(cycleIndex, acceptedLeads.length, requestedCount, cycleDiagnostic),
        cycle_diagnostic: cycleDiagnostic
      }
    });
  }

  acceptedLeads.sort((a, b) => b.score - a.score);
  const qualifiedLeads = acceptedLeads.slice(0, requestedCount);
  stats.qualifiedCandidates = qualifiedLeads.length;

  const evidenceScores = qualifiedLeads.map((lead) => Math.min(1, (lead.evidence?.citationsCount ?? 0) / 6));
  stats.evidenceCoverage =
    evidenceScores.length > 0
      ? Number((evidenceScores.reduce((sum, value) => sum + value, 0) / evidenceScores.length).toFixed(2))
      : 0;

  if (qualifiedLeads.length < requestedCount) {
    const error = new LeadsEngineError(
      "INSUFFICIENT_QUALIFIED_LEADS",
      `Only ${qualifiedLeads.length} qualified leads passed strict validation out of requested ${requestedCount}.`
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

  const lastCycle: CycleDiagnostic | null =
    cycleDiagnostics.length > 0 ? (cycleDiagnostics[cycleDiagnostics.length - 1] ?? null) : null;

  await input.onProgress({
    stage: "deterministic_scoring",
    progress: 90,
    message: "Scored and ranked strict-qualified leads.",
    metadata: {
      ...buildCycleMetadata(stats.cyclesCompleted, leadsWithGrade.length, requestedCount, lastCycle),
      cycles_completed: stats.cyclesCompleted,
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
      ...buildCycleMetadata(stats.cyclesCompleted, leadsWithGrade.length, requestedCount, lastCycle),
      lead_count: leadsWithGrade.length,
      generator_used: stats.generatorUsed,
      findall_run_ids: stats.findallRunIds,
      task_runs: stats.taskRunIds.length
    }
  });

  return { leads: leadsWithGrade, stats };
}
