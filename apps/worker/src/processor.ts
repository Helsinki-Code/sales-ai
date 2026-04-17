import { decryptText, executeSkill, type SalesEndpoint } from "@sales-ai/shared";
import type { Job } from "bullmq";
import { getEnv } from "./config.js";
import { redis } from "./redis.js";
import { supabaseAdmin } from "./supabase.js";

export type SalesJobPayload = {
  jobId: string;
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: SalesEndpoint;
  input: Record<string, unknown>;
  requestedModel?: string;
  requestId: string;
};

const env = getEnv();

async function getWorkspaceApiKey(workspaceId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("provider_credentials")
    .select("api_key_encrypted,status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "anthropic")
    .maybeSingle();

  if (error || !data || data.status !== "active") {
    throw new Error("Workspace Anthropic key is not configured.");
  }

  return decryptText(data.api_key_encrypted, env.INTERNAL_ENCRYPTION_KEY);
}

async function resolveModel(workspaceId: string, endpoint: string, requestedModel?: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("workspace_model_policies")
    .select("default_model,allowed_models")
    .eq("workspace_id", workspaceId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  const allowed = (data?.allowed_models as string[] | null) ?? ["claude-sonnet-4-5"];
  const defaultModel = data?.default_model ?? "claude-sonnet-4-5";
  if (requestedModel) {
    if (!allowed.includes(requestedModel)) throw new Error(`Requested model ${requestedModel} is not allowed.`);
    return requestedModel;
  }
  return defaultModel;
}

async function pushEvent(jobId: string, workspaceId: string, stage: string, progress: number, message: string): Promise<void> {
  await supabaseAdmin.from("job_events").insert({
    job_id: jobId,
    workspace_id: workspaceId,
    stage,
    progress,
    message
  });
}

export async function processSalesJob(job: Job<SalesJobPayload>): Promise<void> {
  const payload = job.data;

  await supabaseAdmin.from("jobs").update({ status: "running", stage: "starting", progress: 5 }).eq("id", payload.jobId);
  await pushEvent(payload.jobId, payload.workspaceId, "starting", 5, "Worker picked up job.");

  const anthropicApiKey = await getWorkspaceApiKey(payload.workspaceId);
  const model = await resolveModel(payload.workspaceId, payload.endpoint, payload.requestedModel);

  await supabaseAdmin.from("jobs").update({ stage: "running_agent", progress: 30 }).eq("id", payload.jobId);

  const result = await executeSkill({
    endpoint: payload.endpoint,
    userInput: payload.input,
    apiKey: anthropicApiKey,
    model,
    redis
  });

  await supabaseAdmin.from("jobs").update({
    status: "complete",
    stage: "complete",
    progress: 100,
    result_payload: result.data,
    completed_at: new Date().toISOString()
  }).eq("id", payload.jobId);

  await pushEvent(payload.jobId, payload.workspaceId, "complete", 100, "Job completed.");

  await supabaseAdmin.from("usage_events").insert({
    org_id: payload.orgId,
    workspace_id: payload.workspaceId,
    api_key_id: payload.apiKeyId,
    endpoint: payload.endpoint,
    model,
    input_tokens: result.tokens.inputTokens ?? 0,
    output_tokens: result.tokens.outputTokens ?? 0,
    cache_creation_input_tokens: result.tokens.cacheCreationInputTokens ?? 0,
    cache_read_input_tokens: result.tokens.cacheReadInputTokens ?? 0,
    duration_ms: result.durationMs,
    request_id: payload.requestId,
    status: "success"
  });
}

export async function handleSalesJobFailure(job: Job<SalesJobPayload> | undefined, error: Error): Promise<void> {
  if (!job) return;
  await supabaseAdmin.from("jobs").update({
    status: "failed",
    stage: "failed",
    progress: 100,
    error_message: error.message,
    completed_at: new Date().toISOString()
  }).eq("id", job.data.jobId);

  await pushEvent(job.data.jobId, job.data.workspaceId, "failed", 100, error.message);
}