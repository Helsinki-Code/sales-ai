import { describe, expect, it } from "vitest";
import { normalizeLeadFinderRequest } from "./normalize.js";
import { scoreLeadCandidates } from "./scoring-v3.js";
const req = normalizeLeadFinderRequest({ seller: { website: "https://seller.com" }, target: { industries: ["SaaS"], personas: ["VP Sales"], keywords: ["AI"] }, constraints: { count: 5, minScore: 0, requireVerifiedEmail: false }, output: { format: "leads_v3" } });
describe("scoring v3", () => {
  it("returns A for strong fit", () => { const [lead] = scoreLeadCandidates([{ company: { name: "Acme SaaS", website: "https://acme.com", industry: "B2B SaaS", description: "AI platform" }, contact: { title: "VP Sales", email: "a@acme.com", emailConfidence: "verified" }, signals: [{ type: "growth", label: "Hiring", confidence: "high" }, { type: "tech", label: "Salesforce", confidence: "high" }], evidence: [{ url: "https://acme.com", quote: "AI", capturedAt: new Date().toISOString() }] }], req); expect(lead.score.grade).toBe("A"); });
  it("filters unverified when required", () => { const strict = normalizeLeadFinderRequest({ ...req, constraints: { ...req.constraints, requireVerifiedEmail: true } }); expect(scoreLeadCandidates([{ company: { name: "Acme" }, contact: { emailConfidence: "pattern" } }], strict)).toHaveLength(0); });
  it("applies minScore", () => { const strict = normalizeLeadFinderRequest({ ...req, constraints: { ...req.constraints, minScore: 99 } }); expect(scoreLeadCandidates([{ company: { name: "Low" }, contact: {} }], strict)).toHaveLength(0); });
});
