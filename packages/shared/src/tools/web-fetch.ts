import type { ToolResult } from "../types.js";

const USER_AGENT = "SalesAI-Bot/1.0 (+https://sales-ai.app)";

export async function webFetch(url: string): Promise<ToolResult> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    return { type: "text", text: `Failed to fetch ${url}. HTTP ${response.status}` };
  }

  const html = await response.text();
  const { load } = await import("cheerio");
  const $ = load(html);
  $("script,style,noscript").remove();
  const title = $("title").first().text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 20000);
  return {
    type: "text",
    text: JSON.stringify({
      url,
      title,
      text
    })
  };
}