import type { LlmProvider, SalesEndpoint } from "@sales-ai/shared";
import { supabaseAdmin } from "./supabase.js";

export async function startAgentRun(input: {
  id: string;
  jobId: string;
  orgId: string;
  workspaceId: string;
  endpoint: SalesEndpoint;
  provider: LlmProvider;
  model: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("agent_runs")
    .select("id")
    .eq("job_id", input.jobId)
    .maybeSingle();
  if (lookupError) throw new Error(`Failed to look up agent run: ${lookupError.message}`);

  const values = {
    org_id: input.orgId,
    workspace_id: input.workspaceId,
    engine: "hermes",
    engine_version: "3485bc72251993ff7fb4d31bb03a64e836901415",
    workflow: input.endpoint,
    provider: input.provider,
    model: input.model,
    status: "running",
    input_payload: input.payload,
    started_at: new Date().toISOString(),
    error_message: null
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin.from("agent_runs").update(values).eq("id", existing.id);
    if (error) throw new Error(`Failed to restart agent run: ${error.message}`);
    return existing.id;
  }

  const { error } = await supabaseAdmin.from("agent_runs").insert({ id: input.id, job_id: input.jobId, ...values });
  if (error) throw new Error(`Failed to start agent run: ${error.message}`);
  return input.id;
}

export async function recordAgentEvent(input: {
  runId: string;
  type: string;
  status: "started" | "complete" | "failed" | "blocked";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("agent_tool_calls").insert({
    agent_run_id: input.runId,
    tool_name: input.type,
    status: input.status,
    request_summary: input.metadata ?? {},
    response_summary: {}
  });
  if (error) throw new Error(`Failed to record agent event: ${error.message}`);
}

export async function completeAgentRun(input: {
  runId: string;
  jobId: string;
  orgId: string;
  workspaceId: string;
  data: unknown;
  tokenUsage: Record<string, number>;
  toolCallCount: number;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("agent_runs").update({
    status: "complete",
    output_payload: input.data,
    token_usage: input.tokenUsage,
    tool_call_count: input.toolCallCount,
    completed_at: now
  }).eq("id", input.runId);
  if (error) throw new Error(`Failed to complete agent run: ${error.message}`);
  const artifact = await supabaseAdmin.from("agent_artifacts").insert({
    agent_run_id: input.runId,
    job_id: input.jobId,
    org_id: input.orgId,
    workspace_id: input.workspaceId,
    artifact_type: "sales_result",
    payload: input.data,
    evidence: []
  });
  if (artifact.error) throw new Error(`Failed to persist agent artifact: ${artifact.error.message}`);
}

export async function failAgentRun(runId: string, message: string): Promise<void> {
  await supabaseAdmin.from("agent_runs").update({
    status: "failed",
    error_message: message.slice(0, 4000),
    completed_at: new Date().toISOString()
  }).eq("id", runId);
}
