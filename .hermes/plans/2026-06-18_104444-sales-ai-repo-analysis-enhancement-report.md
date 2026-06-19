# Sales AI Repository Analysis and Enhancement Report

> **For Hermes:** This is a read-only repository analysis plus prioritized enhancement plan. Implement changes with TDD and verify with `npm run build --workspaces --if-present`, `npm run test --workspaces --if-present`, and the targeted commands listed below.

**Goal:** Assess `/Users/vikky/Desktop/sales/sales-ai` for architecture, build health, security, maintainability, and production-readiness gaps.

**Architecture:** TypeScript npm-workspaces monorepo with Express API, BullMQ worker, Next.js web app, shared AI runtime package, Supabase SQL schema/migrations, Stripe billing, and vendored sales skills. The core runtime path is API auth/validation/model-policy resolution -> sync execution or BullMQ async job -> worker execution -> Supabase job/usage persistence.

**Tech Stack:** Node 20+, TypeScript 5.9, Express 5, BullMQ 5, ioredis 5, Supabase, Next.js 16 / React 19, Stripe, Vitest, Anthropic/OpenAI/Gemini adapters, Redis, Render/Vercel deployment configs.

---

## Executive Summary

The repo is a substantial production SaaS monorepo with a clear service split and strong product coverage: API, worker, web dashboard/site, billing, BYOK credentials, Supabase RLS, job diagnostics, and async sales pipelines are all represented. Documentation is better than typical early-stage repos (`README.md`, architecture/security/deployment docs, API reference, schema/migrations).

However, the repository is **not currently build-clean**. The highest-priority blockers are:

1. **API and worker TypeScript builds fail** because BullMQ consumes a nested `ioredis@5.10.1` type while the workspace uses top-level `ioredis@5.11.1`, producing incompatible protected class types.
2. **Web production build fails without Supabase public env vars** during `/billing` prerender, so CI/build environments need env handling or dynamic rendering changes.
3. **`schema.sql` is stale relative to migrations/code**. A fresh install following `README.md` will miss `default_provider`, `allowed_providers`, unit-billing, managed-usage, and provider enum additions used by current code.
4. **Lint command is broken**: `next lint` is no longer valid for this Next version in the current script setup.
5. **Security posture needs immediate follow-up**: `docs/SECURITY.md` explicitly says to rotate a leaked Supabase service-role key before production; npm audit reports 5 production vulnerabilities, including 1 high severity transitive `path-to-regexp` issue.

Tests that exist pass, but test coverage is thin: only 4 test files / 11 total tests, with no worker tests, no route/middleware integration tests, no billing tests, and no web tests.

---

## What I Inspected

### Repository shape

- Root package: `sales-ai`, private npm workspace monorepo.
- Workspaces:
  - `apps/api` — Express 5 REST API.
  - `apps/worker` — BullMQ worker and long-running job processor.
  - `apps/web` — Next.js product site/dashboard/API proxy routes.
  - `packages/shared` — shared prompt/runtime/tool/crypto/billing/scoring utilities.
- Database:
  - `supabase/schema.sql`
  - migrations under `supabase/migrations/`.
- Docs/content:
  - `docs/*.md`
  - `blogs/*.md`
  - `copy.md`
- Deployment:
  - `Dockerfile`, `docker-compose.yml`, `render.yaml`, `vercel.json`, `cloudbuild.*.yaml`.

### Size / composition, excluding dependency/build/vendor dirs

Computed excluding `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage`, `vendor`, `.turbo`, `.cache`:

- Files: **271**
- Selected text/code lines: **43,214**
- Top directories by file count:
  - `apps`: 197
  - `packages`: 23
  - `blogs`: 19
  - root: 16
  - `docs`: 7
  - `supabase`: 6
  - `scripts`: 3
- Main extensions:
  - `.ts`: 95
  - `.tsx`: 38
  - `.md`: 28
  - `.json`: 15
  - `.sql`: 5

`pygount` was not installed, so I used a read-only Python counter instead.

---

## Verification Results

### Passing

Command:

```bash
npm run test --workspaces --if-present
```

Result:

- `@sales-ai/api`: 1 test file passed, 2 tests passed.
- `@sales-ai/shared`: 3 test files passed, 9 tests passed.
- Total: **4 test files / 11 tests passed**.

Existing test files:

