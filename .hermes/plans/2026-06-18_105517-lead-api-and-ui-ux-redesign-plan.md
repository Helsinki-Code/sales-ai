# Lead Finding API Replacement and Complete UI/UX Redesign Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Use strict TDD for API/worker/shared behavior changes. UI tasks should include component-level tests where practical plus real browser verification.

**Goal:** Replace or substantially improve the current `/sales/leads` flow and redesign the complete app UI/UX into a polished developer SaaS experience with a stronger lead-generation workflow, better job observability, and conversion-oriented dashboard UX.

**Architecture:** Keep the existing monorepo/service split, but introduce a versioned Leads V3 contract and a provider-agnostic lead discovery pipeline behind the existing async job system. Redesign the Next.js app around reusable design-system primitives, a clearer information architecture, a dedicated Lead Finder experience, rich lead result tables/cards, and a modern dark developer-tool aesthetic inspired by Linear/Supabase.

**Tech Stack:** Node 20+, TypeScript, Express 5, BullMQ, Supabase, Next.js 16, React 19, Vitest, Testing Library/Playwright to add, Redis, Stripe, Firecrawl/current crawler integrations, optional future enrichment providers.

---

## Current Context

The current app already has:

- API route: `apps/api/src/routes/sales.routes.ts`
- Request validation: `apps/api/src/schemas/sales.schemas.ts`
- Worker routing: `apps/worker/src/processor.ts`
- Current lead engines:
  - `apps/worker/src/goose-leads-engine.ts`
  - `apps/worker/src/leads-engine.ts`
- Shared lead scoring: `packages/shared/src/leads/scoring.ts`
- Current lead UI:
  - `apps/web/app/(app)/sales/page.tsx`
  - `apps/web/app/(app)/sales/[endpoint]/page.tsx`
  - `apps/web/app/(app)/playground/[endpoint]/page.tsx`
  - `apps/web/components/sales/tool-form.tsx`
  - `apps/web/components/sales/job-poller.tsx`
  - `apps/web/components/sales/result-viewer.tsx`
- Current app shell:
  - `apps/web/app/(app)/layout.tsx`
  - `apps/web/components/app/sidebar-nav.tsx`
  - `apps/web/app/globals.css`

Major gaps observed:

1. Current `leadsSchema` is too simple:

```ts
export const leadsSchema = z.object({ url: z.string().url(), count: z.number().int().min(5).max(100) });
```

2. Current UI exposes the lead finder as one generic Sales Tool card instead of a flagship workflow.
3. Current lead form only asks for `url` and `count`, so users cannot specify ICP, geography, personas, exclusions, email confidence, sources, or enrichment preferences.
4. Current lead results are mostly generic cards/JSON. They need a sales-grade table, filters, score explanations, evidence, export, and CRM-friendly actions.
5. Current dashboard uses many inline styles and lacks a consistent reusable UI component system.
6. Existing build/lint/schema blockers from the earlier repo analysis must be fixed before or during implementation, otherwise new work will sit on unstable foundations.

---

## Product Direction

### Lead API should become a real prospecting job spec

Instead of only:

```json
{
  "url": "https://example.com",
  "count": 10
}
```

Add a richer V3 request:

```json
{
  "seller": {
    "website": "https://example.com",
    "description": "AI sales automation API for developer teams",
    "valueProposition": "Automate research, qualification, and outreach from one API"
  },
  "target": {
    "industries": ["B2B SaaS", "Sales tech", "RevOps"],
    "locations": ["United States", "United Kingdom"],
    "companySize": ["11-50", "51-200", "201-500"],
    "personas": ["VP Sales", "Head of RevOps", "Founder"],
    "keywords": ["HubSpot", "Salesforce", "outbound", "AI SDR"],
    "excludeDomains": ["example-competitor.com"],
    "excludeIndustries": ["agencies", "consulting"]
  },
  "constraints": {
    "count": 25,
    "minScore": 70,
    "requireVerifiedEmail": true,
    "emailConfidence": "verified_or_pattern",
    "maxPagesPerCompany": 5,
    "maxRuntimeMinutes": 20
  },
  "output": {
    "includeEvidence": true,
    "includeContacts": true,
    "includeCompanySignals": true,
    "format": "leads_v3"
  }
}
```

For backward compatibility, keep old `{ url, count }` accepted and normalize it into the new shape.

### UI should reposition Lead Finder as the core product

The app should feel less like a generic tool grid and more like a professional lead-generation control center:

- Dashboard: setup status, usage, recent jobs, lead quality trend, unit balance.
- Lead Finder: dedicated flagship workflow with ICP builder, target filters, live job progress, result review, export.
- Jobs: timeline and status for async work.
- Leads: saved/exportable lead history.
- API keys/settings/billing: cleaner admin flows.
- Docs/playground: developer-friendly secondary surfaces.

