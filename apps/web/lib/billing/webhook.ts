import type Stripe from "stripe";
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
  explicitOrgId: string | null = null
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

  return { orgId, stripeCustomerId, stripeSubscriptionId };
}
