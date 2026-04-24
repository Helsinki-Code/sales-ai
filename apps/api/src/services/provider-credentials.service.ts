import { decryptText, encryptText, type LlmProvider } from "@sales-ai/shared";
import { getEnv } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";

const env = getEnv();

const providerLabel: Record<LlmProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini"
};

export async function getProviderApiKey(workspaceId: string, provider: LlmProvider): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("provider_credentials")
    .select("api_key_encrypted,status")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data || data.status !== "active") {
    throw new Error(`Workspace BYOK is not configured. Add ${providerLabel[provider]} API key in settings.`);
  }

  return decryptText(data.api_key_encrypted, env.INTERNAL_ENCRYPTION_KEY);
}

export async function upsertProviderApiKey(
  workspaceId: string,
  orgId: string,
  actorId: string,
  provider: LlmProvider,
  rawApiKey: string
): Promise<void> {
  const encrypted = encryptText(rawApiKey, env.INTERNAL_ENCRYPTION_KEY);
  const { error } = await supabaseAdmin.from("provider_credentials").upsert(
    {
      workspace_id: workspaceId,
      org_id: orgId,
      provider,
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