---

## Design Direction

Use a **dark, premium developer SaaS design** inspired by Linear and Supabase:

- Backgrounds: near-black/dark slate surfaces.
- Accent: indigo/violet for primary actions, emerald for success/verified data.
- Typography: Inter with careful hierarchy; monospace for IDs/code/API details.
- Components: cards, command palette-like search, pill filters, data tables, job timeline, compact metric cards.
- Avoid excessive inline styles; move toward reusable CSS classes/components.

Recommended design token target:

```css
:root {
  --bg: #08090a;
  --surface: #0f1011;
  --surface-2: #191a1b;
  --surface-3: rgba(255, 255, 255, 0.04);
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);
  --text: #f7f8f8;
  --text-muted: #8a8f98;
  --text-soft: #d0d6e0;
  --accent: #7170ff;
  --accent-bg: #5e6ad2;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

---

## Target Information Architecture

Replace the current sidebar links with a clearer product IA:

```ts
const appLinks = [
  { href: "/dashboard", label: "Overview", icon: "LayoutDashboard" },
  { href: "/lead-finder", label: "Lead Finder", icon: "Search" },
  { href: "/jobs", label: "Jobs", icon: "Activity" },
  { href: "/leads", label: "Leads", icon: "Users" },
  { href: "/playground", label: "API Playground", icon: "Terminal" },
  { href: "/usage", label: "Usage", icon: "BarChart3" },
  { href: "/billing", label: "Billing", icon: "CreditCard" },
  { href: "/settings", label: "Settings", icon: "Settings" }
];
```

Keep `/sales` and `/sales/leads` as redirects or legacy routes during migration.

---

## Data Model / API Contract Plan

### New shared types

Create a canonical lead contract in shared code.

**Create:** `packages/shared/src/leads/v3.ts`

```ts
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

export const leadFinderLegacyRequestSchema = z.object({
  url: z.string().url(),
  count: z.number().int().min(5).max(100).default(25)
});

export const leadFinderRequestSchema = z.union([leadFinderRequestV3Schema, leadFinderLegacyRequestSchema]);

export type LeadFinderEmailConfidence = "unknown" | "guessed" | "pattern" | "verified";

export const leadFinderResultV3Schema = z.object({
  id: z.string(),
  company: z.object({
    name: z.string(),
    website: z.string().url().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    size: z.string().optional(),
    description: z.string().optional(),
    linkedin: z.string().optional()
  }),
  contact: z.object({
    name: z.string().optional(),
    title: z.string().optional(),
    email: z.string().email().optional(),
    emailConfidence: z.enum(["unknown", "guessed", "pattern", "verified"]).default("unknown"),
    linkedin: z.string().optional(),
    phone: z.string().optional()
  }).default({}),
  score: z.object({
    total: z.number().int().min(0).max(100),
    grade: z.enum(["A", "B", "C", "D"]),
    breakdown: z.object({
      icpFit: z.number().int().min(0).max(40),
      personaFit: z.number().int().min(0).max(20),
      growthSignal: z.number().int().min(0).max(15),
      techSignal: z.number().int().min(0).max(15),
      evidenceQuality: z.number().int().min(0).max(10)
    }),
    reasons: z.array(z.string())
  }),
  signals: z.array(z.object({
    type: z.enum(["hiring", "funding", "tech", "growth", "intent", "news", "manual"]),
    label: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
    sourceUrl: z.string().url().optional()
  })).default([]),
  evidence: z.array(z.object({
    title: z.string().optional(),
    url: z.string().url(),
    quote: z.string().optional(),
    capturedAt: z.string()
  })).default([]),
  status: z.enum(["new", "saved", "dismissed", "exported"]).default("new")
});

export type LeadFinderResultV3 = z.infer<typeof leadFinderResultV3Schema>;
```

---

## Phase 0: Stabilize Before Feature Work

These tasks are prerequisites because the repo currently has build/lint/schema issues.

### Task 0.1: Fix API and worker build blockers

**Objective:** Make `@sales-ai/api` and `@sales-ai/worker` TypeScript builds pass before changing lead logic.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify if needed: `apps/api/src/jobs/queue.ts`
- Modify if needed: `apps/worker/src/index.ts`
- Modify if needed: `apps/worker/src/processor.ts`

**Steps:**
1. Add npm override to align `ioredis` versions used by app and BullMQ.
2. Run `npm install`.
3. Fix BullMQ queue/worker generics for job names.
4. Run:
   ```bash
   npm run build -w @sales-ai/api
   npm run build -w @sales-ai/worker
   ```
5. Commit:
   ```bash
   git add package.json package-lock.json apps/api/src/jobs/queue.ts apps/worker/src/index.ts apps/worker/src/processor.ts
   git commit -m "fix: restore api and worker builds"
   ```

### Task 0.2: Fix web build/lint baseline

**Objective:** Ensure UI work can be validated continuously.

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/supabase/server.ts`
- Modify: `apps/web/lib/supabase/client.ts`
- Modify dashboard pages if needed under `apps/web/app/(app)/`

