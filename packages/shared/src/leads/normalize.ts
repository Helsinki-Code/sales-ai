import { leadFinderLegacyRequestSchema, leadFinderRequestV3Schema, type LeadFinderRequestV3 } from "./v3.js";
export function normalizeLeadFinderRequest(input: unknown): LeadFinderRequestV3 {
  const v3 = leadFinderRequestV3Schema.safeParse(input);
  if (v3.success) return v3.data;
  const legacy = leadFinderLegacyRequestSchema.parse(input);
  return leadFinderRequestV3Schema.parse({
    seller: { website: legacy.url },
    target: {},
    constraints: {
      count: legacy.count,
      // Legacy playground/API calls only provide a URL + count, so they do not
      // include ICP/persona keywords that help candidates clear the stricter
      // v3 default score threshold. Keep the simple URL flow useful by letting
      // generated candidates through, while richer v3 requests can still set
      // their own minScore/email constraints explicitly.
      minScore: 50,
      emailConfidence: "any"
    },
    output: { format: "leads_v3", includeEvidence: true, includeContacts: true, includeCompanySignals: true }
  });
}
