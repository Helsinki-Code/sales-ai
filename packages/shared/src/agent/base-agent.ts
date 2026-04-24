import Anthropic from "@anthropic-ai/sdk";
import type { Redis } from "ioredis";
import { getSharedConfig } from "../config.js";
import { executeTool } from "../tools/tool-executor.js";
import { toolDefinitions } from "../tools/tool-definitions.js";
import { parseJsonPayload } from "../utils/json.js";
import type { RunAgentResult } from "../types.js";
import type { LlmProvider } from "../types.js";

type RunAgentInput = {
  apiKey: string;
  model: string;
  provider?: LlmProvider;
  systemPrompt: string;
  userPrompt: string;
  redis: Redis | null;
  maxTokens?: number;
  onProgress?: (update: { stage: string; progress: number; message: string }) => Promise<void> | void;
};

export async function runAgent<T = unknown>(input: RunAgentInput): Promise<RunAgentResult<T>> {
  const provider = input.provider ?? inferProviderFromModel(input.model);
  if (provider === "openai") {
    return runOpenAiAgent(input);
  }
  if (provider === "gemini") {
    return runGeminiAgent(input);
  }
  return runAnthropicAgent(input);
}

function inferProviderFromModel(model: string): LlmProvider {
  const lowered = model.trim().toLowerCase();
  if (lowered.includes("gemini")) return "gemini";
  if (
    lowered.startsWith("gpt-") ||
    lowered.startsWith("o1") ||
    lowered.startsWith("o3") ||
    lowered.startsWith("o4")
  ) {
    return "openai";
  }
  return "anthropic";
}

async function runAnthropicAgent<T = unknown>(input: RunAgentInput): Promise<RunAgentResult<T>> {
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
    const responseText = readResponseText(response.content ?? []);
    if (responseText) accumulatedText = accumulatedText ? `${accumulatedText}\n${responseText}` : responseText;

    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      await reportProgress("finalizing_output", 92, "Finalizing model output...");
      const rawText = accumulatedText || responseText;
      const parsed = parseJsonPayload<T>(rawText);
      if (parsed) {
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

      await reportProgress("repairing_output", 95, "Repairing invalid JSON output...");
      const repaired = await attemptJsonRepair<T>({
        provider: "anthropic",
        apiKey: input.apiKey,
        model: input.model,
        systemPrompt: input.systemPrompt,
        rawText,
        anthropic
      });
      if (!repaired) throw new Error("Model response did not contain valid JSON payload.");

      return {
        data: repaired.data,
        rawText: repaired.rawText,
        model: input.model,
        tokens: {
          inputTokens: repaired.usage?.input_tokens ?? response.usage?.input_tokens,
          outputTokens: repaired.usage?.output_tokens ?? response.usage?.output_tokens,
          cacheCreationInputTokens:
            repaired.usage?.cache_creation_input_tokens ?? response.usage?.cache_creation_input_tokens,
          cacheReadInputTokens: repaired.usage?.cache_read_input_tokens ?? response.usage?.cache_read_input_tokens
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

async function runOpenAiAgent<T = unknown>(input: RunAgentInput): Promise<RunAgentResult<T>> {
  const started = Date.now();
  const config = getSharedConfig();
  const maxTokens = input.maxTokens ?? 8192;
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
  const toolSpecs = toolDefinitions.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userPrompt }
  ];
  let turns = 0;
  let toolCalls = 0;
  let accumulatedText = "";
  let usageAccumulator = {
    inputTokens: 0,
    outputTokens: 0
  };

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

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        tools: toolSpecs,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: maxTokens
      })
    });

    const payload = (await response.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
          tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload?.error?.message || `OpenAI request failed (${response.status}).`);
    }

    usageAccumulator.inputTokens += payload.usage?.prompt_tokens ?? 0;
    usageAccumulator.outputTokens += payload.usage?.completion_tokens ?? 0;

    const choice = payload.choices?.[0];
    const finishReason = choice?.finish_reason;
    const assistantMessage = choice?.message;
    const responseText = readOpenAiMessageText(assistantMessage?.content);
    if (responseText) {
      accumulatedText = accumulatedText ? `${accumulatedText}\n${responseText}` : responseText;
    }

    const toolCallList = assistantMessage?.tool_calls ?? [];
    if (toolCallList.length > 0) {
      toolCalls += toolCallList.length;

      messages.push({
        role: "assistant",
        content: responseText || "",
        tool_calls: toolCallList
      });

      await reportProgress(
        "running_tools",
        35 + turns * 4 + toolCalls * 3,
        `Executing ${toolCallList.length} tool call(s)...`
      );

      for (const toolCall of toolCallList) {
        const toolName = toolCall.function?.name ?? "";
        if (!toolName) continue;
        let parsedArgs: Record<string, unknown> = {};
        if (toolCall.function?.arguments) {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              parsedArgs = parsed as Record<string, unknown>;
            }
          } catch {
            parsedArgs = {};
          }
        }
        const result = await executeTool(toolName, parsedArgs, input.redis);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result.text
        });
      }
      continue;
    }

    if (finishReason === "length") {
      messages.push({
        role: "assistant",
        content: responseText || ""
      });
      messages.push({
        role: "user",
        content: "Continue exactly where you stopped. Return only remaining JSON content."
      });
      continue;
    }

    if (finishReason === "stop" || finishReason === null || finishReason === undefined) {
      await reportProgress("finalizing_output", 92, "Finalizing model output...");
      const rawText = accumulatedText || responseText;
      const parsed = parseJsonPayload<T>(rawText);
      if (parsed) {
        return {
          data: parsed,
          rawText,
          model: input.model,
          tokens: {
            inputTokens: usageAccumulator.inputTokens,
            outputTokens: usageAccumulator.outputTokens
          },
          durationMs: Date.now() - started,
          toolCalls
        };
      }

      await reportProgress("repairing_output", 95, "Repairing invalid JSON output...");
      const repaired = await attemptJsonRepair<T>({
        provider: "openai",
        apiKey: input.apiKey,
        model: input.model,
        systemPrompt: input.systemPrompt,
        rawText
      });
      if (!repaired) throw new Error("Model response did not contain valid JSON payload.");

      return {
        data: repaired.data,
        rawText: repaired.rawText,
        model: input.model,
        tokens: {
          inputTokens: repaired.usage?.inputTokens ?? usageAccumulator.inputTokens,
          outputTokens: repaired.usage?.outputTokens ?? usageAccumulator.outputTokens
        },
        durationMs: Date.now() - started,
        toolCalls
      };
    }

    throw new Error(`Unexpected OpenAI finish_reason: ${finishReason}`);
  }

  throw new Error(`Exceeded max tool loop turns (${config.maxAgentTurns}).`);
}

