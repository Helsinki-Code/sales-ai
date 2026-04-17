import path from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("production"),
  INTERNAL_ENCRYPTION_KEY: z.string().min(16),
  TAVILY_API_KEY: z.string().optional(),
  SALES_SKILLS_DIR: z.string().optional(),
  SALES_SCRIPTS_DIR: z.string().optional(),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().default(120000),
  MAX_AGENT_TURNS: z.coerce.number().default(10)
});

function findUpDirectory(name: string): string | null {
  let current = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(current, name);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function resolveRuntimeDir(input: string | undefined, fallbackDirName: string): string {
  if (input) return path.resolve(process.cwd(), input);
  const vendored = path.join(process.cwd(), "vendor", "ai-sales-team", fallbackDirName);
  if (existsSync(vendored)) return vendored;
  const discovered = findUpDirectory(fallbackDirName);
  if (!discovered) {
    throw new Error(`Could not find required directory: ${fallbackDirName}. Set env variable explicitly.`);
  }
  return discovered;
}

export type SharedConfig = {
  nodeEnv: "development" | "test" | "production";
  appEnv: "local" | "staging" | "production";
  internalEncryptionKey: string;
  tavilyApiKey?: string;
  skillsDir: string;
  scriptsDir: string;
  anthropicTimeoutMs: number;
  maxAgentTurns: number;
};

let cachedConfig: SharedConfig | null = null;

export function getSharedConfig(): SharedConfig {
  if (cachedConfig) return cachedConfig;
  const env = envSchema.parse(process.env);
  cachedConfig = {
    nodeEnv: env.NODE_ENV,
    appEnv: env.APP_ENV,
    internalEncryptionKey: env.INTERNAL_ENCRYPTION_KEY,
    tavilyApiKey: env.TAVILY_API_KEY,
    skillsDir: resolveRuntimeDir(env.SALES_SKILLS_DIR, "skills"),
    scriptsDir: resolveRuntimeDir(env.SALES_SCRIPTS_DIR, "scripts"),
    anthropicTimeoutMs: env.ANTHROPIC_TIMEOUT_MS,
    maxAgentTurns: env.MAX_AGENT_TURNS
  };
  return cachedConfig;
}
