import { supabaseAdmin } from "../lib/supabase.js";
import type { TokenUsage } from "@sales-ai/shared";

export async function recordUsageEvent(input: {
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: string;
  model: string;
  tokens: TokenUsage;
  durationMs: number;
  requestId: string;
  status: "success" | "failed";
  costUsd?: number;
}): Promise<void> {
  await supabaseAdmin.from("usage_events").insert({
    org_id: input.orgId,
    workspace_id: input.workspaceId,
    api_key_id: input.apiKeyId,
    endpoint: input.endpoint,
    model: input.model,
    input_tokens: input.tokens.inputTokens ?? 0,
    output_tokens: input.tokens.outputTokens ?? 0,
    cache_creation_input_tokens: input.tokens.cacheCreationInputTokens ?? 0,
    cache_read_input_tokens: input.tokens.cacheReadInputTokens ?? 0,
    duration_ms: input.durationMs,
    request_id: input.requestId,
    status: input.status,
    cost_usd: input.costUsd ?? null
  });
}