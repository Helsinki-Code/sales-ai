import { z } from "zod";

export const salesEndpoints = [
  "quick",
  "research",
  "qualify",
  "contacts",
  "outreach",
  "followup",
  "prep",
  "proposal",
  "objections",
  "icp",
  "competitors",
  "prospect",
  "leads",
  "report",
  "report-pdf"
] as const;

export type SalesEndpoint = (typeof salesEndpoints)[number];
export const llmProviders = ["anthropic", "openai", "gemini"] as const;
export type LlmProvider = (typeof llmProviders)[number];

export const asyncSalesEndpoints: SalesEndpoint[] = ["prospect", "leads", "report", "report-pdf"];
export const syncSalesEndpoints: SalesEndpoint[] = salesEndpoints.filter(
  (endpoint) => !asyncSalesEndpoints.includes(endpoint)
) as SalesEndpoint[];

export const requestContextSchema = z.object({
  requestId: z.string(),
  workspaceId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  apiKeyId: z.string().uuid().optional(),
  endpoint: z.string()
});

export type RequestContext = z.infer<typeof requestContextSchema>;

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
};

export type RunAgentResult<T = unknown> = {
  data: T;
  rawText: string;
  model: string;
  provider?: LlmProvider;
  tokens: TokenUsage;
  durationMs: number;
  toolCalls: number;
};

export type ToolResult = {
  type: "text";
  text: string;
};

export type JobStatus = "queued" | "running" | "complete" | "failed" | "cancelled";
