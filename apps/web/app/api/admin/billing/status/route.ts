import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { canManageBilling, getOrgRoleForUser } from "@/lib/billing/membership";
import { getBillingPlanCatalog, resolvePlanFromPriceId } from "@/lib/billing/plans";
import { getBillingSnapshotForOrg, isBillingActiveStatus } from "@/lib/billing/status";

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
        catalog: getBillingPlanCatalog(),
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
