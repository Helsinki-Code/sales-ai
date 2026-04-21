import { describe, expect, it } from "vitest";
import { computeLeadScore, leadGradeFromScore } from "./scoring.js";

describe("lead scoring", () => {
  it("produces a high score for strong signals", () => {
    const score = computeLeadScore({
      companyIndustry: "B2B SaaS and sales automation",
      companySizeEmployees: "100-500",
      companyLocation: "San Francisco, USA",
      companyFundingRecentDate: "Q1 2026",
      sellerIndustries: ["SaaS", "Sales"],
      sellerTechStack: ["hubspot", "salesforce"],
      techEvidence: "Uses HubSpot and Salesforce heavily",
      hiringEvidence: "Hiring 12 SDR and AE roles",
      growthEvidence: "Major expansion and new office launch",
      hasTechStackMatchFlag: true,
      hasRecentFundingFlag: true,
      hasRecentHiringFlag: true,
      hasGrowthSignalFlag: true
    });

    expect(score.total).toBeGreaterThanOrEqual(80);
    expect(leadGradeFromScore(score.total)).toBe("A");
  });

  it("produces a low score for weak signals", () => {
    const score = computeLeadScore({
      companyIndustry: "Unrelated domain",
      companySizeEmployees: "",
      companyLocation: "",
      companyFundingRecentDate: "",
      sellerIndustries: ["SaaS"],
      sellerTechStack: ["hubspot"],
      techEvidence: "",
      hiringEvidence: "",
      growthEvidence: "",
      hasTechStackMatchFlag: false,
      hasRecentFundingFlag: false,
      hasRecentHiringFlag: false,
      hasGrowthSignalFlag: false
    });

    expect(score.total).toBeLessThan(40);
    expect(leadGradeFromScore(score.total)).toBe("D");
  });
});