- `apps/api/src/schemas/sales.schemas.test.ts`
- `packages/shared/src/utils/json.test.ts`
- `packages/shared/src/parallel/client.test.ts`
- `packages/shared/src/leads/scoring.test.ts`

### Failing: build

Command:

```bash
npm run build --workspaces --if-present
```

Result: **failed**.

Failures observed:

1. `@sales-ai/api` fails in `src/jobs/queue.ts`:
   - `Type 'Redis' is not assignable to type 'ConnectionOptions'`.
   - Root cause appears to be duplicate `ioredis` versions/types:
     - `node_modules/ioredis`: `5.11.1`
     - `node_modules/bullmq/node_modules/ioredis`: `5.10.1`

2. `@sales-ai/worker` fails in `src/index.ts` and `src/processor.ts` with the same Redis/BullMQ type mismatch, plus job-name typing errors:
   - `Argument of type 'string' is not assignable to parameter of type 'ExtractNameType<DataTypeOrJob, DefaultNameType>'` at worker queue additions.

3. `@sales-ai/web` compiles but fails prerendering `/billing`:
   - `Error: Missing NEXT_PUBLIC_SUPABASE_URL and publishable/anon key`
   - Triggered by strict throwing clients in `apps/web/lib/supabase/client.ts` and `apps/web/lib/supabase/server.ts` during static generation.
   - Build also warns that `middleware` convention is deprecated in Next 16 and should move to `proxy`.
   - Turbopack warns that `apps/web/lib/blog-content.ts` traces too much of the project due filesystem path resolution.

### Failing: lint

Command:

```bash
npm run lint --workspaces --if-present
```

Result: **failed** in `@sales-ai/web`:

```text
Invalid project directory provided, no such directory: /Users/vikky/Desktop/sales/sales-ai/apps/web/lint
```

Cause: `apps/web/package.json` uses `"lint": "next lint"`; current Next CLI is interpreting this incorrectly / the command is no longer supported as expected in this version. Replace with ESLint directly and add an ESLint config, or adopt the current Next linting recommendation.

### Security audit

Command:

```bash
npm audit --omit=dev --audit-level=moderate --json
```

Result: **5 production vulnerabilities**:

- 1 high: `path-to-regexp` via BullMQ stack, vulnerable to DoS ranges `<8.4.0`.
- 4 moderate: `gaxios`, `next`, `postcss`, `uuid`.
- Note: audit suggested an odd `next@9.3.3` semver-major fix path even though installed `next` is `16.2.9`; this should be investigated carefully rather than blindly applying `npm audit fix --force`.

---

## Strengths

1. **Good monorepo separation**
   - API, worker, web, and shared package boundaries are clear.
   - Shared runtime abstractions (`packages/shared`) prevent the API and worker from duplicating prompt/tool/AI execution logic.

2. **Strong domain coverage**
   - Sync and async sales endpoints are explicit.
   - Async leads pipeline includes job stages, provenance, scoring, and continuation support.
   - Billing/unit metering is represented in API and worker paths.

3. **Reasonable security foundations**
   - API keys are hashed (`token_hash`).
   - BYOK credentials are encrypted before storage.
   - Supabase RLS is enabled across tenant tables.
   - Request IDs, job events, and usage records are present for traceability.

4. **Operational shape exists**
   - Render, Vercel, Docker, Cloud Build, and env examples exist.
   - Worker has `/healthz` endpoint.
   - BullMQ retries and DLQ concept are present.

5. **Docs are present and useful**
   - Architecture, API reference, deployment, security, billing, and Supabase setup docs exist.

---

## High-Priority Findings and Recommended Fixes

### P0-1: Fix BullMQ/ioredis TypeScript build failures

**Evidence:** `npm run build --workspaces --if-present` fails in API and worker with incompatible Redis types from top-level `ioredis@5.11.1` and BullMQ nested `ioredis@5.10.1`.

**Likely files:**

- `apps/api/src/lib/redis.ts`
- `apps/api/src/jobs/queue.ts`
- `apps/worker/src/redis.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/processor.ts`
- `package.json` / `package-lock.json`

**Recommended approach:**

1. Prefer dependency dedupe/override first:
   - Add npm `overrides` for `ioredis` to align BullMQ and app code on one version.
   - Run `npm install` and verify `npm ls ioredis` produces a single compatible version.
2. If override is insufficient, type queue/worker `connection` through BullMQ-compatible `ConnectionOptions` or create a tiny adapter module, but avoid blanket `as any` except as a last resort.
3. Fix BullMQ generic/job-name typing by naming job types explicitly or using BullMQ generics that include the job name union, e.g. `"sales-job" | "dlq"` as appropriate.

