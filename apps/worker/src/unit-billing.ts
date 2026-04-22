import type { SalesEndpoint } from "@sales-ai/shared";
import { computeConsumedUnits, type UnitCount } from "@sales-ai/shared";
import { supabaseAdmin } from "./supabase.js";

function messageFromError(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown billing rpc error";
  const maybe = error as { message?: unknown };
  return typeof maybe.message === "string" ? maybe.message : "Unknown billing rpc error";
}

export async function consumeUnitsForJob(input: {
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: SalesEndpoint;
  requestId: string;
  jobId: string;
  resultData: unknown;
  fallbackPayload?: Record<string, unknown>;
  idempotencyKey: string;
  unitBasis: string;
}): Promise<UnitCount> {
  const consumed = computeConsumedUnits(input.endpoint, input.resultData, input.fallbackPayload);
  if (consumed.standardUnits === 0 && consumed.leadUnits === 0) {
    return consumed;
  }

  const { error } = await supabaseAdmin.rpc("consume_billing_units", {
    p_org_id: input.orgId,
    p_workspace_id: input.workspaceId,
    p_api_key_id: input.apiKeyId ?? null,
    p_job_id: input.jobId,
    p_request_id: input.requestId,
    p_endpoint: input.endpoint,
    p_units_standard: consumed.standardUnits,
    p_units_lead: consumed.leadUnits,
    p_unit_basis: input.unitBasis,
    p_idempotency_key: input.idempotencyKey
  });

  if (error) {
    throw new Error(messageFromError(error));
  }

  return consumed;
}

export async function reverseUnitsForJob(input: {
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: SalesEndpoint;
  requestId: string;
  jobId: string;
  consumed: UnitCount;
  unitBasis: string;
  idempotencyKey: string;
  reason: string;
}): Promise<void> {
  if (input.consumed.standardUnits === 0 && input.consumed.leadUnits === 0) {
    return;
  }

  const { error } = await supabaseAdmin.rpc("reverse_billing_unit_consumption", {
    p_org_id: input.orgId,
    p_workspace_id: input.workspaceId,
    p_api_key_id: input.apiKeyId ?? null,
    p_job_id: input.jobId,
    p_request_id: input.requestId,
    p_endpoint: input.endpoint,
    p_units_standard: input.consumed.standardUnits,
    p_units_lead: input.consumed.leadUnits,
    p_unit_basis: input.unitBasis,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: { reason: input.reason }
  });

  if (error) {
    throw new Error(`Failed to reverse consumed units: ${error.message}`);
  }
}
