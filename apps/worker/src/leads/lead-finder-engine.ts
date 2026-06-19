import { normalizeLeadFinderRequest, type LeadFinderRequestV3 } from "@sales-ai/shared";
import { ManagedV3LeadFinderEngine } from "./managed-v3-engine.js";
import type { LeadFinderEngine } from "./types.js";
export type LeadFinderEngineMode = "managed_v3" | "goose_v1" | "parallel_v1" | "mock";
export function selectLeadFinderEngine(mode: LeadFinderEngineMode | string | undefined): LeadFinderEngine {
  switch (mode) {
    case "mock":
      return new ManagedV3LeadFinderEngine();
    case "managed_v3":
      throw new Error("LEADS_ENGINE_MODE=managed_v3 is a placeholder/mock lead engine and is disabled for production. Configure LEADS_ENGINE_MODE=goose_v1 with FIRECRAWL_API_KEY and APIFY_TOKEN for real lead generation.");
    default:
      throw new Error(`Unsupported lead finder engine mode: ${mode ?? "unset"}. Use LEADS_ENGINE_MODE=goose_v1 for real lead generation.`);
  }
}
export function parseLeadFinderInput(input: unknown): LeadFinderRequestV3 { return normalizeLeadFinderRequest(input); }
