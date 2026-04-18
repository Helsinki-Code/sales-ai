import { createClient } from "@/lib/supabase/server";

export async function getWorkspaceId(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error) {
    throw new Error(`Failed to resolve workspace: ${error.message}`);
  }

  if (!data?.workspace_id) {
    throw new Error("No workspace found for user");
  }

  return data.workspace_id;
}