**Validation:**

```bash
npm ls ioredis
npm run build -w @sales-ai/api
npm run build -w @sales-ai/worker
```

Expected: no TypeScript errors.

---

### P0-2: Make fresh database setup match current code

**Evidence:** `supabase/schema.sql` only defines `provider_type as enum ('anthropic')` and lacks columns that current code selects/upserts:

- `workspace_model_policies.default_provider`
- `workspace_model_policies.allowed_providers`
- managed/unit billing fields in `usage_events` and `usage_daily_rollups`

These appear in migrations, especially `supabase/migrations/20260424_goose_byok_v1.sql`, but `README.md` says to run only `supabase/schema.sql` before starting.

**Impact:** Fresh deployments following the README will fail at runtime in model policy, provider credentials, usage insertion, and possibly billing/lead usage paths.

**Likely files:**

- `supabase/schema.sql`
- `supabase/migrations/*.sql`
- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/SUPABASE_AUTH_SETUP.md`

**Recommended approach:**

1. Either regenerate `supabase/schema.sql` as the current full baseline including all migrations, or update setup docs to run migrations in order.
2. Add a schema drift check in CI that validates code-referenced columns exist in baseline SQL.
3. Make `provider_type` include all supported providers: `anthropic`, `openai`, `gemini`.
4. Include `default_provider` and `allowed_providers` in baseline `workspace_model_policies` definition.
5. Include current usage/billing columns in baseline tables and rollup function.

**Validation:**

```bash
# Ideally in a disposable Supabase/Postgres container
psql "$DATABASE_URL" -f supabase/schema.sql
# Then apply migrations if that remains the documented path
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Expected: baseline plus migrations are idempotent and app queries compile against the resulting schema.

---

### P0-3: Fix web build behavior around Supabase env vars

**Evidence:** `@sales-ai/web` build fails while prerendering `/billing` because Supabase client creation throws when `NEXT_PUBLIC_SUPABASE_URL` or publishable/anon key is absent.

**Likely files:**

- `apps/web/lib/supabase/client.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/app/(app)/billing/page.tsx` or route importing Supabase server client
- `apps/web/package.json`
- Vercel/CI env docs

**Recommended approach:**

Choose one of these paths:

1. **CI/deploy env path:** Ensure all build environments always provide `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. **Dynamic rendering path:** For authenticated dashboard pages like `/billing`, mark them dynamic (`export const dynamic = "force-dynamic"`) and avoid static prerender work that instantiates Supabase at build time.
3. **Graceful build path:** Split env validation so public marketing/static pages can build without dashboard env, while dashboard routes fail at request time with a controlled setup error.

**Validation:**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy \
npm run build -w @sales-ai/web
```

Then validate real deployment envs separately.

---

### P0-4: Address documented leaked Supabase service-role key

**Evidence:** `docs/SECURITY.md` line 8 states: `Required action: rotate leaked Supabase service-role key before production.`

**Recommended approach:**

1. Rotate Supabase service role key immediately if not already done.
2. Search Git history and deployment logs for leaked values.
3. Confirm no `.env` files with real secrets are committed.
4. Add secret scanning to CI, e.g. GitHub secret scanning, Gitleaks, or TruffleHog.
5. Update `docs/SECURITY.md` once rotation is complete, including date/owner if this is internal documentation.

**Validation:**

```bash
# Example local scan; choose the scanner you standardize on
npx gitleaks detect --source . --no-git --redact
```

---

## Medium-Priority Findings

### P1-1: Replace broken lint setup

**Evidence:** `npm run lint --workspaces --if-present` fails because `next lint` is invalid/unsupported in this Next setup.

**Recommended approach:**

1. Add explicit ESLint dependencies/config for Next 16 + TypeScript.
2. Change `apps/web/package.json` script to something like `eslint .`.
3. Add root lint orchestration.

**Validation:**

```bash
npm run lint --workspaces --if-present
```

Expected: lint executes and reports actionable issues instead of CLI failure.

---

### P1-2: Upgrade vulnerable dependencies carefully

**Evidence:** `npm audit --omit=dev --audit-level=moderate --json` reports 5 prod vulnerabilities.

**Recommended approach:**

