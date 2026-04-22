import type { SalesEndpoint } from "../types.js";

export type BillingUnitClass = "standard" | "lead";
export type BillingMeterMode = "per_request" | "per_result";

export type EndpointUnitPolicy = {
  endpoint: SalesEndpoint;
  unitClass: BillingUnitClass;
  meterMode: BillingMeterMode;
  units: number;
};

export type UnitCount = {
  standardUnits: number;
  leadUnits: number;
};

const POLICY_LIST: EndpointUnitPolicy[] = [
  { endpoint: "quick", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "research", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "qualify", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "contacts", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "outreach", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "followup", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "prep", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "proposal", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "objections", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "icp", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "competitors", unitClass: "standard", meterMode: "per_request", units: 1 },
  { endpoint: "prospect", unitClass: "standard", meterMode: "per_request", units: 5 },
  { endpoint: "report", unitClass: "standard", meterMode: "per_request", units: 5 },
  { endpoint: "report-pdf", unitClass: "standard", meterMode: "per_request", units: 5 },
  { endpoint: "leads", unitClass: "lead", meterMode: "per_result", units: 1 }
];

const POLICY_BY_ENDPOINT = new Map<SalesEndpoint, EndpointUnitPolicy>(
  POLICY_LIST.map((policy) => [policy.endpoint, policy])
);

function clampNonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function listEndpointUnitPolicies(): EndpointUnitPolicy[] {
  return [...POLICY_LIST];
}

export function getEndpointUnitPolicy(endpoint: SalesEndpoint): EndpointUnitPolicy {
  const policy = POLICY_BY_ENDPOINT.get(endpoint);
  if (!policy) {
    throw new Error(`Missing billing unit policy for endpoint: ${endpoint}`);
  }
  return policy;
}

export function estimatePreflightUnits(endpoint: SalesEndpoint, payload: Record<string, unknown>): UnitCount {
  const policy = getEndpointUnitPolicy(endpoint);

  if (policy.unitClass === "lead") {
    const requestedCount = clampNonNegativeInt(payload.count);
    const estimatedLeadUnits = Math.max(requestedCount, 0);
    return { standardUnits: 0, leadUnits: estimatedLeadUnits };
  }

  return { standardUnits: policy.units, leadUnits: 0 };
}

function extractReturnedLeadCount(resultData: unknown): number {
  if (Array.isArray(resultData)) {
    return resultData.length;
  }

  if (resultData && typeof resultData === "object") {
    const maybeLeads = (resultData as { leads?: unknown }).leads;
    if (Array.isArray(maybeLeads)) {
      return maybeLeads.length;
    }
  }

  return 0;
}

export function computeConsumedUnits(
  endpoint: SalesEndpoint,
  resultData: unknown,
  fallbackPayload?: Record<string, unknown>
): UnitCount {
  const policy = getEndpointUnitPolicy(endpoint);

  if (policy.unitClass === "lead") {
    const returnedLeadCount = extractReturnedLeadCount(resultData);
    if (returnedLeadCount > 0) {
      return { standardUnits: 0, leadUnits: returnedLeadCount * policy.units };
    }

    if (fallbackPayload) {
      return estimatePreflightUnits(endpoint, fallbackPayload);
    }

    return { standardUnits: 0, leadUnits: 0 };
  }

  return { standardUnits: policy.units, leadUnits: 0 };
}
