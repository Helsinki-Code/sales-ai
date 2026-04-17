# Supabase Auth Setup (Next.js SSR)

This project uses Supabase Auth as the primary authentication system.

## Stack
- `@supabase/supabase-js`
- `@supabase/ssr`
- Next.js App Router with `proxy.ts`

## Implemented files
- `apps/web/lib/supabase/client.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/lib/supabase/middleware.ts`
- `apps/web/proxy.ts`
- `apps/web/app/login/page.tsx`
- `apps/web/app/auth/callback/page.tsx`
- `apps/web/components/auth-gate.tsx`

## Required env vars (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is supported as fallback during migration.

## Production notes
- Prefer publishable key over legacy anon key.
- Keep service role key only on backend services (Render API/worker).
- Run `supabase/schema.sql` to install RLS and tenant tables.
- Use `x-workspace-id` when calling sales/job endpoints with OAuth bearer tokens.