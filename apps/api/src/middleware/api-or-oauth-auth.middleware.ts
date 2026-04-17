import type { RequestHandler } from "express";
import { sha256 } from "@sales-ai/shared";
import { supabaseAdmin } from "../lib/supabase.js";

function normalizeBearer(reqAuth: string | undefined): string | null {
  if (!reqAuth) return null;
  if (!reqAuth.toLowerCase().startsWith("bearer ")) return null;
  const token = reqAuth.slice(7).trim();
  return token.length > 0 ? token : null;
}

function getAuthToken(req: Parameters<RequestHandler>[0]): string | null {
  const appApiKey = req.header("x-app-api-key");
  if (appApiKey && appApiKey.trim().length > 0) return appApiKey.trim();

  const explicit = req.header("x-supabase-access-token");
  if (explicit && explicit.trim().length > 0) return explicit.trim();

  return normalizeBearer(req.header("authorization"));
}

async function resolveApiKeyAuth(token: string, requiredScope?: string): Promise<{ ok: boolean; auth?: any; errorCode?: string; errorMessage?: string }> {
  const tokenHash = sha256(token);
  const { data: apiKey, error } = await supabaseAdmin
    .from("api_keys")
    .select("id,workspace_id,org_id,name,status,revoked_at,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !apiKey) return { ok: false };
  if (apiKey.status !== "active" || apiKey.revoked_at) {
    return { ok: false, errorCode: "REVOKED_API_KEY", errorMessage: "API key is no longer active." };
  }
  if (apiKey.expires_at && Date.parse(apiKey.expires_at) < Date.now()) {
    return { ok: false, errorCode: "EXPIRED_API_KEY", errorMessage: "API key has expired." };
  }

  const { data: scopeRows } = await supabaseAdmin
    .from("api_key_scopes")
    .select("scope")
    .eq("api_key_id", apiKey.id);

  const scopes = (scopeRows ?? []).map((scopeRow) => scopeRow.scope);
  if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("*")) {
    return { ok: false, errorCode: "INSUFFICIENT_SCOPE", errorMessage: `Missing required scope: ${requiredScope}` };
  }

  await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);

  return {
    ok: true,
    auth: {
      apiKeyId: apiKey.id,
      workspaceId: apiKey.workspace_id,
      orgId: apiKey.org_id,
      keyName: apiKey.name,
      scopes
    }
  };
}

async function resolveOAuthUserAuth(token: string): Promise<{ ok: boolean; auth?: any; errorCode?: string; errorMessage?: string }> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { ok: false };

  return {
    ok: true,
    auth: {
      userId: data.user.id,
      email: data.user.email
    }
  };
}

export function requireApiKeyOrOAuth(requiredScope?: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = getAuthToken(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          error: { code: "MISSING_AUTH", message: "Provide x-app-api-key or x-supabase-access-token or Authorization Bearer token." }
        });
      }

      const apiKeyResult = await resolveApiKeyAuth(token, requiredScope);
      if (apiKeyResult.ok) {
        req.auth = apiKeyResult.auth;
        return next();
      }

      if (apiKeyResult.errorCode) {
        return res.status(401).json({ success: false, error: { code: apiKeyResult.errorCode, message: apiKeyResult.errorMessage } });
      }

      const oauthResult = await resolveOAuthUserAuth(token);
      if (!oauthResult.ok || !oauthResult.auth) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_AUTH", message: "Token is not a valid API key or OAuth session." }
        });
      }

      const workspaceId = req.header("x-workspace-id");
      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          error: { code: "MISSING_WORKSPACE", message: "x-workspace-id header is required when using OAuth tokens." }
        });
      }

      const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from("workspaces")
        .select("id,org_id")
        .eq("id", workspaceId)
        .maybeSingle();

      if (workspaceError || !workspace) {
        return res.status(404).json({
          success: false,
          error: { code: "WORKSPACE_NOT_FOUND", message: "Workspace does not exist." }
        });
      }

      const { data: membership } = await supabaseAdmin
        .from("org_members")
        .select("id")
        .eq("org_id", workspace.org_id)
        .eq("user_id", oauthResult.auth.userId)
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: { code: "WORKSPACE_FORBIDDEN", message: "OAuth user does not have workspace access." }
        });
      }

      req.auth = {
        apiKeyId: undefined,
        workspaceId: workspace.id,
        orgId: workspace.org_id,
        keyName: "oauth-user",
        scopes: ["sales:run", "jobs:read", "jobs:write"]
      };
      req.userAuth = oauthResult.auth;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
