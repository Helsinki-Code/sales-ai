import type Stripe from "stripe";
import { resolvePlanFromPriceId } from "@/lib/billing/plans";
import { ensureBillingRecordForOrg } from "@/lib/billing/status";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import type { BillingStatus } from "@/lib/billing/status";

type BillingLookupRow = {
  org_id: string;
};

const STRIPE_STATUS_TO_BILLING_STATUS: Record<string, BillingStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  paused: "paused",
};

function toIsoTimestamp(unixSeconds: number | null): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function normalizeSubscriptionStatus(status: string | null | undefined): BillingStatus {
  if (!status) return "not_started";
  return STRIPE_STATUS_TO_BILLING_STATUS[status] ?? "not_started";
}

function extractCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id ?? null;
}

function parseUnitsValue(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

async function resolveOrgIdFromStripeIds(
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null
): Promise<string | null> {
  const admin = getServiceRoleClient();

  if (stripeSubscriptionId) {
    const { data, error } = await admin
      .from("org_billing")
      .select("org_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve org by subscription id: ${error.message}`);
    }

    const row = data as BillingLookupRow | null;
    if (row?.org_id) return row.org_id;
  }

  if (stripeCustomerId) {
    const { data, error } = await admin
      .from("org_billing")
      .select("org_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve org by customer id: ${error.message}`);
    }

    const row = data as BillingLookupRow | null;
    if (row?.org_id) return row.org_id;
  }

  return null;
}

export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from("billing_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check webhook idempotency: ${error.message}`);
  }

  return Boolean(data);
}

export async function recordStripeEventProcessed(
  event: Stripe.Event,
  orgId: string | null,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null
): Promise<void> {
  const admin = getServiceRoleClient();

  const { error } = await admin.from("billing_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    org_id: orgId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    payload: JSON.parse(JSON.stringify(event)),
  });

  if (error && error.code !== "23505") {
    throw new Error(`Failed to record webhook event: ${error.message}`);
  }
}

export async function syncOrgBillingFromSubscription(
  subscription: Stripe.Subscription,
  explicitOrgId: string | null = null,
  options?: { eventId?: string | null; eventType?: string | null }
): Promise<{ orgId: string | null; stripeCustomerId: string | null; stripeSubscriptionId: string }> {
  const admin = getServiceRoleClient();
  const stripeCustomerId = extractCustomerId(subscription.customer);
  const stripeSubscriptionId = subscription.id;
  const orgIdFromMetadata = subscription.metadata?.org_id || null;
  const orgId =
    explicitOrgId ||
    orgIdFromMetadata ||
    (await resolveOrgIdFromStripeIds(stripeCustomerId, stripeSubscriptionId));

  if (!orgId) {
    return { orgId: null, stripeCustomerId, stripeSubscriptionId };
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodStartUnix = subscription.items.data[0]?.current_period_start ?? null;
  const currentPeriodEndUnix = subscription.items.data[0]?.current_period_end ?? null;
  const nowIso = new Date().toISOString();

  const { error } = await admin.from("org_billing").upsert(
    {
      org_id: orgId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_price_id: priceId,
      billing_status: normalizeSubscriptionStatus(subscription.status),
      trial_start_at: toIsoTimestamp(subscription.trial_start),
      trial_end_at: toIsoTimestamp(subscription.trial_end),
      current_period_end: toIsoTimestamp(currentPeriodEndUnix),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      updated_at: nowIso,
    },
    { onConflict: "org_id" }
  );

  if (error) {
    throw new Error(`Failed to sync org billing from subscription: ${error.message}`);
  }

  const plan = resolvePlanFromPriceId(priceId);
  const canGrantCycleUnits =
    plan &&
    (subscription.status === "trialing" || subscription.status === "active") &&
    currentPeriodStartUnix &&
    currentPeriodEndUnix;

  if (canGrantCycleUnits) {
    const cycleStartIso = toIsoTimestamp(currentPeriodStartUnix);
    const cycleEndIso = toIsoTimestamp(currentPeriodEndUnix);

    if (cycleStartIso && cycleEndIso) {
      const idempotencyKey = [
        "stripe",
        "cycle",
        orgId,
        plan.plan,
        String(currentPeriodStartUnix),
        String(currentPeriodEndUnix),
      ].join(":");

      const { error: cycleError } = await admin.rpc("reset_billing_cycle_units", {
        p_org_id: orgId,
        p_plan_key: plan.plan,
        p_cycle_start_at: cycleStartIso,
        p_cycle_end_at: cycleEndIso,
        p_idempotency_key: idempotencyKey,
        p_metadata: {
          stripe_event_id: options?.eventId ?? null,
          stripe_event_type: options?.eventType ?? null,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: priceId,
        },
      });

      if (cycleError) {
        throw new Error(`Failed to reset billing cycle units: ${cycleError.message}`);
      }
    }
  }

  return { orgId, stripeCustomerId, stripeSubscriptionId };
}

export async function applyUnitPackPurchaseFromCheckoutSession(
  session: Stripe.Checkout.Session,
  options?: { eventId?: string | null; eventType?: string | null }
): Promise<{ orgId: string | null; stripeCustomerId: string | null; stripeSubscriptionId: string | null }> {
  const admin = getServiceRoleClient();
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  const metadata = session.metadata ?? {};
  const explicitOrgId = metadata.org_id || null;
  const orgId = explicitOrgId || (await resolveOrgIdFromStripeIds(stripeCustomerId, stripeSubscriptionId));
  if (!orgId) {
    return { orgId: null, stripeCustomerId, stripeSubscriptionId };
  }

  const unitsStandard = parseUnitsValue(metadata.units_standard);
  const unitsLead = parseUnitsValue(metadata.units_lead);
  if (unitsStandard <= 0 && unitsLead <= 0) {
    return { orgId, stripeCustomerId, stripeSubscriptionId };
  }

  await ensureBillingRecordForOrg(orgId, {
    stripeCustomerId,
  });

  const idempotencyKey = `stripe:pack:${session.id}`;
  const unitBasis = metadata.pack_key || "unit_pack";
  const { error } = await admin.rpc("credit_billing_units", {
    p_org_id: orgId,
    p_workspace_id: null,
    p_api_key_id: null,
    p_request_id: session.id,
    p_endpoint: "billing_topup",
    p_event_type: "pack_purchase",
    p_units_standard: unitsStandard,
    p_units_lead: unitsLead,
    p_unit_basis: unitBasis,
    p_idempotency_key: idempotencyKey,
    p_metadata: {
      stripe_event_id: options?.eventId ?? null,
      stripe_event_type: options?.eventType ?? null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
      stripe_customer_id: stripeCustomerId,
      pack_key: metadata.pack_key ?? null,
      unit_class: metadata.unit_class ?? null,
    },
  });

  if (error) {
    throw new Error(`Failed to credit purchased billing units: ${error.message}`);
  }

  return { orgId, stripeCustomerId, stripeSubscriptionId };
}