**Steps:**
1. Replace broken `next lint` script with supported ESLint setup.
2. Make authenticated pages dynamic or ensure build env requirements are clear.
3. Run:
   ```bash
   npm run build -w @sales-ai/web
   npm run lint -w @sales-ai/web
   ```
4. Commit:
   ```bash
   git add apps/web/package.json apps/web/lib/supabase apps/web/app
   git commit -m "fix: stabilize web build and lint"
   ```

### Task 0.3: Fix schema baseline drift

**Objective:** Ensure the database supports current and new lead contracts.

**Files:**
- Modify: `supabase/schema.sql`
- Modify/create: `supabase/migrations/<timestamp>_lead_finder_v3.sql`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

**Steps:**
1. Update baseline schema or clearly document ordered migrations.
2. Add any new tables from Phase 2.
3. Validate schema on disposable DB.
4. Commit:
   ```bash
   git add supabase README.md docs/DEPLOYMENT.md
   git commit -m "chore: align database schema for lead finder v3"
   ```

---

## Phase 1: Lead API Contract and Backward Compatibility

### Task 1.1: Add Lead Finder V3 shared schemas

**Objective:** Define request/result schemas and type exports in shared package.

**Files:**
- Create: `packages/shared/src/leads/v3.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/leads/v3.test.ts`

**Step 1: Write failing tests**

Create `packages/shared/src/leads/v3.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { leadFinderRequestV3Schema, leadFinderLegacyRequestSchema, leadFinderResultV3Schema } from "./v3.js";

describe("lead finder v3 schemas", () => {
  it("accepts rich v3 target constraints", () => {
    const parsed = leadFinderRequestV3Schema.parse({
      seller: { website: "https://sales-ai.app", description: "AI sales automation API for developer teams" },
      target: { industries: ["B2B SaaS"], personas: ["VP Sales"], locations: ["US"] },
      constraints: { count: 25, minScore: 75, requireVerifiedEmail: true },
      output: { includeEvidence: true, includeContacts: true, includeCompanySignals: true, format: "leads_v3" }
    });

    expect(parsed.constraints.count).toBe(25);
    expect(parsed.constraints.minScore).toBe(75);
    expect(parsed.target.personas).toContain("VP Sales");
  });

  it("keeps legacy url/count accepted for compatibility", () => {
    const parsed = leadFinderLegacyRequestSchema.parse({ url: "https://sales-ai.app", count: 10 });
    expect(parsed.url).toBe("https://sales-ai.app");
    expect(parsed.count).toBe(10);
  });

  it("validates lead result score and evidence", () => {
    const parsed = leadFinderResultV3Schema.parse({
      id: "lead_1",
      company: { name: "Acme", website: "https://acme.com" },
      contact: { email: "jane@acme.com", emailConfidence: "verified" },
      score: {
        total: 86,
        grade: "A",
        breakdown: { icpFit: 35, personaFit: 18, growthSignal: 12, techSignal: 13, evidenceQuality: 8 },
        reasons: ["Strong ICP match"]
      },
      signals: [],
      evidence: [{ url: "https://acme.com/about", quote: "Sales automation", capturedAt: "2026-06-18T00:00:00.000Z" }]
    });

    expect(parsed.score.grade).toBe("A");
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test -w @sales-ai/shared -- src/leads/v3.test.ts
```

Expected: FAIL because `v3.ts` does not exist.

**Step 3: Implement schemas**

Use the schema code shown in the Data Model section.

**Step 4: Export schemas**

Modify `packages/shared/src/index.ts`:

```ts
export * from "./leads/v3.js";
```

**Step 5: Verify**

```bash
npm run test -w @sales-ai/shared -- src/leads/v3.test.ts
npm run build -w @sales-ai/shared
```

**Step 6: Commit**

```bash
git add packages/shared/src/leads/v3.ts packages/shared/src/leads/v3.test.ts packages/shared/src/index.ts
git commit -m "feat: add lead finder v3 contract"
```

### Task 1.2: Normalize legacy and V3 lead requests

**Objective:** Allow existing clients to keep using `{ url, count }` while the worker receives a normalized V3 request.

