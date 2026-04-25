import { decryptText, executeSkill, llmProviders, type LlmProvider, type SalesEndpoint } from "@sales-ai/shared";
import { Queue, type Job } from "bullmq";
import { getEnv } from "./config.js";
import { redis } from "./redis.js";
import { supabaseAdmin } from "./supabase.js";
import { LeadsEngineError as ParallelLeadsEngineError, runParallelLeadsEngine } from "./leads-engine.js";
import { LeadsEngineError as GooseLeadsEngineError, runGooseLeadsEngine } from "./goose-leads-engine.js";
import { consumeUnitsForJob, reverseUnitsForJob } from "./unit-billing.js";

export type SalesJobPayload = {
  jobId: string;
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: SalesEndpoint;
  input: Record<string, unknown>;
  requestedProvider?: LlmProvider;
  requestedModel?: string;
  requestId: string;
};

const env = getEnv();
const queueName = "sales-jobs";
const salesQueue = new Queue<SalesJobPayload>(queueName, {
  connection: redis,
  prefix: env.BULLMQ_PREFIX,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    }
  }
});

async function getWorkspaceApiKey(workspaceId: string, provider: LlmProvider): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("provider_credentials")
    .select("api_key_encrypted,status")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data || data.status !== "active") {
    throw new Error(`Workspace ${provider} key is not configured.`);
  }

  return decryptText(data.api_key_encrypted, env.INTERNAL_ENCRYPTION_KEY);
}

