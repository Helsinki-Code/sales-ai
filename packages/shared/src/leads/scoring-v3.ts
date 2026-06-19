import type { LeadFinderRequestV3, LeadFinderResultV3 } from "./v3.js";
export type LeadCandidateV3 = Partial<LeadFinderResultV3> & { company: LeadFinderResultV3["company"]; contact?: LeadFinderResultV3["contact"]; signals?: LeadFinderResultV3["signals"]; evidence?: LeadFinderResultV3["evidence"]; fitReasons?: string[] };
export function gradeLeadScore(total: number): "A" | "B" | "C" | "D" { return total >= 80 ? "A" : total >= 65 ? "B" : total >= 50 ? "C" : "D"; }
function confidenceRank(confidence?: string): number { return { unknown: 0, guessed: 1, pattern: 2, verified: 3 }[confidence ?? "unknown"] ?? 0; }
function meetsEmailConstraint(confidence: string | undefined, request: LeadFinderRequestV3): boolean {
  const rank = confidenceRank(confidence);
  if (request.constraints.requireVerifiedEmail) return rank >= 3;
  if (request.constraints.emailConfidence === "verified_only") return rank >= 3;
  if (request.constraints.emailConfidence === "verified_or_pattern") return rank >= 2;
  if (request.constraints.emailConfidence === "pattern_or_better") return rank >= 2;
  return true;
}
export function scoreLeadCandidate(candidate: LeadCandidateV3, request: LeadFinderRequestV3): LeadFinderResultV3 | null {
  const signals = candidate.signals ?? [];
  const evidence = candidate.evidence ?? [];
  const contact: LeadFinderResultV3["contact"] = { emailConfidence: "unknown", ...(candidate.contact ?? {}) };
  if (!meetsEmailConstraint(contact.emailConfidence, request)) return null;
  const text = `${candidate.company.industry ?? ""} ${candidate.company.description ?? ""} ${candidate.company.name}`.toLowerCase();
  const targetHits = [...request.target.industries, ...request.target.keywords].filter((v) => text.includes(v.toLowerCase())).length;
  const icpFit = Math.min(40, 18 + targetHits * 7 + (candidate.company.website ? 4 : 0));
  const personaFit = Math.min(20, contact.title && request.target.personas.some((p) => contact.title?.toLowerCase().includes(p.toLowerCase())) ? 20 : contact.title ? 12 : 5);
  const growthSignal = Math.min(15, signals.filter((s) => ["growth", "funding", "hiring"].includes(s.type)).length * 10);
  const techSignal = Math.min(15, signals.filter((s) => ["tech", "intent"].includes(s.type)).length * 10);
  const evidenceQuality = Math.min(10, evidence.length * 6 + (evidence.some((e) => e.quote) ? 4 : 0));
  const total = Math.min(100, icpFit + personaFit + growthSignal + techSignal + evidenceQuality);
  if (total < request.constraints.minScore) return null;
  return { id: candidate.id ?? `lead_${Math.random().toString(36).slice(2, 10)}`, company: candidate.company, contact, signals, evidence, status: candidate.status ?? "new", score: { total, grade: gradeLeadScore(total), breakdown: { icpFit, personaFit, growthSignal, techSignal, evidenceQuality }, reasons: candidate.fitReasons ?? [`${gradeLeadScore(total)} grade fit for requested ICP`, evidence.length ? "Includes supporting evidence" : "Limited evidence available"] } };
}
export function scoreLeadCandidates(candidates: LeadCandidateV3[], request: LeadFinderRequestV3): LeadFinderResultV3[] { return candidates.map((candidate) => scoreLeadCandidate(candidate, request)).filter((lead): lead is LeadFinderResultV3 => Boolean(lead)).sort((a,b)=>b.score.total-a.score.total).slice(0, request.constraints.count); }