**Files:**
- Create: `packages/shared/src/leads/normalize.ts`
- Test: `packages/shared/src/leads/normalize.test.ts`
- Modify: `packages/shared/src/index.ts`

**Implementation target:**

```ts
import { leadFinderLegacyRequestSchema, leadFinderRequestV3Schema, type LeadFinderRequestV3 } from "./v3.js";

export function normalizeLeadFinderRequest(input: unknown): LeadFinderRequestV3 {
  const v3 = leadFinderRequestV3Schema.safeParse(input);
  if (v3.success) return v3.data;

  const legacy = leadFinderLegacyRequestSchema.parse(input);
  return leadFinderRequestV3Schema.parse({
    seller: { website: legacy.url },
    target: {},
    constraints: { count: legacy.count },
    output: { format: "leads_v3", includeEvidence: true, includeContacts: true, includeCompanySignals: true }
  });
}
```

**Tests:**

- V3 request returns same core values.
- Legacy request maps `url` to `seller.website` and `count` to `constraints.count`.
- Invalid request fails.

**Validation:**

```bash
npm run test -w @sales-ai/shared -- src/leads/normalize.test.ts
npm run build -w @sales-ai/shared
```

---

## Phase 2: Replace/Upgrade Lead Finding Engine

### Task 2.1: Introduce provider-agnostic LeadFinderEngine interface

**Objective:** Decouple the worker from one hard-coded lead engine implementation.

**Files:**
- Create: `apps/worker/src/leads/types.ts`
- Create: `apps/worker/src/leads/lead-finder-engine.ts`
- Modify: `apps/worker/src/processor.ts`
- Test: `apps/worker/src/leads/lead-finder-engine.test.ts`

**Target interface:**

```ts
import type { LeadFinderRequestV3, LeadFinderResultV3 } from "@sales-ai/shared";

export type LeadFinderProgress = {
  stage: string;
  progress: number;
  message: string;
  metadata?: Record<string, unknown>;
};

export type LeadFinderRunInput = {
  jobId: string;
  orgId: string;
  workspaceId: string;
  request: LeadFinderRequestV3;
  llm: {
    provider: "anthropic" | "openai" | "gemini";
    model: string;
    apiKey: string;
  };
  onProgress?: (progress: LeadFinderProgress) => Promise<void> | void;
};

export type LeadFinderRunResult = {
  leads: LeadFinderResultV3[];
  stats: {
    discoveredCompanies: number;
    dedupedCompanies: number;
    reviewedCompanies: number;
    acceptedLeads: number;
    crawlerRuns: number;
    pagesCrawled: number;
    verificationRuns: number;
    estimatedCostUsd: number;
  };
  continuation?: {
    needed: boolean;
    state?: Record<string, unknown>;
  };
};

export interface LeadFinderEngine {
  run(input: LeadFinderRunInput): Promise<LeadFinderRunResult>;
}
```

**Engine choices:**

Create an env-controlled strategy:

```ts
LEAD_FINDER_ENGINE=managed_v3 | goose_v1 | parallel_v1 | mock
```

Keep existing engines during transition.

### Task 2.2: Add deterministic scoring V3 adapter

**Objective:** Standardize scoring and grade output independent of the discovery provider.

**Files:**
- Create: `packages/shared/src/leads/scoring-v3.ts`
- Test: `packages/shared/src/leads/scoring-v3.test.ts`

**Scoring target:**

- `icpFit`: 0-40
- `personaFit`: 0-20
- `growthSignal`: 0-15
- `techSignal`: 0-15
- `evidenceQuality`: 0-10
- Total: 0-100
- Grade:
  - A: 80-100
  - B: 65-79
  - C: 50-64
  - D: <50

**Tests:**

- High ICP + verified evidence returns A.
- Missing evidence caps evidenceQuality.
- Require-verified-email filters unverified contacts.
- minScore removes low-scoring leads.

### Task 2.3: Build `managed_v3` lead finder wrapper

**Objective:** Implement the new engine wrapper while reusing stable pieces from `goose-leads-engine.ts` where appropriate.

**Files:**
- Create: `apps/worker/src/leads/managed-v3-engine.ts`
- Modify: `apps/worker/src/goose-leads-engine.ts` only if extracting reusable pure helpers
- Test: `apps/worker/src/leads/managed-v3-engine.test.ts`

**Recommended design:**

Pipeline stages:

1. `normalize_request`
2. `seller_profile`
3. `target_strategy`
4. `company_discovery`
5. `company_dedupe`
6. `company_enrichment`
7. `contact_discovery`
8. `email_confidence`
9. `scoring`
10. `evidence_packaging`
11. `persist_result`

