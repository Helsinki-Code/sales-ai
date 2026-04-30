import "dotenv/config";
import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    REDIS_URL: z.string().min(1),
    BULLMQ_PREFIX: z.string().default("sales-ai"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    INTERNAL_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
    WORKER_CONCURRENCY: z.coerce.number().default(4),
    LEADS_ENGINE_MODE: z.enum(["legacy", "parallel_v1", "goose_v1"]).default("goose_v1"),
    PARALLEL_API_KEY: z.string().optional(),
    PARALLEL_BASE_URL: z.string().url().default("https://api.parallel.ai"),
    PARALLEL_TIMEOUT_MS: z.coerce.number().default(120000),
    PARALLEL_FINDALL_GENERATOR_DEFAULT: z.string().default("core"),
    PARALLEL_FINDALL_ESCALATION_GENERATOR: z.string().default("pro"),
    PARALLEL_FINDALL_BETA_HEADER: z.string().default("findall-2025-09-15"),
    PARALLEL_TASK_PROCESSOR: z.string().default("core"),
    GOOSE_CRAWLER_TIMEOUT_MS: z.coerce.number().default(120000),
    GOOSE_CRAWLER_MAX_PAGES: z.coerce.number().default(25),
    GOOSE_MAX_CYCLES_PER_SLICE: z.coerce.number().default(3),
    FIRECRAWL_API_KEY: z.string().optional(),
    FIRECRAWL_SEARCH_LIMIT: z.coerce.number().default(12),
    FIRECRAWL_SCRAPE_TIMEOUT_MS: z.coerce.number().default(25000),
    FIRECRAWL_PER_CYCLE_MAX_CANDIDATES: z.coerce.number().default(8),
    APIFY_TOKEN: z.string().optional(),
    APIFY_WAIT_FOR_FINISH_SECS: z.coerce.number().default(240),
    APIFY_MAX_RESULTS_PER_CYCLE: z.coerce.number().default(24),
    APIFY_PROXY_GROUPS: z.string().default("AUTO"),
    APIFY_USE_RESIDENTIAL: z.coerce.boolean().default(true),
    APIFY_DISCOVERY_PARALLEL_PARTITIONS: z.coerce.number().default(4),
    APIFY_LOCAL_MODE_ENABLED: z.coerce.boolean().default(true),
    LEADS_ANYMAILFINDER_ENABLED: z.coerce.boolean().default(false),
    ANYMAILFINDER_API_KEY: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.LEADS_ENGINE_MODE === "goose_v1" && (!value.APIFY_TOKEN || value.APIFY_TOKEN.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "APIFY_TOKEN is required when LEADS_ENGINE_MODE=goose_v1",
        path: ["APIFY_TOKEN"]
      });
    }
  });

export type WorkerEnv = z.infer<typeof schema>;
let cached: WorkerEnv | null = null;

export function getEnv(): WorkerEnv {
  if (cached) return cached;
  cached = schema.parse(process.env);
  return cached;
}
