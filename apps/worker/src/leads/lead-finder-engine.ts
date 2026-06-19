import { normalizeLeadFinderRequest, type LeadFinderRequestV3 } from "@sales-ai/shared";
import { ManagedV3LeadFinderEngine } from "./managed-v3-engine.js";
import type { LeadFinderEngine } from "./types.js";
export type LeadFinderEngineMode = "managed_v3" | "goose_v1" | "parallel_v1" | "mock";
export function selectLeadFinderEngine(mode: LeadFinderEngineMode | string | undefined): LeadFinderEngine { switch (mode) { case "managed_v3": case "mock": default: return new ManagedV3LeadFinderEngine(); } }
export function parseLeadFinderInput(input: unknown): LeadFinderRequestV3 { return normalizeLeadFinderRequest(input); }
