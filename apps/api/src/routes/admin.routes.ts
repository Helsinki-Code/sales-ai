import { Router } from "express";
import { requireUserSession } from "../middleware/user-auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { createApiKeySchema, upsertModelPoliciesSchema, upsertProviderCredentialSchema } from "../schemas/admin.schemas.js";
import { assertWorkspaceAccess } from "../services/workspace-access.service.js";
import { createApiKey, revokeApiKey, rotateApiKey } from "../services/api-keys.service.js";
import { upsertProviderApiKey } from "../services/provider-credentials.service.js";
import { upsertModelPolicies } from "../services/model-policy.service.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const adminRouter = Router();
adminRouter.use(requireUserSession);

function getRequiredParam(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

adminRouter.post("/workspaces/:workspaceId/provider-credentials", validateBody(upsertProviderCredentialSchema), async (req, res, next) => {
  try {
    if (!req.userAuth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });

    const workspaceId = getRequiredParam(req.params.workspaceId);
    if (!workspaceId) return res.status(400).json({ success: false, error: { code: "INVALID_WORKSPACE_ID", message: "workspaceId route param is required." } });
    await assertWorkspaceAccess(workspaceId, req.userAuth.userId);

    const { data: workspace } = await supabaseAdmin.from("workspaces").select("org_id").eq("id", workspaceId).single();
    if (!workspace) throw new Error("Workspace not found.");

    await upsertProviderApiKey(
      workspaceId,
      workspace.org_id,
      req.userAuth.userId,
      req.body.provider,
      req.body.apiKey
    );
    return res.json({ success: true, data: { workspaceId, provider: req.body.provider, status: "active" } });
  } catch (error) {
    return next(error);
  }
});

adminRouter.put("/workspaces/:workspaceId/model-policies", validateBody(upsertModelPoliciesSchema), async (req, res, next) => {
  try {
    if (!req.userAuth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });

    const workspaceId = getRequiredParam(req.params.workspaceId);
    if (!workspaceId) return res.status(400).json({ success: false, error: { code: "INVALID_WORKSPACE_ID", message: "workspaceId route param is required." } });
    await assertWorkspaceAccess(workspaceId, req.userAuth.userId);

    const { data: workspace } = await supabaseAdmin.from("workspaces").select("org_id").eq("id", workspaceId).single();
    if (!workspace) throw new Error("Workspace not found.");

    await upsertModelPolicies(workspaceId, workspace.org_id, req.userAuth.userId, req.body.policies);
    return res.json({ success: true, data: { workspaceId, updated: req.body.policies.length } });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/workspaces/:workspaceId/api-keys", validateBody(createApiKeySchema), async (req, res, next) => {
  try {
    if (!req.userAuth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });

    const workspaceId = getRequiredParam(req.params.workspaceId);
    if (!workspaceId) return res.status(400).json({ success: false, error: { code: "INVALID_WORKSPACE_ID", message: "workspaceId route param is required." } });
    await assertWorkspaceAccess(workspaceId, req.userAuth.userId);

    const { data: workspace } = await supabaseAdmin.from("workspaces").select("org_id").eq("id", workspaceId).single();
    if (!workspace) throw new Error("Workspace not found.");

    const { apiKeyId, token } = await createApiKey({
      orgId: workspace.org_id,
      workspaceId,
      name: req.body.name,
      scopes: req.body.scopes,
      createdBy: req.userAuth.userId,
      expiresAt: req.body.expiresAt
    });

    return res.status(201).json({ success: true, data: { apiKeyId, token } });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/workspaces/:workspaceId/usage", async (req, res, next) => {
  try {
    if (!req.userAuth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    const workspaceId = getRequiredParam(req.params.workspaceId);
    if (!workspaceId) return res.status(400).json({ success: false, error: { code: "INVALID_WORKSPACE_ID", message: "workspaceId route param is required." } });
    await assertWorkspaceAccess(workspaceId, req.userAuth.userId);

    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    let query = supabaseAdmin
      .from("usage_daily_rollups")
      .select("usage_date,endpoint,model,request_count,success_count,failure_count,input_tokens,output_tokens,cost_usd,token_cost_usd,managed_estimated_cost_usd,total_cost_usd,parallel_api_calls,parallel_enrichment_runs,managed_crawler_runs,managed_pages_crawled,managed_verification_runs,managed_cycle_count,standard_units_consumed,lead_units_consumed")
      .eq("workspace_id", workspaceId)
      .order("usage_date", { ascending: false })
      .limit(180);

    if (from) query = query.gte("usage_date", from);
    if (to) query = query.lte("usage_date", to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/workspaces/:workspaceId/api-keys", async (req, res, next) => {
  try {
    if (!req.userAuth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    const workspaceId = getRequiredParam(req.params.workspaceId);
    if (!workspaceId) return res.status(400).json({ success: false, error: { code: "INVALID_WORKSPACE_ID", message: "workspaceId route param is required." } });
    await assertWorkspaceAccess(workspaceId, req.userAuth.userId);

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id,name,status,last_used_at,expires_at,created_at,revoked_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

adminRouter.delete("/workspaces/:workspaceId/api-keys/:apiKeyId", async (req, res, next) => {
  try {
    if (!req.userAuth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    const workspaceId = getRequiredParam(req.params.workspaceId);
    if (!workspaceId) return res.status(400).json({ success: false, error: { code: "INVALID_WORKSPACE_ID", message: "workspaceId route param is required." } });
    await assertWorkspaceAccess(workspaceId, req.userAuth.userId);

    const apiKeyId = getRequiredParam(req.params.apiKeyId);
    if (!apiKeyId) return res.status(400).json({ success: false, error: { code: "INVALID_API_KEY_ID", message: "apiKeyId route param is required." } });

    await revokeApiKey(apiKeyId);
    return res.json({ success: true, data: { apiKeyId, status: "revoked" } });
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/workspaces/:workspaceId/api-keys/:apiKeyId/rotate", async (req, res, next) => {
  try {
    if (!req.userAuth) return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
    const workspaceId = getRequiredParam(req.params.workspaceId);
    if (!workspaceId) return res.status(400).json({ success: false, error: { code: "INVALID_WORKSPACE_ID", message: "workspaceId route param is required." } });
    await assertWorkspaceAccess(workspaceId, req.userAuth.userId);

    const apiKeyId = getRequiredParam(req.params.apiKeyId);
    if (!apiKeyId) return res.status(400).json({ success: false, error: { code: "INVALID_API_KEY_ID", message: "apiKeyId route param is required." } });

    const { data: current } = await supabaseAdmin.from("api_keys").select("name,org_id,expires_at").eq("id", apiKeyId).single();
    if (!current) throw new Error("API key not found.");

    const { data: scopeRows } = await supabaseAdmin.from("api_key_scopes").select("scope").eq("api_key_id", apiKeyId);
    const scopes = (scopeRows ?? []).map((row) => row.scope);

    const rotated = await rotateApiKey({
      apiKeyId,
      orgId: current.org_id,
      workspaceId,
      name: current.name,
      scopes,
      createdBy: req.userAuth.userId,
      expiresAt: current.expires_at ?? undefined
    });

    return res.json({ success: true, data: rotated });
  } catch (error) {
    return next(error);
  }
});
