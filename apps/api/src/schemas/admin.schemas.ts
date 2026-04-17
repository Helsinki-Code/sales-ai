import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.string().min(1)).min(1),
  expiresAt: z.string().datetime().optional()
});

export const upsertProviderCredentialSchema = z.object({
  provider: z.literal("anthropic"),
  apiKey: z.string().min(16)
});

export const modelPolicyItemSchema = z.object({
  endpoint: z.string().min(2),
  defaultModel: z.string().min(2),
  allowedModels: z.array(z.string().min(2)).min(1)
});

export const upsertModelPoliciesSchema = z.object({
  policies: z.array(modelPolicyItemSchema).min(1)
});