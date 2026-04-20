import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { canManageBilling, getOrgRoleForUser } from "@/lib/billing/membership";
import {
  BILLING_TRIAL_DAYS,
  getStripePriceId,
  isBillingInterval,
  isBillingPlanKey,
  type BillingInterval,
  type BillingPlanKey,
} from "@/lib/billing/plans";
import { ensureBillingRecordForOrg, getBillingSnapshotForOrg } from "@/lib/billing/status";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/billing/stripe";

type CheckoutPayload = {
  plan?: unknown;
  interval?: unknown;
};

function getAppBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.trim()) {
    return configured.replace(/\/+$/, "");
  }
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { orgId } = await getWorkspaceContext(user.id);
    const role = await getOrgRoleForUser(supabase, orgId, user.id);
    if (!canManageBilling(role)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Only org owners/admins can manage billing" },
        },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as CheckoutPayload;
    const requestedPlan = body.plan;
    const requestedInterval = body.interval;

    const plan: BillingPlanKey = isBillingPlanKey(requestedPlan) ? requestedPlan : "starter";
    const interval: BillingInterval = isBillingInterval(requestedInterval) ? requestedInterval : "monthly";
    const stripePriceId = getStripePriceId(plan, interval);

    const stripe = getStripeClient();
    const admin = getServiceRoleClient();
    const billing = await getBillingSnapshotForOrg(orgId);

    let stripeCustomerId = billing.stripeCustomerId;
    if (!stripeCustomerId) {
      const { data: orgData, error: orgError } = await admin
        .from("orgs")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();

      if (orgError) {
        throw new Error(`Failed to load org details: ${orgError.message}`);
      }

      const customer = await stripe.customers.create({
        name: orgData?.name ?? "Sales AI Organization",
        metadata: {
          org_id: orgId,
        },
      });

      stripeCustomerId = customer.id;
    }

    await ensureBillingRecordForOrg(orgId, {
      stripeCustomerId,
      stripePriceId,
    });

    const baseUrl = getAppBaseUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      payment_method_collection: "always",
      success_url: `${baseUrl}/billing?checkout=success`,
      cancel_url: `${baseUrl}/billing?checkout=cancelled`,
      metadata: {
        org_id: orgId,
        selected_plan: plan,
        selected_interval: interval,
      },
      subscription_data: {
        trial_period_days: BILLING_TRIAL_DAYS,
        metadata: {
          org_id: orgId,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    console.error("Billing checkout route failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