**Important:** keep external API wrappers injectable for tests:

```ts
type LeadFinderDeps = {
  searchCompanies: SearchCompaniesFn;
  scrapeCompany: ScrapeCompanyFn;
  enrichContact: EnrichContactFn;
  now: () => Date;
};
```

Tests should use fake deps, not real network.

### Task 2.4: Wire V3 engine into worker processor

**Objective:** Route `/sales/leads` jobs through the new engine.

**Files:**
- Modify: `apps/worker/src/processor.ts`
- Modify: `apps/worker/src/config.ts`
- Test: `apps/worker/src/processor.leads-v3.test.ts`

**Behavior:**

- Parse/normalize payload using `normalizeLeadFinderRequest`.
- Select engine by `LEAD_FINDER_ENGINE`.
- Record richer managed usage stats.
- Continue supporting cancellation and continuation.
- Return V3 lead result array.

**Validation:**

```bash
npm run test -w @sales-ai/worker -- src/processor.leads-v3.test.ts
npm run build -w @sales-ai/worker
```

### Task 2.5: Add lead persistence tables

**Objective:** Store leads separately from raw job result payloads so UI can list/search/export them later.

**Files:**
- Create: `supabase/migrations/<timestamp>_lead_finder_v3_tables.sql`
- Modify: `supabase/schema.sql`
- Create: `apps/worker/src/leads/persist-leads.ts`
- Test: `apps/worker/src/leads/persist-leads.test.ts`

**Proposed tables:**

```sql
create table public.lead_finder_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_payload jsonb not null,
  status text not null,
  requested_count integer not null default 0,
  returned_count integer not null default 0,
  discovered_companies integer not null default 0,
  reviewed_companies integer not null default 0,
  accepted_leads integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.lead_finder_runs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_name text not null,
  company_website text,
  company_domain text,
  contact_name text,
  contact_title text,
  contact_email text,
  email_confidence text not null default 'unknown',
  score integer not null,
  grade text not null,
  status text not null default 'new',
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_workspace_created on public.leads(workspace_id, created_at desc);
create index idx_leads_workspace_score on public.leads(workspace_id, score desc);
create index idx_leads_company_domain on public.leads(workspace_id, company_domain);
```

Add RLS policies equivalent to jobs/leads_runs.

### Task 2.6: Add export endpoint for leads

**Objective:** Let users export lead results as CSV without copying JSON manually.

**Files:**
- Create: `apps/web/app/api/admin/leads/export/route.ts`
- Create: `apps/web/lib/leads/csv.ts`
- Test: `apps/web/lib/leads/csv.test.ts`

**Behavior:**

- Query leads by `runId` or selected lead IDs.
- Return CSV columns:
  - company_name
  - company_website
  - contact_name
  - contact_title
  - contact_email
  - email_confidence
  - score
  - grade
  - fit_reasons
  - evidence_urls
- Never export another workspace's leads.

---

## Phase 3: Complete UI/UX Redesign Foundation

### Task 3.1: Create UI design tokens and base classes

**Objective:** Replace scattered inline styles with a cohesive design system.

**Files:**
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/components/ui/button.tsx`
- Create: `apps/web/components/ui/card.tsx`
- Create: `apps/web/components/ui/badge.tsx`
- Create: `apps/web/components/ui/input.tsx`
- Create: `apps/web/components/ui/textarea.tsx`
- Create: `apps/web/components/ui/tabs.tsx`
- Create: `apps/web/components/ui/progress.tsx`

**Design requirements:**

- Dark native app shell.
- Tokenized surfaces/borders/text/accent.
- Accessible focus rings.
- No mouse-only hover state logic in JSX.
- Buttons support variants: `primary`, `secondary`, `ghost`, `danger`.
- Badges support variants: `neutral`, `success`, `warning`, `danger`, `accent`.

**Validation:**

```bash
npm run build -w @sales-ai/web
```

### Task 3.2: Redesign app shell and sidebar

**Objective:** Make navigation feel like a premium SaaS dashboard.

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx`
- Modify: `apps/web/components/app/sidebar-nav.tsx`
- Create: `apps/web/components/app/topbar.tsx`
- Create: `apps/web/components/app/workspace-switcher.tsx`
- Modify: `apps/web/app/globals.css`

**UX requirements:**

- Sidebar has grouped nav:
  - Product: Overview, Lead Finder, Jobs, Leads
  - Developer: API Playground, API Reference, API Keys
  - Admin: Usage, Billing, Settings
- Topbar includes workspace name, search/command placeholder, unit balance, user menu.
- Mobile layout collapses sidebar into top nav/drawer.

### Task 3.3: Redesign dashboard overview

