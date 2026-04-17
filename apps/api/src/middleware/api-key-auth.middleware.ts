import type { RequestHandler } from "express";
import { sha256 } from "@sales-ai/shared";
import { supabaseAdmin } from "../lib/supabase.js";

function normalizeBearer(reqAuth: string | undefined): string | null {
  if (!reqAuth) return null;
  if (!reqAuth.toLowerCase().startsWith("bearer ")) return null;
  const token = reqAuth.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function requireApiKey(requiredScope?: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = normalizeBearer(req.header("authorization"));
      if (!token) {
        return res.status(401).json({
          success: false,
          error: { code: "MISSING_API_KEY", message: "Authorization Bearer token is required." }
        });
      }

      const tokenHash = sha256(token);
      const { data: apiKey, error } = await supabaseAdmin
        .from("api_keys")
        .select("id,workspace_id,org_id,name,status,revoked_at,expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (error || !apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: "INVALID_API_KEY", message: "API key is invalid." }
        });
      }

      if (apiKey.status !== "active" || apiKey.revoked_at) {
        return res.status(401).json({
          success: false,
          error: { code: "REVOKED_API_KEY", message: "API key is no longer active." }
        });
      }

      if (apiKey.expires_at && Date.parse(apiKey.expires_at) < Date.now()) {
        return res.status(401).json({
          success: false,
          error: { code: "EXPIRED_API_KEY", message: "API key has expired." }
        });
      }

      const { data: scopeRows } = await supabaseAdmin
        .from("api_key_scopes")
        .select("scope")
        .eq("api_key_id", apiKey.id);

      const scopes = (scopeRows ?? []).map((item) => item.scope);
      if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("*") ) {
        return res.status(403).json({
          success: false,
          error: { code: "INSUFFICIENT_SCOPE", message: `Missing required scope: ${requiredScope}` }
        });
      }

      req.auth = {
        apiKeyId: apiKey.id,
        workspaceId: apiKey.workspace_id,
        orgId: apiKey.org_id,
        keyName: apiKey.name,
        scopes
      };

      await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}