1. Start with dependency alignment from P0-1.
2. Update BullMQ/path-to-regexp chain to include `path-to-regexp >=8.4.0` if compatible.
3. Investigate Next/PostCSS audit noise; installed top-level `postcss` is `8.5.15`, but audit flags `next/node_modules/postcss` range `<8.5.10`.
4. Avoid `npm audit fix --force` until the Next downgrade/major suggestion is understood.

**Validation:**

```bash
npm audit --omit=dev --audit-level=moderate
npm run build --workspaces --if-present
npm run test --workspaces --if-present
```

---

### P1-3: Add meaningful integration and worker tests

**Evidence:** Only 4 test files and 11 tests exist. No route/middleware integration tests, no worker job tests, no billing tests, and no web tests were found.

**Recommended test additions:**

1. API auth middleware tests:
   - missing auth
   - invalid API key
   - revoked/expired API key
   - OAuth token with missing workspace
   - OAuth token without membership
2. API sales route tests:
   - sync billing precheck
   - async idempotency behavior
   - invalid endpoint/body validation
   - insufficient units response shape
3. Worker processor tests:
   - successful non-leads job completion
   - failed job status/event update
   - continuation job enqueue for `leads`
   - unit reversal on usage insert failure
4. Shared runtime tests:
   - OpenAI/Gemini/Anthropic JSON repair paths
   - max-turn/max-token handling
   - tool error handling
5. Web tests:
   - API proxy auth forwarding
   - billing page behavior with/without session
   - admin model policy form serialization

**Validation:**

```bash
npm run test --workspaces --if-present
```

Target: cover core auth/billing/job paths before broad UI snapshots.

---

### P1-4: Reduce `any` usage in core runtime and web Supabase wrappers

**Evidence:** Static search found frequent `any` in high-risk runtime paths:

- `packages/shared/src/agent/base-agent.ts`
- `apps/api/src/services/jobs.service.ts`
- `apps/api/src/middleware/api-or-oauth-auth.middleware.ts`
- `apps/web/lib/supabase/*.ts`
- `apps/web/lib/api/proxy.ts`
- `apps/web/app/auth/callback/route.ts`

**Recommended approach:**

1. Define provider-specific response interfaces for Anthropic/OpenAI/Gemini rather than using `any` through the whole tool loop.
2. Add Supabase database generated types and use them across API/web/worker.
3. Define `RequestAuth` and augment Express request types with exact auth shape.
4. Add typed error classes for auth, billing, model policy, and provider failures.

---

### P1-5: Fix Next 16 deprecation and Turbopack tracing warning

**Evidence:** Web build warns:

- `middleware` file convention is deprecated; use `proxy` instead.
- `apps/web/lib/blog-content.ts` filesystem resolution causes broad NFT tracing.

**Likely files:**

- `apps/web/middleware.ts`
- `apps/web/lib/blog-content.ts`
- `apps/web/next.config.mjs`

**Recommended approach:**

1. Migrate `middleware.ts` to the current Next `proxy` convention.
2. Make blog content paths statically scoped under known directories where possible.
3. Review `turbopackIgnore` comments; current comments did not fully silence broad tracing.
4. Consider moving markdown ingestion to a build script that outputs JSON under `apps/web/content/`.

---

## Lower-Priority Enhancements

### P2-1: Improve API docs consistency

Findings:

