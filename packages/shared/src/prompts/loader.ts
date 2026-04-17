import { readFileSync } from "node:fs";
import path from "node:path";
import { getSharedConfig } from "../config.js";
import type { SalesEndpoint } from "../types.js";

function stripInstructionBlocks(raw: string): string {
  return raw
    .replace(/```bash[\s\S]*?```/gi, "")
    .replace(/```shell[\s\S]*?```/gi, "")
    .replace(/python3?\s+scripts\/[\w.-]+.*$/gim, "")
    .replace(/(?:save|write|export).*?\.md.*$/gim, "")
    .replace(/(?:cp|mv)\s+.*$/gim, "");
}

export function loadSkillPrompt(endpoint: SalesEndpoint): string {
  const config = getSharedConfig();
  const promptPath = path.join(config.skillsDir, `sales-${endpoint}`, "SKILL.md");
  const raw = readFileSync(promptPath, "utf8");
  const adapted = stripInstructionBlocks(raw).trim();
  return `${adapted}\n\nOutput contract:\nReturn ONLY valid JSON. No markdown fences. No prose outside JSON.`;
}