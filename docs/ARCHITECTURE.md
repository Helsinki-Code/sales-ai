# Architecture

## Services
- `apps/api`: HTTP ingress, auth, validation, sync execution, async enqueue.
- `apps/worker`: BullMQ processor for long-running jobs.
- `apps/web`: Next.js site + dashboard + docs.
- `packages/shared`: prompt loader, Anthropic tool loop, web tools, crypto helpers.

## Runtime flow
1. Client calls sales endpoint with app API key.
2. API validates scope + tenant context.
3. API resolves workspace model policy.
4. Sync endpoint executes directly via shared agent runtime.
5. Async endpoint writes job row and enqueues BullMQ job.
6. Worker executes, updates job state/events, writes usage metrics.

### Leads (`/sales/leads`) runtime
- Guarded by `LEADS_ENGINE_MODE`.
- In `parallel_v1` mode, leads uses a dedicated Parallel-only engine path in worker (no Tavily/LLM fallback).
- Stage pipeline:
  - `normalize_input`
  - `seller_profile`
  - `findall_discovery`
  - `candidate_dedupe`
  - `task_enrichment`
  - `deterministic_scoring`
  - `persist_result`
- Deterministic in-house scoring/governance applies evidence thresholds before returning qualified leads.
- Job events include stage metadata for dynamic progress and diagnostics.

## Data ownership
- Durable state in Supabase Postgres.
- Queue/caching in Redis.
- Existing sales assets are vendored at `vendor/ai-sales-team/{skills,scripts,agents,templates}` and reused read-only by path.
- Leads run traces persist in `public.leads_runs` (Parallel run IDs, retries, candidate funnel metrics, evidence coverage).
