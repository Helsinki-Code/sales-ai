import { leadFinderLegacyRequestSchema, leadFinderRequestV3Schema, type LeadFinderRequestV3 } from "./v3.js";
export function normalizeLeadFinderRequest(input: unknown): LeadFinderRequestV3 {
  const v3 = leadFinderRequestV3Schema.safeParse(input);
  if (v3.success) return v3.data;
  const legacy = leadFinderLegacyRequestSchema.parse(input);
  return leadFinderRequestV3Schema.parse({ seller: { website: legacy.url }, target: {}, constraints: { count: legacy.count }, output: { format: "leads_v3", includeEvidence: true, includeContacts: true, includeCompanySignals: true } });
}
