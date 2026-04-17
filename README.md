# Sales AI (Production Monorepo)

Sales AI is a multi-tenant SaaS platform that exposes 15 AI sales skills through REST APIs, with strict BYOK Anthropic usage, app-issued API keys, async workers, and a professional web product.
It also supports Supabase OAuth 2.1 consent flows for third-party client authorization.

## Monorepo layout

- `apps/api` - Express 5 REST API (auth, validation, enqueue, sync execution)
- `apps/worker` - BullMQ worker for long-running jobs
- `apps/web` - Next.js website, docs, dashboard
- `packages/shared` - prompt/runtime/tool/crypto adapters
- `supabase/schema.sql` - production SQL schema with RLS
- `vendor/ai-sales-team` - vendored upstream skills/scripts/assets used at runtime

## Production requirements

- Node.js 20+
- Managed Redis
- Supabase project (Auth + Postgres)
- Render (API + worker)
- Vercel (web)

## Security model

- Strict BYOK (workspace-level Anthropic key required)
- App API keys hashed at rest and scope-bound
- Supabase Auth SSR with cookie-backed sessions for dashboard access
- Tenant isolation through org/workspace RLS policies
- Encrypted provider credentials in database

## Key commands

```bash
npm install
npm run build -ws --if-present
npm run dev:api
npm run dev:worker
npm run dev:web
```

## Deploy

See:
- `docs/DEPLOYMENT.md`
- `docs/SUPABASE_AUTH_SETUP.md`
- `docs/SUPABASE_OAUTH_SETUP.md`
- `render.yaml`
- `vercel.json`

## SQL setup

Run `supabase/schema.sql` in Supabase SQL Editor before starting the platform.
