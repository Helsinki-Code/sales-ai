import { z } from "zod";

export const endpointEnum = z.enum([
  "quick",
  "research",
  "qualify",
  "contacts",
  "outreach",
  "followup",
  "prep",
  "proposal",
  "objections",
  "icp",
  "competitors",
  "prospect",
  "leads",
  "report",
  "report-pdf"
]);

export const urlSchema = z.object({ url: z.string().url() });
export const leadsSchema = z.object({ url: z.string().url(), count: z.number().int().min(5).max(100) });
export const reportSchema = z.object({ jobIds: z.array(z.string().uuid()).min(1) });

export const outreachSchema = z.object({
  prospect: z.string().min(2),
  url: z.string().url().optional(),
  prospectData: z.record(z.unknown()).optional()
});

export const textTopicSchema = z.object({ topic: z.string().min(2) });
export const icpSchema = z.object({ description: z.string().min(10) });

export const salesBodySchemaByEndpoint = {
  quick: urlSchema,
  research: urlSchema,
  qualify: urlSchema,
  contacts: urlSchema,
  outreach: outreachSchema,
  followup: outreachSchema,
  prep: urlSchema,
  proposal: z.object({ client: z.string().min(2), context: z.record(z.unknown()).optional() }),
  objections: textTopicSchema,
  icp: icpSchema,
  competitors: urlSchema,
  prospect: urlSchema,
  leads: leadsSchema,
  report: reportSchema,
  "report-pdf": z.object({ jobIds: z.array(z.string().uuid()).min(1).optional(), includeCharts: z.boolean().optional() })
} as const;

export const salesRequestSchema = z.object({
  endpoint: endpointEnum,
  payload: z.record(z.unknown()),
  model: z.string().optional()
});