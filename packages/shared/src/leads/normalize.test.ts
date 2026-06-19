import { describe, expect, it } from "vitest";
import { normalizeLeadFinderRequest } from "./normalize.js";
describe("normalizeLeadFinderRequest", () => {
  it("keeps v3 values", () => { const parsed = normalizeLeadFinderRequest({ seller: { website: "https://sales-ai.app" }, target: { personas: ["Founder"] }, constraints: { count: 15, minScore: 80 }, output: { format: "leads_v3" } }); expect(parsed.target.personas).toEqual(["Founder"]); expect(parsed.constraints.minScore).toBe(80); });
  it("maps legacy requests", () => { const parsed = normalizeLeadFinderRequest({ url: "https://sales-ai.app", count: 10 }); expect(parsed.seller.website).toBe("https://sales-ai.app"); expect(parsed.constraints.count).toBe(10); expect(parsed.output.format).toBe("leads_v3"); });
  it("fails invalid input", () => { expect(() => normalizeLeadFinderRequest({ count: 1 })).toThrow(); });
});