async function resolveModelPolicy(
  workspaceId: string,
  endpoint: string,
  requestedProvider?: LlmProvider,
  requestedModel?: string
): Promise<{ provider: LlmProvider; model: string }> {
  const { data } = await supabaseAdmin
    .from("workspace_model_policies")
    .select("default_provider,allowed_providers,default_model,allowed_models")
    .eq("workspace_id", workspaceId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  const allowedProviders = Array.isArray(data?.allowed_providers)
    ? data.allowed_providers
        .filter((value): value is string => typeof value === "string")
        .filter((value) => (llmProviders as readonly string[]).includes(value))
    : ["anthropic"];
  const defaultProvider =
    typeof data?.default_provider === "string" && (llmProviders as readonly string[]).includes(data.default_provider)
      ? (data.default_provider as LlmProvider)
      : "anthropic";

  const provider = requestedProvider ?? defaultProvider;
  if (!allowedProviders.includes(provider)) {
    throw new Error(`Requested provider ${provider} is not allowed.`);
  }

  const defaultModelByProvider: Record<LlmProvider, string> = {
    anthropic: "claude-sonnet-4-5",
    openai: "gpt-5.4",
    gemini: "gemini-2.5-pro"
  };

  const defaultModel =
    typeof data?.default_model === "string" && data.default_model.trim().length > 0
      ? data.default_model
      : defaultModelByProvider[provider];
  const allowed = Array.isArray(data?.allowed_models)
    ? data.allowed_models.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [defaultModel];

  if (requestedModel) {
    if (!allowed.includes(requestedModel)) throw new Error(`Requested model ${requestedModel} is not allowed.`);
    return { provider, model: requestedModel };
  }
  return { provider, model: defaultModel };
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
  let provider: LlmProvider = "anthropic";
  let resultData: unknown;
  let durationMs = 0;
  let tokens = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0
  };
  let managedUsage = {
    crawlerRuns: 0,
    pagesCrawled: 0,
    verificationRuns: 0,
    cycleCount: 0,
    estimatedCostUsd: 0
  };
  let consumedUnits = {
    standardUnits: 0,
    leadUnits: 0
  };

  if (payload.endpoint === "leads" && env.LEADS_ENGINE_MODE === "goose_v1") {
    const resolved = await resolveModelPolicy(
      payload.workspaceId,
      payload.endpoint,
      payload.requestedProvider,
      payload.requestedModel
    );
    provider = resolved.provider;
    model = resolved.model;
    const apiKey = await getWorkspaceApiKey(payload.workspaceId, provider);

    const leadsResult = await runGooseLeadsEngine({
      jobId: payload.jobId,
      orgId: payload.orgId,
      workspaceId: payload.workspaceId,
      llm: {
        provider,
        model,
        apiKey
      },
      input: payload.input,
      onProgress: async ({ stage, progress, message, metadata }) => {
        await updateRunningState(stage, progress, message, metadata);
      }
    });

    resultData = leadsResult.leads;
    durationMs = Date.now() - startedAt;
    model = `${provider}:${resolved.model}`;
    managedUsage = {
      crawlerRuns: leadsResult.stats.crawlerRuns,
      pagesCrawled: leadsResult.stats.pagesCrawled,
      verificationRuns: leadsResult.stats.enrichmentAttempts,
      cycleCount: leadsResult.stats.cycleIndex,
      estimatedCostUsd: Number(
        (leadsResult.stats.crawlerRuns * 0.003 + leadsResult.stats.enrichmentAttempts * 0.002).toFixed(6)
      )
    };

    if (leadsResult.cancelled) {
      await supabaseAdmin
        .from("jobs")
        .update({
          status: "cancelled",
          stage: "cancelled",
          progress: 100,
          completed_at: new Date().toISOString()
        })
        .eq("id", payload.jobId);
      await pushEvent(payload.jobId, payload.workspaceId, "cancelled", 100, "Job cancelled by user.");
      return;
    }

    if (leadsResult.needsContinuation && leadsResult.continuationState) {
      const continuationSliceIndex = leadsResult.sliceIndex + 1;
      const nextInput = {
        ...payload.input,
        __goose_state: leadsResult.continuationState
      };
      const { data: jobRow } = await supabaseAdmin
        .from("jobs")
        .select("status")
        .eq("id", payload.jobId)
        .maybeSingle();
      if (jobRow?.status === "cancelled") {
        await pushEvent(payload.jobId, payload.workspaceId, "cancelled", 100, "Job cancelled by user.");
        return;
      }

      await updateRunningState(
        "continuation_enqueue",
        95,
        `Slice ${leadsResult.sliceIndex} complete. Queueing continuation slice ${continuationSliceIndex}.`,
        {
          continuation_slice_index: continuationSliceIndex,
          accepted_so_far: leadsResult.leads.length,
          missing_count: Math.max(0, Number(payload.input.count ?? 0) - leadsResult.leads.length),
          rejection_by_reason: leadsResult.rejectionByReason,
          enrichment_attempts: leadsResult.stats.enrichmentAttempts,
          enrichment_successes: leadsResult.stats.enrichmentSuccesses
        }
      );

      await salesQueue.add(
        "sales-job",
        {
          ...payload,
          input: nextInput,
          requestedProvider: resolved.provider,
          requestedModel: resolved.model
        },
        {
          jobId: `${payload.jobId}:slice:${continuationSliceIndex}:${Date.now()}`
        }
      );

      await supabaseAdmin
        .from("jobs")
        .update({
          status: "running",
          stage: "running",
          progress: 92
        })
        .eq("id", payload.jobId);

      await pushEvent(
        payload.jobId,
        payload.workspaceId,
        "running",
        92,
        `Continuation slice ${continuationSliceIndex} queued.`,
        {
          continuation_slice_index: continuationSliceIndex,
          accepted_so_far: leadsResult.leads.length,
          missing_count: Math.max(0, Number(payload.input.count ?? 0) - leadsResult.leads.length),
          rejection_by_reason: leadsResult.rejectionByReason
        }
      );
      return;
    }
  } else if (payload.endpoint === "leads" && env.LEADS_ENGINE_MODE === "parallel_v1") {
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
    managedUsage = {
      crawlerRuns: leadsResult.stats.parallelApiCalls,
      pagesCrawled: 0,
      verificationRuns: leadsResult.stats.taskRunIds.length,
      cycleCount: leadsResult.stats.cyclesCompleted,
      estimatedCostUsd: Number((leadsResult.stats.parallelApiCalls * 0.002).toFixed(6))
    };
  } else {
    const resolved = await resolveModelPolicy(
      payload.workspaceId,
      payload.endpoint,
      payload.requestedProvider,
      payload.requestedModel
    );
    provider = resolved.provider;
    model = resolved.model;
    const providerApiKey = await getWorkspaceApiKey(payload.workspaceId, provider);
    await updateRunningState("resolving_model", 15, "Resolved workspace credentials.");
    await updateRunningState("running_agent", 25, `Running endpoint ${payload.endpoint}...`);

    const result = await executeSkill({
      endpoint: payload.endpoint,
      userInput: payload.input,
      apiKey: providerApiKey,
      provider,
      model,
      redis,
      onProgress: async ({ stage, progress, message }) => {
        await updateRunningState(stage, progress, message);
      }
    });

    resultData = result.data;
    durationMs = result.durationMs;
    model = `${provider}:${result.model}`;
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
      cost_usd: managedUsage.estimatedCostUsd,
      token_cost_usd: 0,
      managed_estimated_cost_usd: managedUsage.estimatedCostUsd,
      total_cost_usd: managedUsage.estimatedCostUsd,
      parallel_api_calls: managedUsage.crawlerRuns,
      parallel_enrichment_runs: managedUsage.verificationRuns,
      parallel_estimated_cost_usd: managedUsage.estimatedCostUsd,
      managed_crawler_runs: managedUsage.crawlerRuns,
      managed_pages_crawled: managedUsage.pagesCrawled,
      managed_verification_runs: managedUsage.verificationRuns,
      managed_cycle_count: managedUsage.cycleCount,
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
    error instanceof ParallelLeadsEngineError || error instanceof GooseLeadsEngineError
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
