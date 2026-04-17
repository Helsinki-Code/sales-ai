import { decryptText, encryptText } from "@sales-ai/shared";
import { getEnv } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";

const env = getEnv();

export async function getAnthropicApiKey(workspaceId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("provider_credentials")
    .select("api_key_encrypted,status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "anthropic")
    .maybeSingle();

  if (error || !data || data.status !== "active") {
    throw new Error("Workspace BYOK is not configured. Add Anthropic API key in settings.");
  }

  return decryptText(data.api_key_encrypted, env.INTERNAL_ENCRYPTION_KEY);
}

export async function upsertAnthropicApiKey(workspaceId: string, orgId: string, actorId: string, rawApiKey: string): Promise<void> {
  const encrypted = encryptText(rawApiKey, env.INTERNAL_ENCRYPTION_KEY);
  const { error } = await supabaseAdmin.from("provider_credentials").upsert(
    {
      workspace_id: workspaceId,
      org_id: orgId,
      provider: "anthropic",
      api_key_encrypted: encrypted,
      status: "active",
      updated_by: actorId
    },
    { onConflict: "workspace_id,provider" }
  );

  if (error) {
    throw new Error(`Failed to store provider credential: ${error.message}`);
  }
}