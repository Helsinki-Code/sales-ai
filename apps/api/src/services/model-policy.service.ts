import { llmProviders, type LlmProvider } from "@sales-ai/shared";
import { supabaseAdmin } from "../lib/supabase.js";

const defaultProvider: LlmProvider = "anthropic";
const defaultModelByProvider: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-5.4",
  gemini: "gemini-2.5-pro"
};

export type ResolvedModelPolicy = {
  provider: LlmProvider;
  model: string;
  allowedProviders: LlmProvider[];
  allowedModels: string[];
};

function normalizeProviders(raw: unknown): LlmProvider[] {
  if (!Array.isArray(raw)) return [defaultProvider];
  const set = new Set<LlmProvider>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    if ((llmProviders as readonly string[]).includes(value)) {
      set.add(value as LlmProvider);
    }
  }
  if (set.size === 0) set.add(defaultProvider);
  return Array.from(set);
}

function normalizeModels(raw: unknown, fallback: string): string[] {
  if (!Array.isArray(raw)) return [fallback];
  const models = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (models.length === 0) return [fallback];
  return Array.from(new Set(models));
}

export async function resolveModelForEndpoint(
  workspaceId: string,
  endpoint: string,
  requestedModel?: string,
  requestedProvider?: LlmProvider
): Promise<ResolvedModelPolicy> {
  const { data } = await supabaseAdmin
    .from("workspace_model_policies")
    .select("default_model,allowed_models,default_provider,allowed_providers")
    .eq("workspace_id", workspaceId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  const configuredDefaultProvider =
    typeof data?.default_provider === "string" && (llmProviders as readonly string[]).includes(data.default_provider)
      ? (data.default_provider as LlmProvider)
      : defaultProvider;

  const allowedProviders = normalizeProviders(data?.allowed_providers);
  const providerCandidate = requestedProvider ?? configuredDefaultProvider;
  if (!allowedProviders.includes(providerCandidate)) {
    throw new Error(`Requested provider ${providerCandidate} is not allowed for endpoint ${endpoint}.`);
  }

  const providerFallbackModel = defaultModelByProvider[providerCandidate];
  const configuredDefaultModel =
    typeof data?.default_model === "string" && data.default_model.trim().length > 0
      ? data.default_model.trim()
      : providerFallbackModel;
  const allowedModels = normalizeModels(data?.allowed_models, configuredDefaultModel);

  if (requestedModel) {
    if (!allowedModels.includes(requestedModel)) {
      throw new Error(`Requested model ${requestedModel} is not allowed for endpoint ${endpoint}.`);
    }
    return {
      provider: providerCandidate,
      model: requestedModel,
      allowedProviders,
      allowedModels
    };
  }

  return {
    provider: providerCandidate,
    model: configuredDefaultModel,
    allowedProviders,
    allowedModels
  };
}

export async function upsertModelPolicies(
  workspaceId: string,
  orgId: string,
  actorId: string,
  policies: Array<{
    endpoint: string;
    defaultProvider: LlmProvider;
    defaultModel: string;
    allowedProviders: LlmProvider[];
    allowedModels: string[];
  }>
): Promise<void> {
  const rows = policies.map((policy) => ({
    workspace_id: workspaceId,
    org_id: orgId,
    endpoint: policy.endpoint,
    default_provider: policy.defaultProvider,
    default_model: policy.defaultModel,
    allowed_providers: policy.allowedProviders,
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