**Objective:** Replace generic setup cards with a useful operational overview.

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`
- Create: `apps/web/components/dashboard/metric-card.tsx`
- Create: `apps/web/components/dashboard/onboarding-checklist.tsx`
- Create: `apps/web/components/dashboard/recent-jobs.tsx`
- Create: `apps/web/components/dashboard/lead-quality-summary.tsx`

**Dashboard sections:**

1. Setup checklist:
   - Provider key configured
   - API key created
   - Billing active / units available
   - First lead finder run completed
2. Metrics:
   - Units remaining
   - Leads found this month
   - Average lead score
   - Job success rate
3. Recent lead finder jobs.
4. CTA panel: “Find your next 25 leads”.

---

## Phase 4: Dedicated Lead Finder UX

### Task 4.1: Add `/lead-finder` route

**Objective:** Create a flagship page for lead generation.

**Files:**
- Create: `apps/web/app/(app)/lead-finder/page.tsx`
- Create: `apps/web/components/lead-finder/lead-finder-page.tsx`
- Create: `apps/web/components/lead-finder/lead-finder-form.tsx`
- Create: `apps/web/components/lead-finder/lead-finder-preview.tsx`
- Create: `apps/web/components/lead-finder/lead-finder-presets.tsx`
- Modify: `apps/web/components/app/sidebar-nav.tsx`

**UX layout:**

- Left: multi-step form.
- Right: live request preview + estimated units + explanation.
- Bottom/right after submit: job timeline and results.

**Form steps:**

1. Seller profile:
   - Website
   - Description
   - Value proposition
2. Target accounts:
   - Industries
   - Locations
   - Company size
   - Keywords
   - Exclusions
3. Buyer personas:
   - Titles/personas
   - Seniority
   - Departments
4. Quality constraints:
   - Count
   - Min score
   - Email confidence
   - Require verified email
5. Review and run.

### Task 4.2: Add client-side validation and request builder

**Objective:** Build valid V3 payloads in the UI before submission.

**Files:**
- Create: `apps/web/lib/lead-finder/build-request.ts`
- Create: `apps/web/lib/lead-finder/build-request.test.ts`
- Modify: `apps/web/components/lead-finder/lead-finder-form.tsx`

**Tests:**

- Empty optional arrays normalize to `[]`.
- Count/minScore parse to numbers.
- Seller website is required.
- Exclude domains split comma/newline input correctly.

**Validation:**

```bash
npm run test -w @sales-ai/web -- lib/lead-finder/build-request.test.ts
```

### Task 4.3: Add lead finder API client hook

**Objective:** Remove duplicated fetch logic from sales/playground pages and use typed functions.

**Files:**
- Create: `apps/web/lib/api/lead-finder-client.ts`
- Create: `apps/web/hooks/use-lead-finder-job.ts`
- Modify: `apps/web/components/lead-finder/lead-finder-page.tsx`

**Behavior:**

- POST `/api/sales/leads` with V3 payload.
- Use idempotency key per run.
- Poll job status.
- Expose states: `idle`, `submitting`, `queued`, `running`, `complete`, `failed`, `cancelled`.
- Expose progress, stage, message, metadata, result.

### Task 4.4: Redesign job progress timeline

**Objective:** Turn current generic `JobPoller` into a rich stage timeline.

**Files:**
- Create: `apps/web/components/jobs/job-timeline.tsx`
- Modify: `apps/web/components/sales/job-poller.tsx` or replace with wrapper
- Create: `apps/web/components/jobs/job-status-card.tsx`

**UI states:**

- Queued
- Discovering companies
- Scraping/evidence gathering
- Reviewing ICP fit
- Finding contacts
- Verifying emails
- Scoring
- Persisting results
- Complete / Failed / Cancelled

**Show metadata chips:**

- discovered count
- accepted count
- rejected count
- pages crawled
- confidence threshold
- continuation slice

### Task 4.5: Build lead results table and card detail view

**Objective:** Replace raw JSON/cards with a workflow users can actually use.

**Files:**
- Create: `apps/web/components/lead-finder/lead-results-table.tsx`
- Create: `apps/web/components/lead-finder/lead-detail-panel.tsx`
- Create: `apps/web/components/lead-finder/lead-score-breakdown.tsx`
- Create: `apps/web/components/lead-finder/evidence-list.tsx`
- Create: `apps/web/components/lead-finder/export-button.tsx`
- Modify: `apps/web/components/sales/result-viewer.tsx` to delegate leads V3 rendering

**Table columns:**

- Grade / score
- Company
- Contact
- Email confidence
- Persona fit
- Signals
- Evidence count
- Actions

**Actions:**

- View evidence
- Copy email
- Copy row
- Save lead
- Dismiss lead
- Export CSV

**Filters:**

- Min score
- Grade
- Email confidence
- Signal type
- Location
- Industry

---

## Phase 5: Leads and Jobs Pages

### Task 5.1: Add `/jobs` page

**Objective:** Let users view all async jobs, not only the active one.

**Files:**
- Create: `apps/web/app/(app)/jobs/page.tsx`
- Create: `apps/web/components/jobs/jobs-table.tsx`
- Create: `apps/web/components/jobs/job-filters.tsx`
- Create: `apps/web/app/api/admin/jobs/route.ts`

**Features:**

- List recent jobs.
- Filter by endpoint/status/date.
- Open job details.
- Retry failed job if supported later.
- Cancel running job.

### Task 5.2: Add `/leads` page

**Objective:** Create a CRM-lite saved leads workspace.

**Files:**
- Create: `apps/web/app/(app)/leads/page.tsx`
- Create: `apps/web/components/leads/leads-table.tsx`
- Create: `apps/web/components/leads/leads-filters.tsx`
- Create: `apps/web/components/leads/lead-actions.tsx`
- Create: `apps/web/app/api/admin/leads/route.ts`

**Features:**

- Saved and generated leads across runs.
- Search by company/contact/domain.
- Filter by score/status/email confidence.
- Bulk export.
- Dismiss/save/update status.

---

## Phase 6: Retire Generic Sales Tool UX or Make It Secondary

### Task 6.1: Redirect legacy `/sales/leads` to `/lead-finder`

**Objective:** Prevent users from landing in the old weak lead form.

**Files:**
- Modify: `apps/web/app/(app)/sales/[endpoint]/page.tsx`
- Modify: `apps/web/app/(app)/sales/page.tsx`

**Behavior:**

- If endpoint is `leads`, link/redirect to `/lead-finder`.
- Sales tools page can remain for non-lead tools.
- Rename `Sales Tools` to `AI Sales Tools` and visually de-emphasize relative to Lead Finder.

### Task 6.2: Refactor shared endpoint metadata

**Objective:** Remove duplicated `TOOL_INFO`, endpoint aliases, and endpoint lists across sales/playground/reference.

**Files:**
- Create: `apps/web/lib/sales/endpoints.ts`
- Modify: `apps/web/app/(app)/sales/page.tsx`
- Modify: `apps/web/app/(app)/sales/[endpoint]/page.tsx`
- Modify: `apps/web/app/(app)/playground/[endpoint]/page.tsx`
- Modify: `apps/web/components/reference/snippet-generator.ts`

**Validation:**

```bash
npm run build -w @sales-ai/web
```

---

## Phase 7: Documentation and API Developer Experience

### Task 7.1: Update API docs for Leads V3

**Objective:** Make the new lead API understandable for developers.

**Files:**
- Modify: `docs/API_REFERENCE.md`
- Modify: `apps/api/src/openapi/spec.ts`
- Modify: `apps/web/app/(site)/docs/api-reference/page.tsx`
- Modify: `apps/web/components/reference/snippet-generator.ts`

**Docs must include:**

- Legacy request compatibility.
- V3 request example.
- V3 response example.
- Job polling flow.
- CSV export flow.
- Error codes.
- Unit cost explanation.

### Task 7.2: Add lead finder quickstart

**Files:**
- Create: `docs/LEAD_FINDER.md`
- Create/modify: `apps/web/app/(site)/docs/lead-finder/page.tsx`

**Content:**

- “Find your first 25 leads” guide.
- UI guide.
- API guide.
- Best practices for ICP inputs.
- How scoring works.

---

## Phase 8: Verification and Release Checklist

### Task 8.1: Add full quality gate

**Objective:** Ensure the app is shippable after major changes.

**Files:**
- Modify: `package.json`
- Add CI config if repo uses GitHub Actions: `.github/workflows/ci.yml`

**Root scripts:**

```json
{
  "scripts": {
    "check": "npm run lint --workspaces --if-present && npm run test --workspaces --if-present && npm run build --workspaces --if-present",
    "typecheck": "npm run build --workspaces --if-present"
  }
}
```

**Validation:**

```bash
npm run check
```

### Task 8.2: Browser QA checklist

**Objective:** Verify the redesigned UX in real usage.

**Manual/browser cases:**

1. Logged-out user sees login and cannot access app pages.
2. New user lands on onboarding dashboard.
3. User can open `/lead-finder`.
4. User can enter seller profile and target filters.
5. Submit shows queued/running timeline.
6. Complete job shows lead table, score breakdown, evidence panel.
7. CSV export downloads expected rows.
8. `/jobs` shows the completed job.
9. `/leads` shows persisted leads.
10. Mobile layout works at 390px width.
11. Keyboard navigation works for main forms/buttons.
12. Focus rings are visible on dark theme.

### Task 8.3: API compatibility checks

**Objective:** Ensure existing customers do not break.

**Requests to test:**

Legacy:

```bash
curl -X POST "$API_BASE_URL/api/v1/sales/leads" \
  -H "Authorization: Bearer $APP_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: legacy-test-1" \
  -d '{"url":"https://sales-ai.app","count":5}'
