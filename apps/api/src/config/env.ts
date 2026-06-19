import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  API_PORT: z.coerce.number().default(3000),
  API_BASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIX: z.string().default("sales-ai"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_API_KEY_PREFIX: z.string().default("sak_"),
  INTERNAL_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  DEFAULT_RATE_LIMIT_PER_MIN: z.coerce.number().default(120),
  AGENT_ENGINE: z.enum(["legacy", "hermes"]).default("legacy"),
  HERMES_RUNNER_URL: z.string().url().optional(),
  HERMES_RUNNER_TOKEN: z.string().min(32).optional(),
  HERMES_ENDPOINTS: z.string().default("*"),
  HERMES_MAX_ITERATIONS: z.coerce.number().int().min(1).max(36).default(18),
  HERMES_MAX_TOKENS: z.coerce.number().int().min(256).max(16384).default(8192)
}).superRefine((value, ctx) => {
  if (value.AGENT_ENGINE === "hermes" && (!value.HERMES_RUNNER_URL || !value.HERMES_RUNNER_TOKEN)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "HERMES_RUNNER_URL and HERMES_RUNNER_TOKEN are required when AGENT_ENGINE=hermes",
      path: ["AGENT_ENGINE"]
    });
  }
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}
