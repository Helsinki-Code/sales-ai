import { decryptText, executeSkill, type SalesEndpoint } from "@sales-ai/shared";
import type { Job } from "bullmq";
import { getEnv } from "./config.js";
import { redis } from "./redis.js";
import { supabaseAdmin } from "./supabase.js";
import { LeadsEngineError, runParallelLeadsEngine } from "./leads-engine.js";
import { consumeUnitsForJob, reverseUnitsForJob } from "./unit-billing.js";

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

async function pushEvent(
  jobId: string,
  workspaceId: string,
  stage: string,
  progress: number,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from("job_events").insert({
    job_id: jobId,
    workspace_id: workspaceId,
    stage,
    progress,
    message,
    metadata: metadata ?? {}
  });
}

export async function processSalesJob(job: Job<SalesJobPayload>): Promise<void> {
  const payload = job.data;
  const startedAt = Date.now();

  let lastStage = "";
  let lastProgress = -1;

  const updateRunningState = async (
    stage: string,
    progress: number,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> => {
    const clampedProgress = Math.max(0, Math.min(99, Math.round(progress)));
    const stageChanged = stage !== lastStage;
    const progressDelta = Math.abs(clampedProgress - lastProgress);

    if (!stageChanged && progressDelta < 3 && !metadata) return;

    lastStage = stage;
    lastProgress = clampedProgress;

    await supabaseAdmin
      .from("jobs")
      .update({ status: "running", stage, progress: clampedProgress })
      .eq("id", payload.jobId);

    await pushEvent(payload.jobId, payload.workspaceId, stage, clampedProgress, message, metadata);
  };

  await updateRunningState("starting", 5, "Worker picked up job.");

  let model = "managed-leads-v1";
  let resultData: unknown;
  let durationMs = 0;
  let tokens = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  };
  let parallelUsage = {
    apiCalls: 0,
    enrichmentRuns: 0,
    estimatedCostUsd: 0
  };
  let consumedUnits = {
    standardUnits: 0,
    leadUnits: 0
  };

  if (payload.endpoint === "leads" && env.LEADS_ENGINE_MODE === "parallel_v1") {
    const leadsResult = await runParallelLeadsEngine({
      jobId: payload.jobId,
      orgId: payload.orgId,
      workspaceId: payload.workspaceId,
      input: payload.input,
      onProgress: async ({ stage, progress, message, metadata }) => {
        await updateRunningState(stage, progress, message, metadata);
      }
    });

    resultData = leadsResult.leads;
    durationMs = Date.now() - startedAt;
    model = `managed:${leadsResult.stats.generatorUsed}`;
    parallelUsage = {
      apiCalls: leadsResult.stats.parallelApiCalls,
      enrichmentRuns: leadsResult.stats.taskRunIds.length,
      estimatedCostUsd: Number((leadsResult.stats.parallelApiCalls * 0.002).toFixed(6))
    };
  } else {
    const anthropicApiKey = await getWorkspaceApiKey(payload.workspaceId);
    await updateRunningState("resolving_model", 15, "Resolved workspace credentials.");

    model = await resolveModel(payload.workspaceId, payload.endpoint, payload.requestedModel);
    await updateRunningState("running_agent", 25, `Running endpoint ${payload.endpoint}...`);

    const result = await executeSkill({
      endpoint: payload.endpoint,
      userInput: payload.input,
      apiKey: anthropicApiKey,
      model,
      redis,
      onProgress: async ({ stage, progress, message }) => {
        await updateRunningState(stage, progress, message);
      }
    });

    resultData = result.data;
    durationMs = result.durationMs;
    tokens = {
      inputTokens: result.tokens.inputTokens ?? 0,
      outputTokens: result.tokens.outputTokens ?? 0,
      cacheCreationInputTokens: result.tokens.cacheCreationInputTokens ?? 0,
      cacheReadInputTokens: result.tokens.cacheReadInputTokens ?? 0
    };
  }

  await updateRunningState("billing_metering", 94, "Applying unit metering...");
  consumedUnits = await consumeUnitsForJob({
    orgId: payload.orgId,
    workspaceId: payload.workspaceId,
    apiKeyId: payload.apiKeyId,
    endpoint: payload.endpoint,
    requestId: payload.requestId,
    jobId: payload.jobId,
    resultData,
    fallbackPayload: payload.input,
    idempotencyKey: `job:${payload.jobId}:consume`,
    unitBasis: payload.endpoint === "leads" ? "per_result" : "per_request"
  });

  try {
    await supabaseAdmin.from("usage_events").insert({
      org_id: payload.orgId,
      workspace_id: payload.workspaceId,
      api_key_id: payload.apiKeyId,
      endpoint: payload.endpoint,
      model,
      input_tokens: tokens.inputTokens,
      output_tokens: tokens.outputTokens,
      cache_creation_input_tokens: tokens.cacheCreationInputTokens,
      cache_read_input_tokens: tokens.cacheReadInputTokens,
      duration_ms: durationMs,
      request_id: payload.requestId,
      status: "success",
      cost_usd: parallelUsage.estimatedCostUsd,
      token_cost_usd: 0,
      managed_estimated_cost_usd: parallelUsage.estimatedCostUsd,
      total_cost_usd: parallelUsage.estimatedCostUsd,
      parallel_api_calls: parallelUsage.apiCalls,
      parallel_enrichment_runs: parallelUsage.enrichmentRuns,
      parallel_estimated_cost_usd: parallelUsage.estimatedCostUsd,
      standard_units_consumed: consumedUnits.standardUnits,
      lead_units_consumed: consumedUnits.leadUnits
    });
  } catch (usageError) {
    await reverseUnitsForJob({
      orgId: payload.orgId,
      workspaceId: payload.workspaceId,
      apiKeyId: payload.apiKeyId,
      endpoint: payload.endpoint,
      requestId: payload.requestId,
      jobId: payload.jobId,
      consumed: consumedUnits,
      unitBasis: payload.endpoint === "leads" ? "per_result" : "per_request",
      idempotencyKey: `job:${payload.jobId}:reverse`,
      reason: "usage_event_insert_failed"
    });
    throw usageError;
  }

  await updateRunningState("persisting_result", 97, "Persisting final result...");

  await supabaseAdmin.from("jobs").update({
    status: "complete",
    stage: "complete",
    progress: 100,
    result_payload: resultData,
    completed_at: new Date().toISOString()
  }).eq("id", payload.jobId);

  await pushEvent(payload.jobId, payload.workspaceId, "complete", 100, "Job completed.");
}

export async function handleSalesJobFailure(job: Job<SalesJobPayload> | undefined, error: Error): Promise<void> {
  if (!job) return;
  const maybeCode = (error as Error & { code?: unknown }).code;
  const errorCode =
    error instanceof LeadsEngineError
      ? error.code
      : typeof maybeCode === "string"
      ? maybeCode
      : "UNKNOWN_ERROR";
  const errorMessage = `[${errorCode}] ${error.message}`;

  await supabaseAdmin.from("jobs").update({
    status: "failed",
    stage: "failed",
    progress: 100,
    error_message: errorMessage,
    completed_at: new Date().toISOString()
  }).eq("id", job.data.jobId);

  await pushEvent(job.data.jobId, job.data.workspaceId, "failed", 100, errorMessage, { errorCode });
}
