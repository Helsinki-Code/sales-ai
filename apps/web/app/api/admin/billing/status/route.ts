import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { canManageBilling, getOrgRoleForUser } from "@/lib/billing/membership";
import { getBillingPlanCatalog, resolvePlanFromPriceId } from "@/lib/billing/plans";
import { getBillingSnapshotForOrg, isBillingActiveStatus } from "@/lib/billing/status";
import { getUnitPackCatalog } from "@/lib/billing/unit-packs";
import { getServiceRoleClient } from "@/lib/supabase/admin";

export async function GET() {
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
    if (!role) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Organization membership not found" } },
        { status: 403 }
      );
    }

    const billing = await getBillingSnapshotForOrg(orgId);
    const currentPlan = resolvePlanFromPriceId(billing.stripePriceId);
    const admin = getServiceRoleClient();
    const { data: unitWallet, error: unitWalletError } = await admin
      .from("org_billing")
      .select(
        "current_plan_key,cycle_start_at,cycle_end_at,included_standard_units,included_lead_units,purchased_standard_units,purchased_lead_units,consumed_standard_units,consumed_lead_units"
      )
      .eq("org_id", orgId)
      .maybeSingle();
    if (unitWalletError) {
      throw new Error(`Failed to load unit wallet: ${unitWalletError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        orgId,
        role,
        canManageBilling: canManageBilling(role),
        isActive: isBillingActiveStatus(billing.billingStatus),
        billing: {
          ...billing,
          currentPlan,
        },
        units: {
          currentPlanKey: unitWallet?.current_plan_key ?? null,
          cycleStartAt: unitWallet?.cycle_start_at ?? null,
          cycleEndAt: unitWallet?.cycle_end_at ?? null,
          includedStandardUnits: unitWallet?.included_standard_units ?? 0,
          includedLeadUnits: unitWallet?.included_lead_units ?? 0,
          purchasedStandardUnits: unitWallet?.purchased_standard_units ?? 0,
          purchasedLeadUnits: unitWallet?.purchased_lead_units ?? 0,
          consumedStandardUnits: unitWallet?.consumed_standard_units ?? 0,
          consumedLeadUnits: unitWallet?.consumed_lead_units ?? 0,
        },
        catalog: getBillingPlanCatalog(),
        unitPackCatalog: getUnitPackCatalog(),
      },
    });
  } catch (error) {
    console.error("Billing status route failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
