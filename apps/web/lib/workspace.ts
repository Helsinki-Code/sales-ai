import { createClient } from "@/lib/supabase/server";

export interface WorkspaceContext {
  workspaceId: string;
  orgId: string;
}

async function getCandidateOrgIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const candidates: string[] = [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.default_org_id) {
    candidates.push(profile.default_org_id);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error(`Failed to resolve organization membership: ${membershipError.message}`);
  }

  for (const row of memberships ?? []) {
    if (row.org_id && !candidates.includes(row.org_id)) {
      candidates.push(row.org_id);
    }
  }

  return candidates;
}

export async function getWorkspaceContext(userId: string): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const orgIds = await getCandidateOrgIds(userId);

  if (orgIds.length === 0) {
    throw new Error("No active organization membership found for user");
  }

  for (const orgId of orgIds) {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id,org_id,is_default,created_at")
      .eq("org_id", orgId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      throw new Error(`Failed to resolve workspace: ${workspaceError.message}`);
    }

    if (workspace?.id && workspace.org_id) {
      return { workspaceId: workspace.id, orgId: workspace.org_id };
    }
  }

  throw new Error("No workspace found for user's organizations");
}

export async function getWorkspaceId(userId: string): Promise<string> {
  const context = await getWorkspaceContext(userId);
  return context.workspaceId;
}
