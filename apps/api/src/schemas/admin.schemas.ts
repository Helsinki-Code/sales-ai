import { z } from "zod";
import { llmProviders } from "@sales-ai/shared";

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.string().min(1)).min(1),
  expiresAt: z.string().datetime().optional()
});

export const upsertProviderCredentialSchema = z.object({
  provider: z.enum(llmProviders),
  apiKey: z.string().min(16)
});

export const modelPolicyItemSchema = z.object({
  endpoint: z.string().min(2),
  defaultProvider: z.enum(llmProviders).default("anthropic"),
  defaultModel: z.string().min(2),
  allowedProviders: z.array(z.enum(llmProviders)).min(1).default(["anthropic"]),
  allowedModels: z.array(z.string().min(2)).min(1)
});

export const upsertModelPoliciesSchema = z.object({
  policies: z.array(modelPolicyItemSchema).min(1)
});
