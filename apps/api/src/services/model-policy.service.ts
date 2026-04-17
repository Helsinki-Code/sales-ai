import { supabaseAdmin } from "../lib/supabase.js";

const defaultModel = "claude-sonnet-4-5";

export async function resolveModelForEndpoint(
  workspaceId: string,
  endpoint: string,
  requestedModel?: string
): Promise<string> {
  const { data } = await supabaseAdmin
    .from("workspace_model_policies")
    .select("default_model,allowed_models")
    .eq("workspace_id", workspaceId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  const allowed = (data?.allowed_models as string[] | null) ?? [defaultModel];
  const fallback = data?.default_model ?? defaultModel;

  if (requestedModel) {
    if (!allowed.includes(requestedModel)) {
      throw new Error(`Requested model ${requestedModel} is not allowed for endpoint ${endpoint}.`);
    }
    return requestedModel;
  }

  return fallback;
}

export async function upsertModelPolicies(
  workspaceId: string,
  orgId: string,
  actorId: string,
  policies: Array<{ endpoint: string; defaultModel: string; allowedModels: string[] }>
): Promise<void> {
  const rows = policies.map((policy) => ({
    workspace_id: workspaceId,
    org_id: orgId,
    endpoint: policy.endpoint,
    default_model: policy.defaultModel,
    allowed_models: policy.allowedModels,
    updated_by: actorId
  }));

  const { error } = await supabaseAdmin
    .from("workspace_model_policies")
    .upsert(rows, { onConflict: "workspace_id,endpoint" });

  if (error) {
    throw new Error(`Failed to upsert model policies: ${error.message}`);
  }
}