```

V3:

```bash
curl -X POST "$API_BASE_URL/api/v1/sales/leads" \
  -H "Authorization: Bearer $APP_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: v3-test-1" \
  -d '{
    "seller": {"website":"https://sales-ai.app","description":"AI sales automation API"},
    "target": {"industries":["B2B SaaS"],"personas":["VP Sales"]},
    "constraints": {"count":5,"minScore":70},
    "output": {"format":"leads_v3"}
  }'
```

Expected:

- Both return `202` with `jobId`.
- Polling job returns V3 lead result shape.

---

## Risks and Tradeoffs

### Risk: Lead generation quality depends on external data providers

Mitigation:

- Keep provider adapters injectable.
- Track provider usage and error rates.
- Add mock mode and deterministic tests.
- Return evidence and confidence instead of pretending certainty.

### Risk: Rich request schema may overwhelm users

Mitigation:

- UI should progressively disclose advanced filters.
- Provide presets like “B2B SaaS”, “Local services”, “Enterprise IT”.
- Keep legacy URL/count quick mode.

### Risk: Full dark redesign may affect marketing site readability

Mitigation:

- Apply dark app shell mainly to authenticated dashboard first.
- Keep marketing pages separate if their current light style converts better.
- Use real browser QA and accessibility checks.

### Risk: Database migration complexity

Mitigation:

- Add new tables without destructive changes.
- Keep job result payloads as fallback.
- Backfill only if needed later.

---

## Acceptance Criteria

### Lead API

- Existing `{ url, count }` clients still work.
- New V3 payload supports seller profile, target filters, personas, exclusions, quality constraints, and output options.
- Worker returns V3-normalized lead results with score, grade, contact, evidence, and signals.
- Leads are persisted in queryable tables.
- CSV export works and respects workspace isolation.
- Unit billing still works for lead jobs.

### UI/UX

- App has cohesive dark developer SaaS design.
- `/lead-finder` is the primary lead generation workflow.
- Lead form is multi-step and understandable.
- Job progress is clear and confidence-building.
- Lead results are actionable: filter, inspect, copy, save, dismiss, export.
- Dashboard shows useful setup, usage, and lead quality metrics.
- Navigation is clearer and mobile-friendly.
- Inline style usage is significantly reduced in new/changed surfaces.

### Quality

- `npm run test --workspaces --if-present` passes.
- `npm run build --workspaces --if-present` passes.
- `npm run lint --workspaces --if-present` passes after lint setup is fixed.
- New critical behavior is covered by tests written before implementation.
- Browser QA checklist passes.

---

## Suggested Implementation Order

1. Phase 0: stabilize build/lint/schema.
2. Phase 1: shared Leads V3 contract and normalization.
3. Phase 2: engine abstraction and V3 worker wiring.
4. Phase 4: dedicated `/lead-finder` UI using existing job API.
5. Phase 2.5/5.2: persistence and leads page.
6. Phase 3: design-system refactor across app shell/dashboard.
7. Phase 5.1: jobs page.
8. Phase 6: legacy sales/playground cleanup.
9. Phase 7: docs/OpenAPI/snippets.
10. Phase 8: full verification and release.

---

## Open Questions for Product Decision

1. Should Lead Finder V3 rely only on current managed crawler/Firecrawl-style sources, or should it integrate external enrichment APIs such as Apollo/Clearbit/People Data Labs later?
2. Do we want verified emails only, or is pattern-derived email acceptable if clearly labeled?
3. Should leads be saved automatically, or only after user clicks Save?
4. Should `/sales` remain visible, or should the product focus around `/lead-finder`, `/jobs`, and `/leads`?
5. Should the marketing site also move to the dark Linear/Supabase aesthetic, or only the authenticated dashboard?
6. What CRM export targets matter first: CSV, HubSpot, Salesforce, Clay, Apollo, or webhook?

---

## Final Note

This plan intentionally treats the lead API replacement and UI/UX redesign as one product redesign, not two unrelated refactors. The best user experience comes from aligning the API contract, worker progress model, persisted data, and dashboard UI around the same mental model: **define ICP -> run lead discovery -> watch progress -> inspect evidence -> export/action qualified leads**.
