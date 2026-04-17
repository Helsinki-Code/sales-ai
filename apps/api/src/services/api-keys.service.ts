import { randomUUID } from "node:crypto";
import { sha256, randomSecret } from "@sales-ai/shared";
import { getEnv } from "../config/env.js";
import { supabaseAdmin } from "../lib/supabase.js";

const env = getEnv();

export async function createApiKey(input: {
  orgId: string;
  workspaceId: string;
  name: string;
  scopes: string[];
  createdBy: string;
  expiresAt?: string;
}): Promise<{ apiKeyId: string; token: string }> {
  const apiKeyId = randomUUID();
  const secret = randomSecret(24);
  const token = `${env.APP_API_KEY_PREFIX}${apiKeyId}.${secret}`;
  const tokenHash = sha256(token);

  const { error } = await supabaseAdmin.from("api_keys").insert({
    id: apiKeyId,
    org_id: input.orgId,
    workspace_id: input.workspaceId,
    name: input.name,
    token_hash: tokenHash,
    status: "active",
    expires_at: input.expiresAt ?? null,
    created_by: input.createdBy
  });

  if (error) throw new Error(error.message);

  await supabaseAdmin.from("api_key_scopes").insert(
    input.scopes.map((scope) => ({ api_key_id: apiKeyId, scope }))
  );

  return { apiKeyId, token };
}

export async function revokeApiKey(apiKeyId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", apiKeyId);

  if (error) throw new Error(error.message);
}

export async function rotateApiKey(input: {
  apiKeyId: string;
  orgId: string;
  workspaceId: string;
  name: string;
  scopes: string[];
  createdBy: string;
  expiresAt?: string;
}): Promise<{ apiKeyId: string; token: string }> {
  await revokeApiKey(input.apiKeyId);
  return createApiKey({
    orgId: input.orgId,
    workspaceId: input.workspaceId,
    name: input.name,
    scopes: input.scopes,
    createdBy: input.createdBy,
    expiresAt: input.expiresAt
  });
}