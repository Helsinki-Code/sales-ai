import type Redis from "ioredis";
import { webFetch } from "./web-fetch.js";
import { webSearch } from "./web-search.js";
import type { ToolResult } from "../types.js";
import type { ToolName } from "./tool-definitions.js";

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  redis: Redis | null
): Promise<ToolResult> {
  switch (name as ToolName) {
    case "web_fetch": {
      const url = String(input.url ?? "");
      return webFetch(url);
    }
    case "web_search": {
      const query = String(input.query ?? "");
      return webSearch(query, redis);
    }
    default:
      return {
        type: "text",
        text: `Unknown tool: ${name}`
      };
  }
}