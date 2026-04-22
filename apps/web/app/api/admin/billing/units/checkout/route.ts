import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { canManageBilling, getOrgRoleForUser } from "@/lib/billing/membership";
import { ensureBillingRecordForOrg, getBillingSnapshotForOrg } from "@/lib/billing/status";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/billing/stripe";
import { getUnitPack, isUnitPackKey, type UnitPackKey } from "@/lib/billing/unit-packs";

type UnitPackCheckoutPayload = {
  packKey?: unknown;
};

function getAppBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.trim()) {
    return configured.replace(/\/+$/, "");
  }
  return new URL(request.url).origin;
}

function toIntegerString(value: number): string {
  return String(Math.max(0, Math.floor(value)));
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

    const body = (await request.json().catch(() => ({}))) as UnitPackCheckoutPayload;
    const packKey: UnitPackKey = isUnitPackKey(body.packKey) ? body.packKey : "standard_1000";
    const pack = getUnitPack(packKey);

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
    });

    const baseUrl = getAppBaseUrl(request);
    const configuredPriceId =
      pack.stripePriceEnvVar && process.env[pack.stripePriceEnvVar]
        ? process.env[pack.stripePriceEnvVar]
        : null;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      line_items: configuredPriceId
        ? [{ price: configuredPriceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: "usd",
                unit_amount: pack.amountCents,
                product_data: {
                  name: pack.label,
                  description: pack.description,
                },
              },
              quantity: 1,
            },
          ],
      payment_method_collection: "always",
      success_url: `${baseUrl}/billing?topup=success`,
      cancel_url: `${baseUrl}/billing?topup=cancelled`,
      metadata: {
        org_id: orgId,
        purchase_type: "unit_pack",
        pack_key: pack.key,
        unit_class: pack.unitClass,
        units_standard: toIntegerString(pack.unitsStandard),
        units_lead: toIntegerString(pack.unitsLead),
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
    console.error("Billing unit pack checkout route failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
