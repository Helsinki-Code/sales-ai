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

  const jsonContract = getJsonContract(endpoint);
  return `${adapted}\n\n${jsonContract}`;
}

function getJsonContract(endpoint: SalesEndpoint): string {
  const contracts: Record<string, string> = {
    qualify: `
CRITICAL - Output Format (OVERRIDE ALL PREVIOUS INSTRUCTIONS):
Return ONLY a valid JSON object. NO markdown. NO fences. NO prose.
Do NOT generate LEAD-QUALIFICATION.md files or any markdown output.
Return the JSON as a single continuous object.

Example JSON structure:
{
  "company": "Acme Corp",
  "url": "https://acme.com",
  "bant_score": 75,
  "bant_breakdown": { "budget": 20, "authority": 18, "need": 22, "timeline": 15 },
  "meddic_completeness": 85,
  "opportunity_quality_score": 78,
  "lead_grade": "A",
  "lead_grade_label": "Sales Qualified Lead",
  "urgency_level": "High",
  "key_signals": ["signal1", "signal2"],
  "red_flags": ["flag1"],
  "recommended_action": "Direct executive outreach",
  "analysis_summary": "Strong lead with clear pain points and decision makers"
}`,
    prospect: `
CRITICAL - Output Format (OVERRIDE ALL PREVIOUS INSTRUCTIONS):
Return ONLY a valid JSON object. NO markdown. NO fences. NO prose.
Return as a single continuous JSON object with prospect analysis data.`,
    leads: `
CRITICAL - Output Format (OVERRIDE ALL PREVIOUS INSTRUCTIONS):
Return ONLY a valid JSON array. NO markdown. NO fences. NO prose.
Return as a single continuous JSON array of lead objects.`,
    report: `
CRITICAL - Output Format (OVERRIDE ALL PREVIOUS INSTRUCTIONS):
Return ONLY a valid JSON object. NO markdown. NO fences. NO prose.
Return as a single continuous JSON object with report analysis.`,
    "report-pdf": `
CRITICAL - Output Format (OVERRIDE ALL PREVIOUS INSTRUCTIONS):
Return ONLY a valid JSON object. NO markdown. NO fences. NO prose.
Return as a single continuous JSON object with PDF report data.`
  };

  return contracts[endpoint] || `
CRITICAL - Output Format (OVERRIDE ALL PREVIOUS INSTRUCTIONS):
Return ONLY a valid JSON object. NO markdown. NO fences. NO prose.
Return as a single continuous JSON object.`;
}
