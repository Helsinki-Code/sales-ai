import type { Redis } from "ioredis";
import { getSharedConfig } from "../config.js";
import type { ToolResult } from "../types.js";

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

const TAVILY_URL = "https://api.tavily.com/search";

export async function webSearch(query: string, redis: Redis | null): Promise<ToolResult> {
  const { tavilyApiKey } = getSharedConfig();
  if (!tavilyApiKey) {
    return {
      type: "text",
      text: "TAVILY_API_KEY not configured."
    };
  }

  const cacheKey = `search:${query.toLowerCase()}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { type: "text", text: cached };
    }
  }

  const response = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query,
      search_depth: "advanced",
      max_results: 8,
      include_answer: true
    })
  });

  if (!response.ok) {
    return {
      type: "text",
      text: `WebSearch failed with HTTP ${response.status}`
    };
  }

  const body = await response.json() as { answer?: string; results?: TavilySearchResult[] };
  const result = JSON.stringify({
    query,
    answer: body.answer,
    results: body.results ?? []
  });

  if (redis) {
    await redis.set(cacheKey, result, "EX", 3600);
  }

  return { type: "text", text: result };
}