async function runGeminiAgent<T = unknown>(input: RunAgentInput): Promise<RunAgentResult<T>> {
  const started = Date.now();
  const maxTokens = input.maxTokens ?? 4096;
  const baseUrl = process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com";
  const response = await fetch(
    `${baseUrl}/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(
      input.apiKey
    )}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens
        }
      })
    }
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini request failed (${response.status}).`);
  }

  const rawText =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  const parsed = parseJsonPayload<T>(rawText);
  if (parsed) {
    return {
      data: parsed,
      rawText,
      model: input.model,
      tokens: {
        inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0
      },
      durationMs: Date.now() - started,
      toolCalls: 0
    };
  }

  const repaired = await attemptJsonRepair<T>({
    provider: "gemini",
    apiKey: input.apiKey,
    model: input.model,
    systemPrompt: input.systemPrompt,
    rawText
  });
  if (!repaired) {
    throw new Error("Model response did not contain valid JSON payload.");
  }

  return {
    data: repaired.data,
    rawText: repaired.rawText,
    model: input.model,
    tokens: {
      inputTokens: repaired.usage?.inputTokens ?? payload.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: repaired.usage?.outputTokens ?? payload.usageMetadata?.candidatesTokenCount ?? 0
    },
    durationMs: Date.now() - started,
    toolCalls: 0
  };
}

function readResponseText(content: any[]): string {
  return content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n")
    .trim();
}

async function attemptJsonRepair<T>(input: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  rawText: string;
  anthropic?: Anthropic;
}): Promise<{ data: T; rawText: string; usage: any } | null> {
  const repairPrompt = [
    "Your previous response was not valid JSON.",
    "Rewrite it as strict valid JSON only.",
    "No markdown, no code fences, no explanation, no extra keys.",
    "",
    "INVALID JSON INPUT:",
    input.rawText
  ].join("\n");

  if (input.provider === "anthropic") {
    const client =
      input.anthropic ??
      new Anthropic({
        apiKey: input.apiKey,
        timeout: getSharedConfig().anthropicTimeoutMs,
        maxRetries: 1
      });
    const repairResponse: any = await client.messages.create({
      model: input.model,
      system: input.systemPrompt,
      messages: [{ role: "user", content: repairPrompt }],
      max_tokens: 4096,
      temperature: 0
    });

    const repairedText = readResponseText(repairResponse.content ?? []);
    const repairedPayload = parseJsonPayload<T>(repairedText);
    if (!repairedPayload) return null;
    return {
      data: repairedPayload,
      rawText: repairedText,
      usage: {
        inputTokens: repairResponse.usage?.input_tokens,
        outputTokens: repairResponse.usage?.output_tokens,
        cacheCreationInputTokens: repairResponse.usage?.cache_creation_input_tokens,
        cacheReadInputTokens: repairResponse.usage?.cache_read_input_tokens
      }
    };
  }

  if (input.provider === "openai") {
    const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: repairPrompt }
        ],
        temperature: 0,
        max_tokens: 4096
      })
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const repairedText = readOpenAiMessageText(payload.choices?.[0]?.message?.content);
    const repairedPayload = parseJsonPayload<T>(repairedText);
    if (!repairedPayload) return null;
    return {
      data: repairedPayload,
      rawText: repairedText,
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? 0,
        outputTokens: payload.usage?.completion_tokens ?? 0
      }
    };
  }

  const baseUrl = process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com";
  const response = await fetch(
    `${baseUrl}/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(
      input.apiKey
    )}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: repairPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096
        }
      })
    }
  );
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const repairedText =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";
  const repairedPayload = parseJsonPayload<T>(repairedText);
  if (!repairedPayload) return null;
  return {
    data: repairedPayload,
    rawText: repairedText,
    usage: {
      inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0
    }
  };
}

function readOpenAiMessageText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : ""))
      .join("\n")
      .trim();
  }
  return "";
}
