import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export interface WorkspaceContext {
  workspaceId: string;
  orgId: string;
}

async function getCandidateOrgIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
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

async function resolveWorkspaceForOrg(
  supabase: Awaited<ReturnType<typeof createClient>> | SupabaseClient,
  orgId: string
): Promise<WorkspaceContext | null> {
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

  if (!workspace?.id || !workspace.org_id) {
    return null;
  }

  return { workspaceId: workspace.id, orgId: workspace.org_id };
}

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function ensureOrgMembership(admin: SupabaseClient, orgId: string, userId: string): Promise<void> {
  const { error } = await admin.from("org_members").upsert(
    {
      org_id: orgId,
      user_id: userId,
      role: "owner",
      status: "active",
      invited_by: userId
    },
    { onConflict: "org_id,user_id" }
  );

  if (error) {
    throw new Error(`Failed to ensure organization membership: ${error.message}`);
  }
}

async function ensureProfileDefaultOrg(admin: SupabaseClient, userId: string, orgId: string): Promise<void> {
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      default_org_id: orgId
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Failed to update profile default org: ${error.message}`);
  }
}

async function resolveWorkspaceViaAdmin(userId: string, candidateOrgIds: string[]): Promise<WorkspaceContext | null> {
  const admin = getAdminClient();
  if (!admin) {
    return null;
  }

  for (const orgId of candidateOrgIds) {
    const workspace = await resolveWorkspaceForOrg(admin, orgId);
    if (workspace) {
      await ensureOrgMembership(admin, workspace.orgId, userId);
      await ensureProfileDefaultOrg(admin, userId, workspace.orgId);
      return workspace;
    }
  }

  const { data: createdWorkspace, error: createdWorkspaceError } = await admin
    .from("workspaces")
    .select("id,org_id,is_default,created_at")
    .eq("created_by", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (createdWorkspaceError) {
    throw new Error(`Failed to resolve workspace by creator: ${createdWorkspaceError.message}`);
  }

  if (createdWorkspace?.id && createdWorkspace.org_id) {
    const workspace = {
      workspaceId: createdWorkspace.id,
      orgId: createdWorkspace.org_id
    };
    await ensureOrgMembership(admin, workspace.orgId, userId);
    await ensureProfileDefaultOrg(admin, userId, workspace.orgId);
    return workspace;
  }

  const newOrgId = crypto.randomUUID();
  const orgSlug = `org-${userId.slice(0, 8)}-${crypto.randomUUID().slice(0, 6)}`;
  const workspaceSlug = "default";

  const { error: orgInsertError } = await admin.from("orgs").insert({
    id: newOrgId,
    name: "My Organization",
    slug: orgSlug,
    environment: "production",
    created_by: userId
  });

  if (orgInsertError) {
    throw new Error(`Failed to bootstrap organization: ${orgInsertError.message}`);
  }

  await ensureOrgMembership(admin, newOrgId, userId);

  const newWorkspaceId = crypto.randomUUID();
  const { error: workspaceInsertError } = await admin.from("workspaces").insert({
    id: newWorkspaceId,
    org_id: newOrgId,
    name: "Default Workspace",
    slug: workspaceSlug,
    is_default: true,
    created_by: userId
  });

  if (workspaceInsertError) {
    throw new Error(`Failed to bootstrap workspace: ${workspaceInsertError.message}`);
  }

  await ensureProfileDefaultOrg(admin, userId, newOrgId);
  return { workspaceId: newWorkspaceId, orgId: newOrgId };
}

export async function getWorkspaceContext(userId: string): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const orgIds = await getCandidateOrgIds(supabase, userId);

  for (const orgId of orgIds) {
    const workspace = await resolveWorkspaceForOrg(supabase, orgId);
    if (workspace) {
      return workspace;
    }
  }

  const adminResolved = await resolveWorkspaceViaAdmin(userId, orgIds);
  if (adminResolved) {
    return adminResolved;
  }

  throw new Error(
    "No active organization membership found for user. Set SUPABASE_SERVICE_ROLE_KEY on web to auto-bootstrap tenancy."
  );
}

export async function getWorkspaceId(userId: string): Promise<string> {
  const context = await getWorkspaceContext(userId);
  return context.workspaceId;
}
