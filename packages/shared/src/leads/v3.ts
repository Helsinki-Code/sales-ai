import { z } from "zod";

export const leadFinderRequestV3Schema = z.object({
  seller: z.object({
    website: z.string().url(),
    description: z.string().min(10).max(4000).optional(),
    valueProposition: z.string().max(2000).optional()
  }),
  target: z.object({
    industries: z.array(z.string().min(1)).default([]),
    locations: z.array(z.string().min(1)).default([]),
    companySize: z.array(z.string().min(1)).default([]),
    personas: z.array(z.string().min(1)).default([]),
    keywords: z.array(z.string().min(1)).default([]),
    excludeDomains: z.array(z.string().min(1)).default([]),
    excludeIndustries: z.array(z.string().min(1)).default([])
  }).default({}),
  constraints: z.object({
    count: z.number().int().min(5).max(100).default(25),
    minScore: z.number().int().min(0).max(100).default(70),
    requireVerifiedEmail: z.boolean().default(false),
    emailConfidence: z.enum(["any", "pattern_or_better", "verified_or_pattern", "verified_only"]).default("pattern_or_better"),
    maxPagesPerCompany: z.number().int().min(1).max(20).default(5),
    maxRuntimeMinutes: z.number().int().min(2).max(60).default(20)
  }).default({}),
  output: z.object({
    includeEvidence: z.boolean().default(true),
    includeContacts: z.boolean().default(true),
    includeCompanySignals: z.boolean().default(true),
    format: z.literal("leads_v3").default("leads_v3")
  }).default({})
});
export type LeadFinderRequestV3 = z.infer<typeof leadFinderRequestV3Schema>;
export const leadFinderLegacyRequestSchema = z.object({ url: z.string().url(), count: z.number().int().min(5).max(100).default(25) });
export const leadFinderRequestSchema = z.union([leadFinderRequestV3Schema, leadFinderLegacyRequestSchema]);
export type LeadFinderEmailConfidence = "unknown" | "guessed" | "pattern" | "verified";
export const leadFinderResultV3Schema = z.object({
  id: z.string(),
  company: z.object({ name: z.string(), website: z.string().url().optional(), industry: z.string().optional(), location: z.string().optional(), size: z.string().optional(), description: z.string().optional(), linkedin: z.string().optional() }),
  contact: z.object({ name: z.string().optional(), title: z.string().optional(), email: z.string().email().optional(), emailConfidence: z.enum(["unknown", "guessed", "pattern", "verified"]).default("unknown"), linkedin: z.string().optional(), phone: z.string().optional() }).default({}),
  score: z.object({ total: z.number().int().min(0).max(100), grade: z.enum(["A", "B", "C", "D"]), breakdown: z.object({ icpFit: z.number().int().min(0).max(40), personaFit: z.number().int().min(0).max(20), growthSignal: z.number().int().min(0).max(15), techSignal: z.number().int().min(0).max(15), evidenceQuality: z.number().int().min(0).max(10) }), reasons: z.array(z.string()) }),
  signals: z.array(z.object({ type: z.enum(["hiring", "funding", "tech", "growth", "intent", "news", "manual"]), label: z.string(), confidence: z.enum(["low", "medium", "high"]), sourceUrl: z.string().url().optional() })).default([]),
  evidence: z.array(z.object({ title: z.string().optional(), url: z.string().url(), quote: z.string().optional(), capturedAt: z.string() })).default([]),
  status: z.enum(["new", "saved", "dismissed", "exported"]).default("new")
});
export type LeadFinderResultV3 = z.infer<typeof leadFinderResultV3Schema>;
