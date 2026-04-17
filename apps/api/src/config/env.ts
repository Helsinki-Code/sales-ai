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
  DEFAULT_RATE_LIMIT_PER_MIN: z.coerce.number().default(120)
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}
