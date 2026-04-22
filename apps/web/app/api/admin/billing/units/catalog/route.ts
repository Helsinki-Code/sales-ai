import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { canManageBilling, getOrgRoleForUser } from "@/lib/billing/membership";
import { getUnitPackCatalog } from "@/lib/billing/unit-packs";

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
    if (!canManageBilling(role)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Only org owners/admins can manage billing" },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: getUnitPackCatalog(),
    });
  } catch (error) {
    console.error("Billing units catalog route failed:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
