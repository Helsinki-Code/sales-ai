import type { LlmProvider, SalesEndpoint } from "@sales-ai/shared";

export type HermesRunnerEvent = {
  type: string;
  stage: string;
  progress: number;
  message: string;
  metadata?: Record<string, unknown>;
};

export type HermesRunnerResult = {
  data: unknown;
  raw_text: string;
  model: string;
  provider: string;
  duration_ms: number;
  token_usage?: Record<string, number>;
  tool_call_count?: number;
};

type RunHermesInput = {
  runnerUrl: string;
  runnerToken: string;
  runId: string;
  jobId: string;
  orgId: string;
  workspaceId: string;
  endpoint: SalesEndpoint;
  input: Record<string, unknown>;
  provider: LlmProvider;
  model: string;
  providerApiKey: string;
  maxIterations: number;
  maxTokens: number;
  onEvent: (event: HermesRunnerEvent) => Promise<void>;
};

function parseNdjsonLine(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function cloudRunIdentityToken(audience: string): Promise<string | null> {
  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`;
  try {
    const response = await fetch(metadataUrl, { headers: { "Metadata-Flavor": "Google" } });
    return response.ok ? (await response.text()).trim() || null : null;
  } catch {
    return null;
  }
}

export async function runHermes(input: RunHermesInput): Promise<HermesRunnerResult> {
  const runnerOrigin = input.runnerUrl.replace(/\/$/, "");
  const identityToken = await cloudRunIdentityToken(runnerOrigin);
  const response = await fetch(`${runnerOrigin}/internal/v1/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hermes-runner-token": input.runnerToken,
      ...(identityToken ? { authorization: `Bearer ${identityToken}` } : {})
    },
    body: JSON.stringify({
      run_id: input.runId,
      job_id: input.jobId,
      org_id: input.orgId,
      workspace_id: input.workspaceId,
      endpoint: input.endpoint,
      input: input.input,
      provider: input.provider,
      model: input.model,
      provider_api_key: input.providerApiKey,
      max_iterations: input.maxIterations,
      max_tokens: input.maxTokens,
      // A bounded failure is preferable to a job that appears stuck in the UI.
      max_runtime_seconds: 120
    })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Hermes runner request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: HermesRunnerResult | null = null;

  const handleLine = async (line: string): Promise<void> => {
    const payload = parseNdjsonLine(line);
    if (!payload) return;
    if (payload.kind === "event") {
      await input.onEvent({
        type: String(payload.type ?? "agent.event"),
        stage: String(payload.stage ?? "running_agent"),
        progress: Number(payload.progress ?? 50),
        message: String(payload.message ?? "Hermes agent activity."),
        metadata: payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>) : {}
      });
      return;
    }
    if (payload.kind === "error") throw new Error(String(payload.message ?? "Hermes runner failed."));
    if (payload.kind === "result") {
      result = {
        data: payload.data,
        raw_text: String(payload.raw_text ?? ""),
        model: String(payload.model ?? input.model),
        provider: String(payload.provider ?? input.provider),
        duration_ms: Number(payload.duration_ms ?? 0),
        token_usage: payload.token_usage && typeof payload.token_usage === "object" ? (payload.token_usage as Record<string, number>) : {},
        tool_call_count: Number(payload.tool_call_count ?? 0)
      };
    }
  };

  while (true) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) await handleLine(line);
  }
  if (buffer.trim()) await handleLine(buffer);
  if (!result) throw new Error("Hermes runner ended without a result.");
  return result;
}
