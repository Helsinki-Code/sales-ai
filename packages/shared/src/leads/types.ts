export type LeadEnrichmentConfidence = "high" | "medium" | "low";

export type LeadEvidence = {
  citationsCount: number;
  basisFields: string[];
  sources: string[];
  summary: string;
};

export type LeadScoreBreakdown = {
  icp_fit: {
    score: number;
    max: number;
    reason: string;
  };
  hiring_signal: {
    score: number;
    max: number;
    reason: string;
  };
  funding_signal: {
    score: number;
    max: number;
    reason: string;
  };
  tech_stack_match: {
    score: number;
    max: number;
    reason: string;
  };
  growth_signal: {
    score: number;
    max: number;
    reason: string;
  };
  total: number;
};

export type LeadV2Item = {
  company_name: string;
  company_website: string;
  company_industry: string;
  company_size_employees: string;
  company_location: string;
  company_funding_total: string;
  company_funding_recent_date: string;
  company_linkedin: string;
  company_description: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_linkedin: string;
  contact_phone: string;
  email_confidence: "confirmed" | "pattern_derived" | "unknown";
  recent_funding_flag: boolean;
  recent_hiring_flag: boolean;
  tech_stack_match_flag: boolean;
  growth_signal_flag: boolean;
  score: number;
  fit_reason: string;
  source_provider: "parallel" | "managed";
  source_run_id: string;
  enrichment_confidence: LeadEnrichmentConfidence;
  quality_review_confidence: LeadEnrichmentConfidence;
  icp_match_reasons: string[];
  rejection_flags: string[];
  evidence: LeadEvidence;
  score_breakdown: LeadScoreBreakdown;
  normalization_version: string;
  email_verification_status?: "deliverable" | "undeliverable";
  email_verification_confidence?: LeadEnrichmentConfidence;
  verification_source?: "smtp" | "mx";
};

export type SellerProfile = {
  company_name: string;
  description: string;
  industries: string[];
  company_size_signals: Record<string, unknown>;
  has_job_postings: boolean;
  tech_stack: string[];
  social_links: Record<string, unknown>;
};

export type LeadSignalInput = {
  companyIndustry: string;
  companySizeEmployees: string;
  companyLocation: string;
  companyFundingRecentDate: string;
  sellerIndustries: string[];
  sellerTechStack: string[];
  techEvidence: string;
  hiringEvidence: string;
  growthEvidence: string;
  hasTechStackMatchFlag: boolean;
  hasRecentFundingFlag: boolean;
  hasRecentHiringFlag: boolean;
  hasGrowthSignalFlag: boolean;
};
