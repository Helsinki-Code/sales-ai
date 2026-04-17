import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIX: z.string().default("sales-ai"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INTERNAL_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  WORKER_CONCURRENCY: z.coerce.number().default(4)
});

export type WorkerEnv = z.infer<typeof schema>;
let cached: WorkerEnv | null = null;

export function getEnv(): WorkerEnv {
  if (cached) return cached;
  cached = schema.parse(process.env);
  return cached;
}
