import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgRole = "owner" | "admin" | "member";

export function canManageBilling(role: OrgRole | null): boolean {
  return role === "owner" || role === "admin";
}

export async function getOrgRoleForUser(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<OrgRole | null> {
  const { data, error } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve membership role: ${error.message}`);
  }

  const role = data?.role;
  if (role === "owner" || role === "admin" || role === "member") {
    return role;
  }

  return null;
}
