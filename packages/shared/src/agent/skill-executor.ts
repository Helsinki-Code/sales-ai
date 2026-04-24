import type { Redis } from "ioredis";
import { loadSkillPrompt } from "../prompts/loader.js";
import { runAgent } from "./base-agent.js";
import type { SalesEndpoint, RunAgentResult, LlmProvider } from "../types.js";
import { runPythonJsonCommand } from "../python/bridge.js";

const defaultModelMap: Record<string, string> = {
  prospect: "claude-sonnet-4-5",
  leads: "claude-sonnet-4-5",
  "report-pdf": "claude-sonnet-4-5"
};

export type ExecuteSkillInput = {
  endpoint: SalesEndpoint;
  userInput: unknown;
  apiKey: string;
  provider?: LlmProvider;
  model?: string;
  redis: Redis | null;
  onProgress?: (update: { stage: string; progress: number; message: string }) => Promise<void> | void;
};

export async function executeSkill<T = unknown>(input: ExecuteSkillInput): Promise<RunAgentResult<T>> {
  const systemPrompt = loadSkillPrompt(input.endpoint);
  const enrichedInput = await enrichInputWithPythonSignals(input.endpoint, input.userInput);
  const userPrompt = JSON.stringify(enrichedInput);
  const model = input.model ?? defaultModelMap[input.endpoint] ?? "claude-sonnet-4-5";
  return runAgent<T>({
    apiKey: input.apiKey,
    provider: input.provider,
    model,
    systemPrompt,
    userPrompt,
    redis: input.redis,
    onProgress: input.onProgress
  });
}

async function enrichInputWithPythonSignals(endpoint: SalesEndpoint, userInput: unknown): Promise<unknown> {
  if (!userInput || typeof userInput !== "object") return userInput;

  const candidate = userInput as Record<string, unknown>;
  const url = typeof candidate.url === "string" ? candidate.url : null;
  if (!url) return userInput;

  try {
    if (endpoint === "contacts") {
      const contacts = await runPythonJsonCommand<Record<string, unknown>>("contact_finder.py", {
        args: ["--url", url, "--output", "json"],
        timeoutMs: 60000
      });
      return { ...candidate, pythonContacts: contacts };
    }

    const analysis = await runPythonJsonCommand<Record<string, unknown>>("analyze_prospect.py", {
      args: ["--url", url, "--output", "json"],
      timeoutMs: 60000
    });
    return { ...candidate, pythonAnalysis: analysis };
  } catch {
    return userInput;
  }
}