- `docs/API_REFERENCE.md` has a malformed auth line: ``API runtime endpoints: `Authorization: Bearer ***`` missing closing backtick/content clarity.
- It says leads `source_provider` is `parallel`, while `LEADS_ENGINE_MODE=goose_v1` is default in `.env.example` and architecture docs.

Recommended:

- Update docs to show `goose_v1` current default and legacy `parallel_v1` if still supported.
- Add examples for `x-app-api-key`, Supabase bearer, and OAuth bearer + `x-workspace-id`.

### P2-2: Add CI quality gates

Recommended CI jobs:

```bash
npm ci
npm run build --workspaces --if-present
npm run test --workspaces --if-present
npm run lint --workspaces --if-present
npm audit --omit=dev --audit-level=high
```

Add optional schema drift and secret scanning jobs.

### P2-3: Improve observability and runbooks

Good basics exist, but production readiness would improve with:

- Worker queue depth metrics.
- DLQ drain/replay docs.
- Error-code taxonomy for provider/model/billing failures.
- Request ID correlation examples across API logs, job events, and Supabase rows.
- Alert thresholds for failed jobs, exhausted units, provider auth failures, and Redis connection errors.

### P2-4: Harden local developer onboarding

Recommended:

- Add `.env.local.example` for local dev separate from production examples.
- Add `npm run typecheck`, `npm run check`, and `npm run db:reset` scripts.
- Add a one-command local stack (`docker compose up redis` + documented Supabase local flow).
- Document that build requires web public Supabase env vars, or make it not require them.

---

## Suggested Implementation Plan

### Task 1: Restore build health for API and worker

**Objective:** Make TypeScript builds pass for non-web services.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify if needed: `apps/api/src/jobs/queue.ts`
- Modify if needed: `apps/worker/src/index.ts`
- Modify if needed: `apps/worker/src/processor.ts`

**Steps:**

1. Add/adjust npm overrides to align `ioredis` versions used by BullMQ and app code.
2. Run `npm install`.
3. Run `npm ls ioredis` and confirm version alignment.
4. Fix remaining BullMQ job-name generic errors with explicit job-name typing.
5. Run:

```bash
npm run build -w @sales-ai/api
npm run build -w @sales-ai/worker
```

6. Commit:

```bash
git add package.json package-lock.json apps/api/src/jobs/queue.ts apps/worker/src/index.ts apps/worker/src/processor.ts
git commit -m "fix: restore api and worker type builds"
```

### Task 2: Fix web build and lint scripts

**Objective:** Make web build/lint reliable in CI.

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/supabase/server.ts`
- Modify if needed: dashboard page under `apps/web/app/(app)/billing/`
- Create/modify: ESLint config files

**Steps:**

1. Decide whether authenticated pages should be dynamic or whether CI must provide public Supabase env vars.
2. Implement the chosen behavior.
3. Replace `next lint` with supported ESLint command/config.
4. Run:

```bash
npm run build -w @sales-ai/web
npm run lint -w @sales-ai/web
```

### Task 3: Regenerate/repair Supabase baseline schema

**Objective:** Ensure fresh setup matches code and migrations.

**Files:**

- Modify: `supabase/schema.sql`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

**Steps:**

1. Merge all migrations into baseline schema or document ordered migrations as required.
2. Ensure baseline includes provider enum values and model-policy provider columns.
3. Ensure baseline includes managed/unit usage fields and current rollup function.
4. Verify on a disposable database.
5. Update docs so fresh setup instructions are correct.

### Task 4: Add critical-path tests

**Objective:** Raise confidence around auth, billing, async jobs, and schema-sensitive logic.

**Files:**

- Create tests under `apps/api/src/**/*.test.ts`
- Create tests under `apps/worker/src/**/*.test.ts`
- Extend tests under `packages/shared/src/**/*.test.ts`

**Steps:**

1. Add test utilities for mocked Supabase/Redis/BullMQ/provider clients.
2. Add API auth middleware tests.
3. Add sales route idempotency/billing tests.
4. Add worker success/failure/continuation tests.
5. Add shared provider adapter JSON parsing/repair tests.
6. Run:

```bash
npm run test --workspaces --if-present
```

### Task 5: Security and dependency cleanup

**Objective:** Reduce production risk before deployment.

**Files:**

- Modify: `package.json`, `package-lock.json`
- Modify: `docs/SECURITY.md`
- Add CI config if repository uses GitHub Actions or another CI provider

**Steps:**

1. Rotate Supabase service-role key if still outstanding.
2. Add secret scanning to CI.
3. Update vulnerable packages/overrides carefully.
4. Re-run audit and builds/tests.
5. Document completion of the rotation requirement.

---

## Open Questions

1. Is `goose_v1` now the only intended leads engine, or should `parallel_v1` remain supported and documented?
2. Should `schema.sql` be the canonical full baseline, or should setup require applying migrations in order?
3. Which CI provider is intended for this repo: GitHub Actions, Cloud Build, Render/Vercel checks, or all of them?
4. Should web dashboard pages be statically buildable without Supabase env vars, or is requiring env at build time acceptable?
5. Are OpenAI/Gemini providers production-supported now, or experimental behind model policies?

---

## Commands Run During Analysis

```bash
git status --short
npm run test --workspaces --if-present
npm audit --omit=dev --audit-level=moderate --json
npm run build --workspaces --if-present
npm run lint --workspaces --if-present
npm ls / lockfile version inspection for ioredis/next/path-to-regexp/postcss
```

No repository file changes were left by verification commands; `git status --short` was clean after the build/test/lint runs.
