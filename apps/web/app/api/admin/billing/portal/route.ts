import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { canManageBilling, getOrgRoleForUser } from "@/lib/billing/membership";
import { getBillingSnapshotForOrg } from "@/lib/billing/status";
import { getStripeClient } from "@/lib/billing/stripe";

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

    const billing = await getBillingSnapshotForOrg(orgId);
    if (!billing.stripeCustomerId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BILLING_NOT_SETUP",
            message: "No Stripe customer found. Start checkout first to begin billing.",
          },
        },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const baseUrl = getAppBaseUrl(request);
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    console.error("Billing portal route failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
