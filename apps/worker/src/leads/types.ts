import type { LeadFinderRequestV3, LeadFinderResultV3 } from "@sales-ai/shared";
export type LeadFinderProgress = { stage: string; progress: number; message: string; metadata?: Record<string, unknown> };
export type LeadFinderRunInput = { jobId: string; orgId: string; workspaceId: string; request: LeadFinderRequestV3; llm: { provider: "anthropic" | "openai" | "gemini"; model: string; apiKey: string }; onProgress?: (progress: LeadFinderProgress) => Promise<void> | void };
export type LeadFinderRunResult = { leads: LeadFinderResultV3[]; stats: { discoveredCompanies: number; dedupedCompanies: number; reviewedCompanies: number; acceptedLeads: number; crawlerRuns: number; pagesCrawled: number; verificationRuns: number; estimatedCostUsd: number }; continuation?: { needed: boolean; state?: Record<string, unknown> } };
export interface LeadFinderEngine { run(input: LeadFinderRunInput): Promise<LeadFinderRunResult>; }
