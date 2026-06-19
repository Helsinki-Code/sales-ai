import type { LlmProvider, SalesEndpoint } from "@sales-ai/shared";
import { getEnv } from "../config/env.js";

type HermesResult = {
  data: unknown;
  model: string;
  durationMs: number;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
};

export function shouldUseHermes(endpoint: SalesEndpoint): boolean {
  const env = getEnv();
  if (env.AGENT_ENGINE !== "hermes") return false;
  const endpoints = env.HERMES_ENDPOINTS.split(",").map((value) => value.trim()).filter(Boolean);
  return endpoints.includes("*") || endpoints.includes(endpoint);
}

export async function runHermesSalesSkill(input: {
  runId: string;
  orgId: string;
  workspaceId: string;
  endpoint: SalesEndpoint;
  payload: Record<string, unknown>;
  provider: LlmProvider;
  model: string;
  providerApiKey: string;
}): Promise<HermesResult> {
  const env = getEnv();
  const response = await fetch(`${env.HERMES_RUNNER_URL!.replace(/\/$/, "")}/internal/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hermes-runner-token": env.HERMES_RUNNER_TOKEN! },
    body: JSON.stringify({
      run_id: input.runId,
      org_id: input.orgId,
      workspace_id: input.workspaceId,
      endpoint: input.endpoint,
      input: input.payload,
      provider: input.provider,
      model: input.model,
      provider_api_key: input.providerApiKey,
      max_iterations: env.HERMES_MAX_ITERATIONS,
      max_tokens: env.HERMES_MAX_TOKENS
    })
  });
  if (!response.ok || !response.body) throw new Error(`Hermes runner request failed (${response.status}).`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: HermesResult | null = null;
  const readLine = (line: string): void => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Record<string, unknown>;
    if (event.kind === "error") throw new Error(String(event.message ?? "Hermes runner failed."));
    if (event.kind !== "result") return;
    const tokens = (event.token_usage ?? {}) as Record<string, unknown>;
    result = {
      data: event.data,
      model: String(event.model ?? input.model),
      durationMs: Number(event.duration_ms ?? 0),
      tokens: {
        inputTokens: Number(tokens.input_tokens ?? tokens.inputTokens ?? 0),
        outputTokens: Number(tokens.output_tokens ?? tokens.outputTokens ?? 0),
        cacheCreationInputTokens: Number(tokens.cache_creation_input_tokens ?? 0),
        cacheReadInputTokens: Number(tokens.cache_read_input_tokens ?? 0)
      }
    };
  };
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(readLine);
  }
  readLine(buffer);
  if (!result) throw new Error("Hermes runner ended without a result.");
  return result;
}

export async function cancelHermesRun(runId: string): Promise<void> {
  const env = getEnv();
  if (env.AGENT_ENGINE !== "hermes") return;
  const response = await fetch(`${env.HERMES_RUNNER_URL!.replace(/\/$/, "")}/internal/v1/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    headers: { "x-hermes-runner-token": env.HERMES_RUNNER_TOKEN! }
  });
  if (!response.ok) throw new Error(`Hermes runner cancellation failed (${response.status}).`);
}
