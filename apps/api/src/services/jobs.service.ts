import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase.js";

export async function findJobByIdempotency(
  workspaceId: string,
  endpoint: string,
  idempotencyKey: string
): Promise<{ id: string; status: string } | null> {
  const { data } = await supabaseAdmin
    .from("jobs")
    .select("id,status")
    .eq("workspace_id", workspaceId)
    .eq("endpoint", endpoint)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  return data ?? null;
}

export async function createJobRecord(input: {
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  requestId: string;
}): Promise<string> {
  const id = randomUUID();
  const { error } = await supabaseAdmin.from("jobs").insert({
    id,
    org_id: input.orgId,
    workspace_id: input.workspaceId,
    api_key_id: input.apiKeyId,
    endpoint: input.endpoint,
    status: "queued",
    input_payload: input.payload,
    idempotency_key: input.idempotencyKey,
    request_id: input.requestId
  });

  if (error) throw new Error(`Failed to create job record: ${error.message}`);

  await appendJobEvent(id, input.workspaceId, "queued", 0, "Job queued.");
  return id;
}

export async function appendJobEvent(
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

export async function getJob(jobId: string, workspaceId: string): Promise<any | null> {
  const { data } = await supabaseAdmin
    .from("jobs")
    .select("id,status,progress,stage,result_payload,error_message,created_at,updated_at")
    .eq("id", jobId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data;
}

export async function cancelJob(jobId: string, workspaceId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("jobs")
    .update({ status: "cancelled", stage: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  await appendJobEvent(jobId, workspaceId, "cancelled", 100, "Job cancelled by user.");
}