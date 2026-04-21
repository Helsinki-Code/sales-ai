# Deployment Guide (Render + Vercel + Supabase)

## 1) Supabase
1. Open SQL Editor.
2. Run `supabase/schema.sql`.
3. Rotate leaked service-role key before go-live.
4. Set API URL and keys into Render/Vercel env vars.
5. Enable Supabase Auth OAuth Server and set Authorization Path to `/oauth/consent`.
6. Prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel env.

## 2) Redis
Use managed Redis and copy TLS URI into `REDIS_URL` for both API and worker.

## 3) Render
- Create web service from `sales-ai/render.yaml` entry `sales-ai-api`.
- Create worker service from `sales-ai/render.yaml` entry `sales-ai-worker`.
- Populate env vars from `.env.render.example`.

## 4) Vercel
- Import repo with root `sales-ai/apps/web` (or use `sales-ai/vercel.json`).
- Add env vars from `.env.vercel.example`.
- For private Cloud Run API invocation from Vercel, set these env vars in Vercel:
  - `SALES_API_URL`
  - `GCP_PROJECT_NUMBER`
  - `GCP_SERVICE_ACCOUNT_EMAIL`
  - `GCP_WORKLOAD_IDENTITY_POOL_ID`
  - `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`
- Do not rely on a manually pasted `SALES_API_BEARER_TOKEN` in production (it expires and causes 403).

## 5) Health checks
- API health: `/api/v1/health`
- API readiness: `/api/v1/ready`

## 6) Parallel Leads Engine (production)
Set these worker env vars for the Parallel-only leads engine:
- `LEADS_ENGINE_MODE=parallel_v1`
- `PARALLEL_API_KEY`
- `PARALLEL_BASE_URL=https://api.parallel.ai`
- `PARALLEL_TIMEOUT_MS=120000`
- `PARALLEL_FINDALL_GENERATOR_DEFAULT=core`
- `PARALLEL_FINDALL_ESCALATION_GENERATOR=pro`
- `PARALLEL_FINDALL_BETA_HEADER=findall-2025-09-15`
- `PARALLEL_TASK_PROCESSOR=core`

Behavior:
- With `LEADS_ENGINE_MODE=parallel_v1`, `/sales/leads` runs only on Parallel FindAll + Task.
- No Tavily/LLM fallback path is used for leads.
- Failures return structured error codes through failed job events:
  - `PARALLEL_AUTH_ERROR`
  - `PARALLEL_RATE_LIMITED`
  - `PARALLEL_TIMEOUT`
  - `PARALLEL_SCHEMA_INVALID`
  - `PARALLEL_UPSTREAM_ERROR`
  - `INSUFFICIENT_QUALIFIED_LEADS`

Operational playbook:
- Rate-limit bursts (`429`): lower request volume and retry with backoff; engine already performs bounded retries.
- Upstream outage (`5xx`/timeouts): pause `/sales/leads` usage in UI/API policy and replay failed jobs later.
- Replay failed jobs: resubmit same payload with a fresh `Idempotency-Key`.
- Degraded upstream: temporarily switch `LEADS_ENGINE_MODE=legacy` only if you explicitly want to suspend Parallel-only behavior.

## 7) First smoke test
1. Create org/workspace in dashboard.
2. Add Anthropic BYOK key.
3. Create API key with `sales:run`, `jobs:read`, `jobs:write` scopes.
4. Call `POST /api/v1/sales/qualify`.
5. Call `POST /api/v1/sales/prospect` with `Idempotency-Key` and poll `/api/v1/jobs/:jobId`.
