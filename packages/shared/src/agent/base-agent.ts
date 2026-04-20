import Anthropic from "@anthropic-ai/sdk";
import type { Redis } from "ioredis";
import { getSharedConfig } from "../config.js";
import { executeTool } from "../tools/tool-executor.js";
import { toolDefinitions } from "../tools/tool-definitions.js";
import { extractJsonObject, safeJsonParse } from "../utils/json.js";
import type { RunAgentResult } from "../types.js";

type RunAgentInput = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  redis: Redis | null;
  maxTokens?: number;
  onProgress?: (update: { stage: string; progress: number; message: string }) => Promise<void> | void;
};

export async function runAgent<T = unknown>(input: RunAgentInput): Promise<RunAgentResult<T>> {
  const started = Date.now();
  const config = getSharedConfig();

  const anthropic = new Anthropic({
    apiKey: input.apiKey,
    timeout: config.anthropicTimeoutMs,
    maxRetries: 2
  });

  const messages: any[] = [{ role: "user", content: input.userPrompt }];
  let turns = 0;
  let toolCalls = 0;
  let accumulatedText = "";

  const reportProgress = async (stage: string, progress: number, message: string): Promise<void> => {
    if (!input.onProgress) return;
    const clampedProgress = Math.max(0, Math.min(99, Math.round(progress)));
    await input.onProgress({ stage, progress: clampedProgress, message });
  };

  while (turns < config.maxAgentTurns) {
    turns += 1;

    await reportProgress(
      "running_agent",
      25 + turns * 4 + toolCalls * 2,
      `Generating response (turn ${turns}/${config.maxAgentTurns})...`
    );

    const response: any = await anthropic.messages.create({
      model: input.model,
      system: input.systemPrompt,
      messages,
      tools: toolDefinitions as any,
      max_tokens: input.maxTokens ?? 8192,
      temperature: 0.2
    });

    messages.push({ role: "assistant", content: response.content });
    const responseText = (response.content ?? [])
      .filter((block: any) => block.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    if (responseText) accumulatedText = accumulatedText ? `${accumulatedText}\n${responseText}` : responseText;

    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      await reportProgress("finalizing_output", 92, "Finalizing model output...");
      const rawText = accumulatedText || responseText;
      const extracted = extractJsonObject(rawText);
      const parsed = safeJsonParse<T>(extracted);
      if (!parsed) {
        throw new Error("Model response did not contain valid JSON payload.");
      }
      return {
        data: parsed,
        rawText,
        model: input.model,
        tokens: {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          cacheCreationInputTokens: response.usage?.cache_creation_input_tokens,
          cacheReadInputTokens: response.usage?.cache_read_input_tokens
        },
        durationMs: Date.now() - started,
        toolCalls
      };
    }

    if (response.stop_reason === "max_tokens") {
      await reportProgress(
        "continuing_generation",
        35 + turns * 5 + toolCalls * 2,
        "Model hit max tokens. Continuing generation..."
      );
      messages.push({
        role: "user",
        content: "Continue exactly where you stopped. Return only the remaining JSON content with no markdown or explanations."
      });
      continue;
    }

    if (response.stop_reason === "tool_use") {
      const toolUses = (response.content ?? []).filter((block: any) => block.type === "tool_use");
      toolCalls += toolUses.length;

      await reportProgress(
        "running_tools",
        30 + turns * 5 + toolCalls * 3,
        `Executing ${toolUses.length} tool call(s)...`
      );

      const toolResults = await Promise.all(
        toolUses.map(async (toolUse: any) => {
          const result = await executeTool(toolUse.name, toolUse.input ?? {}, input.redis);
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result.text
          };
        })
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
  }

  throw new Error(`Exceeded max tool loop turns (${config.maxAgentTurns}).`);
}
