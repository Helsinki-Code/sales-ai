import type { LeadScoreBreakdown, LeadSignalInput } from "./types.js";

function containsAny(value: string, terms: string[]): boolean {
  const hay = value.toLowerCase();
  return terms.some((term) => hay.includes(term.toLowerCase()));
}

function scoreIcpFit(input: LeadSignalInput): LeadScoreBreakdown["icp_fit"] {
  const industryMatch =
    input.sellerIndustries.length > 0 &&
    containsAny(input.companyIndustry, input.sellerIndustries);
  const sizeKnown = input.companySizeEmployees.trim().length > 0;
  const geoKnown = input.companyLocation.trim().length > 0;

  let score = 0;
  const reasons: string[] = [];

  if (industryMatch) {
    score += 22;
    reasons.push("industry aligned");
  } else {
    reasons.push("industry uncertain");
  }

  if (sizeKnown) {
    score += 10;
    reasons.push("size signal present");
  } else {
    reasons.push("size signal missing");
  }

  if (geoKnown) {
    score += 8;
    reasons.push("location signal present");
  } else {
    reasons.push("location signal missing");
  }

  return {
    score: Math.min(score, 40),
    max: 40,
    reason: reasons.join(", ")
  };
}

function scoreHiring(input: LeadSignalInput): LeadScoreBreakdown["hiring_signal"] {
  const hasStrongEvidence = containsAny(input.hiringEvidence, [
    "hiring",
    "open roles",
    "openings",
    "careers",
    "recruiting"
  ]);
  if (input.hasRecentHiringFlag && hasStrongEvidence) {
    return { score: 20, max: 20, reason: "active relevant hiring detected" };
  }
  if (input.hasRecentHiringFlag || hasStrongEvidence) {
    return { score: 12, max: 20, reason: "partial hiring signal detected" };
  }
  return { score: 0, max: 20, reason: "no reliable hiring signal" };
}

function scoreFunding(input: LeadSignalInput): LeadScoreBreakdown["funding_signal"] {
  if (!input.hasRecentFundingFlag) {
    return { score: 0, max: 15, reason: "no recent funding signal" };
  }

  const recentDate = input.companyFundingRecentDate.toLowerCase();
  if (containsAny(recentDate, ["2026", "2025", "q1", "q2", "q3", "q4", "recent"])) {
    return { score: 15, max: 15, reason: "recent funding signal detected" };
  }
  return { score: 8, max: 15, reason: "funding detected but recency uncertain" };
}

function scoreTech(input: LeadSignalInput): LeadScoreBreakdown["tech_stack_match"] {
  const techMatch =
    input.sellerTechStack.length > 0 &&
    containsAny(`${input.techEvidence} ${input.companyIndustry}`, input.sellerTechStack);

  if (input.hasTechStackMatchFlag && techMatch) {
    return { score: 15, max: 15, reason: "strong tech stack overlap" };
  }
  if (input.hasTechStackMatchFlag || techMatch) {
    return { score: 11, max: 15, reason: "tech overlap detected" };
  }
  if (input.techEvidence.trim().length > 0) {
    return { score: 6, max: 15, reason: "adjacent tech evidence present" };
  }
  return { score: 0, max: 15, reason: "no tech stack overlap" };
}

function scoreGrowth(input: LeadSignalInput): LeadScoreBreakdown["growth_signal"] {
  const strongGrowthEvidence = containsAny(input.growthEvidence, [
    "expansion",
    "launched",
    "new market",
    "new office",
    "headcount growth",
    "scaled"
  ]);
  if (input.hasGrowthSignalFlag && strongGrowthEvidence) {
    return { score: 10, max: 10, reason: "multiple growth signals detected" };
  }
  if (input.hasGrowthSignalFlag || strongGrowthEvidence) {
    return { score: 6, max: 10, reason: "single growth signal detected" };
  }
  return { score: 0, max: 10, reason: "no growth signal" };
}

export function computeLeadScore(input: LeadSignalInput): LeadScoreBreakdown {
  const icp = scoreIcpFit(input);
  const hiring = scoreHiring(input);
  const funding = scoreFunding(input);
  const tech = scoreTech(input);
  const growth = scoreGrowth(input);
  const total = icp.score + hiring.score + funding.score + tech.score + growth.score;

  return {
    icp_fit: icp,
    hiring_signal: hiring,
    funding_signal: funding,
    tech_stack_match: tech,
    growth_signal: growth,
    total: Math.max(0, Math.min(100, total))
  };
}

export function leadGradeFromScore(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}
