import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthResult } from "@/lib/api/resolve-auth";
import { sha256 } from "@/lib/server-crypto";
import { getServiceRoleClient } from "@/lib/supabase/admin";

export type BillingStatus =
  | "not_started"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

type OrgBillingRow = {
  org_id: string;
  stripe_price_id: string | null;
  billing_status: string | null;
  trial_start_at: string | null;
  trial_end_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type ApiKeyLookupRow = {
  org_id: string;
  status: string;
  expires_at: string | null;
};

export type BillingSnapshot = {
  orgId: string;
  stripePriceId: string | null;
  billingStatus: BillingStatus;
  trialStartAt: string | null;
  trialEndAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

const ACTIVE_BILLING_STATUSES = new Set<BillingStatus>(["trialing", "active"]);
const KNOWN_BILLING_STATUSES = new Set<BillingStatus>([
  "not_started",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

function normalizeBillingStatus(value: string | null | undefined): BillingStatus {
  if (!value) return "not_started";
  return KNOWN_BILLING_STATUSES.has(value as BillingStatus)
    ? (value as BillingStatus)
    : "not_started";
}

export function isBillingActiveStatus(status: BillingStatus): boolean {
  return ACTIVE_BILLING_STATUSES.has(status);
}

function mapBillingRow(orgId: string, row: OrgBillingRow | null): BillingSnapshot {
  return {
    orgId,
    stripePriceId: row?.stripe_price_id ?? null,
    billingStatus: normalizeBillingStatus(row?.billing_status),
    trialStartAt: row?.trial_start_at ?? null,
    trialEndAt: row?.trial_end_at ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    stripeCustomerId: row?.stripe_customer_id ?? null,
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
  };
}

async function fetchBillingRowForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<OrgBillingRow | null> {
  const { data, error } = await supabase
    .from("org_billing")
    .select(
      "org_id,stripe_price_id,billing_status,trial_start_at,trial_end_at,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id"
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing state: ${error.message}`);
  }

  return (data as OrgBillingRow | null) ?? null;
}

export async function getBillingSnapshotForOrg(orgId: string): Promise<BillingSnapshot> {
  const admin = getServiceRoleClient();
  const row = await fetchBillingRowForOrg(admin, orgId);
  return mapBillingRow(orgId, row);
}

export async function ensureBillingRecordForOrg(
  orgId: string,
  seed: Partial<Pick<BillingSnapshot, "stripeCustomerId" | "stripePriceId">> = {}
): Promise<void> {
  const admin = getServiceRoleClient();
  const nowIso = new Date().toISOString();
  const existingRow = await fetchBillingRowForOrg(admin, orgId);

  const upsertPayload: Record<string, unknown> = {
    org_id: orgId,
    updated_at: nowIso,
  };

  if (seed.stripeCustomerId) {
    upsertPayload.stripe_customer_id = seed.stripeCustomerId;
  }

  if (seed.stripePriceId) {
    upsertPayload.stripe_price_id = seed.stripePriceId;
  }

  if (!existingRow) {
    upsertPayload.billing_status = "not_started";
  }

  const { error } = await admin.from("org_billing").upsert(
    upsertPayload,
    { onConflict: "org_id" }
  );

  if (error) {
    throw new Error(`Failed to ensure billing row: ${error.message}`);
  }
}

function buildBillingRequiredResponse(request: Request, snapshot: BillingSnapshot): NextResponse {
  const origin = new URL(request.url).origin;
  const upgradeUrl = `${origin}/billing?intent=upgrade`;
  const portalUrl = `${origin}/billing?intent=manage`;

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "BILLING_REQUIRED",
        message:
          "Your organization does not currently have an active subscription. Start or resume billing to continue.",
        details: {
          orgId: snapshot.orgId,
          billingStatus: snapshot.billingStatus,
          trialEndAt: snapshot.trialEndAt,
          currentPeriodEnd: snapshot.currentPeriodEnd,
          upgradeUrl,
          portalUrl,
        },
      },
    },
    { status: 402 }
  );
}

async function resolveOrgIdFromApiKeyToken(token: string): Promise<string | null> {
  const admin = getServiceRoleClient();

  const { data, error } = await admin
    .from("api_keys")
    .select("org_id,status,expires_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve API key org: ${error.message}`);
  }

  const key = data as ApiKeyLookupRow | null;
  if (!key) return null;
  if (key.status !== "active") return null;
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) return null;

  return key.org_id;
}

export async function ensureBillingActiveForOrg(
  orgId: string,
  request: Request
): Promise<NextResponse | null> {
  const snapshot = await getBillingSnapshotForOrg(orgId);

  if (isBillingActiveStatus(snapshot.billingStatus)) {
    return null;
  }

  return buildBillingRequiredResponse(request, snapshot);
}

export async function ensureBillingActiveForSalesAuth(
  auth: AuthResult,
  request: Request
): Promise<NextResponse | null> {
  let orgId: string | null = null;

  if (auth?.type === "session") {
    orgId = auth.orgId;
  } else if (auth?.type === "apikey") {
    orgId = await resolveOrgIdFromApiKeyToken(auth.token);
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } },
        { status: 401 }
      );
    }
  }

  if (!orgId) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Unable to resolve organization" } },
      { status: 500 }
    );
  }

  return ensureBillingActiveForOrg(orgId, request);
}
