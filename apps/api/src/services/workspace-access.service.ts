import { supabaseAdmin } from "../lib/supabase.js";

export async function assertWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from("workspaces")
    .select("org_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    throw new Error("Workspace not found.");
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("org_members")
    .select("id")
    .eq("org_id", workspace.org_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error("You do not have access to this workspace.");
  }
}