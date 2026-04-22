import type { SalesEndpoint } from "@sales-ai/shared";
import {
  computeConsumedUnits,
  estimatePreflightUnits,
  getEndpointUnitPolicy,
  type UnitCount
} from "@sales-ai/shared";
import { supabaseAdmin } from "../lib/supabase.js";

type RemainingUnitsRow = {
  remaining_standard_units: number | null;
  remaining_lead_units: number | null;
  cycle_end_at: string | null;
};

type ConsumeResultRow = {
  remaining_standard_units: number | null;
  remaining_lead_units: number | null;
  cycle_end_at: string | null;
};

export type RemainingUnitsSnapshot = {
  remainingStandardUnits: number;
  remainingLeadUnits: number;
  nextCycleAt: string | null;
};

export type UnitConsumptionInput = {
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  endpoint: SalesEndpoint;
  requestId: string;
  jobId?: string;
  resultData: unknown;
  fallbackPayload?: Record<string, unknown>;
  idempotencyKey: string;
  unitBasis: string;
};

export type UnitPreflightCheck = {
  estimatedUnits: UnitCount;
  remaining: RemainingUnitsSnapshot;
};

export class InsufficientUnitsError extends Error {
  readonly code = "INSUFFICIENT_UNITS";
  readonly remaining: RemainingUnitsSnapshot;
  readonly required: UnitCount;

  constructor(remaining: RemainingUnitsSnapshot, required: UnitCount) {
    super("Not enough units remaining for this operation.");
    this.remaining = remaining;
    this.required = required;
  }
}

export class BillingNotConfiguredError extends Error {
  readonly code = "BILLING_NOT_CONFIGURED";

  constructor() {
    super("Billing record is not configured for this organization.");
  }
}

function clampCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function toSnapshot(row: RemainingUnitsRow | ConsumeResultRow | null): RemainingUnitsSnapshot {
  return {
    remainingStandardUnits: clampCount(row?.remaining_standard_units ?? 0),
    remainingLeadUnits: clampCount(row?.remaining_lead_units ?? 0),
    nextCycleAt: row?.cycle_end_at ?? null
  };
}

function extractRpcMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown billing rpc error";
  const maybe = error as { message?: unknown };
  return typeof maybe.message === "string" ? maybe.message : "Unknown billing rpc error";
}

function classifyRpcError(message: string, remaining: RemainingUnitsSnapshot, required: UnitCount): never {
  if (message.includes("INSUFFICIENT_UNITS")) {
    throw new InsufficientUnitsError(remaining, required);
  }
  if (message.includes("BILLING_ROW_NOT_FOUND")) {
    throw new BillingNotConfiguredError();
  }
  throw new Error(message);
}

export async function getRemainingUnits(orgId: string): Promise<RemainingUnitsSnapshot> {
  const { data, error } = await supabaseAdmin.rpc("get_remaining_billing_units", { p_org_id: orgId });
  if (error) {
    throw new Error(`Failed to load remaining units: ${error.message}`);
  }

  const row = Array.isArray(data) ? ((data[0] as RemainingUnitsRow | undefined) ?? null) : null;
  return toSnapshot(row);
}

export async function ensureUnitsAvailableForRequest(
  orgId: string,
  endpoint: SalesEndpoint,
  payload: Record<string, unknown>
): Promise<UnitPreflightCheck> {
  const estimatedUnits = estimatePreflightUnits(endpoint, payload);
  const remaining = await getRemainingUnits(orgId);

  if (
    estimatedUnits.standardUnits > remaining.remainingStandardUnits ||
    estimatedUnits.leadUnits > remaining.remainingLeadUnits
  ) {
    throw new InsufficientUnitsError(remaining, estimatedUnits);
  }

  return { estimatedUnits, remaining };
}

export async function consumeUnitsForCompletion(input: UnitConsumptionInput): Promise<UnitCount> {
  const consumed = computeConsumedUnits(input.endpoint, input.resultData, input.fallbackPayload);
  if (consumed.standardUnits === 0 && consumed.leadUnits === 0) {
    return consumed;
  }

  const policy = getEndpointUnitPolicy(input.endpoint);
  const fallbackRemaining = await getRemainingUnits(input.orgId);
  const { error } = await supabaseAdmin.rpc("consume_billing_units", {
    p_org_id: input.orgId,
    p_workspace_id: input.workspaceId,
    p_api_key_id: input.apiKeyId ?? null,
    p_job_id: input.jobId ?? null,
    p_request_id: input.requestId,
    p_endpoint: input.endpoint,
    p_units_standard: consumed.standardUnits,
    p_units_lead: consumed.leadUnits,
    p_unit_basis: input.unitBasis || policy.meterMode,
    p_idempotency_key: input.idempotencyKey
  });

  if (error) {
    classifyRpcError(extractRpcMessage(error), fallbackRemaining, consumed);
  }

  return consumed;
}

export async function reverseConsumedUnits(input: {
  orgId: string;
  workspaceId: string;
  apiKeyId?: string;
  jobId?: string;
  requestId: string;
  endpoint: SalesEndpoint;
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
    p_job_id: input.jobId ?? null,
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
