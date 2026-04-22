# Multi-Tenant SaaS Data Isolation With Supabase RLS: A Production Pattern

<!-- ============================================================
SEO METADATA
Title tag (58 chars): Supabase RLS Multi-Tenant SaaS: Production Isolation Guide
Meta description (157 chars): One leaked query exposes every tenant's data. Here's how Supabase RLS prevents that — with org-scoped SQL policies, testing patterns, and the schema we use in production at Sales AI.
Primary keyword: Supabase RLS multi-tenant SaaS
Secondary keywords: Supabase row level security multi-tenant, Supabase RLS org isolation, multi-tenant Supabase production, Supabase RLS testing patterns
URL slug: /blog/supabase-rls-multi-tenant-saas
Schema type: TechArticle + FAQPage
============================================================ -->

**Published:** April 2026 | **Reading time:** 12 min | **Audience:** Backend developers building multi-tenant SaaS on Supabase

---

<!-- ============================================================
FEATURED IMAGE
Image gen prompt: Cinematic dark-mode multi-tenant isolation diagram. Three tall vertical "silos" float on a dark charcoal canvas. Each silo is labelled "Org A", "Org B", "Org C" with a different accent colour (blue, purple, green). Inside each silo: small data row cards visible only within their column. A dotted red arrow tries to cross from "Org A" silo to "Org B" silo but is blocked by a glowing white RLS shield labelled "Row Level Security" with a PostgreSQL elephant icon. Below the shield: "0 rows returned" in green instead of "breach". Background: very dark charcoal. No people. 4K, 16:9.
Alt tag: Supabase RLS multi-tenant SaaS data isolation diagram showing three organisation silos with row level security shield blocking cross-tenant data access returning zero rows
============================================================ -->

---

> **The threat model:** In a multi-tenant SaaS, every tenant shares the same database tables. A single missing `WHERE org_id = ?` filter — a one-line bug, a forgotten join condition, an ORM that returns all rows — exposes every tenant's data simultaneously. Row-Level Security (RLS) moves that filter into the database itself, so it can never be forgotten in application code. Here's how to implement it correctly for production.

---

## Table of Contents

1. [What RLS Does (and Doesn't Do)](#what-rls-does)
2. [The Schema: Three Tables That Need RLS](#the-schema)
3. [User-Level Policies vs Org-Level Policies](#user-level-vs-org-level)
4. [Production Org-Scoped RLS Policies](#production-org-scoped-rls)
5. [Performance: Indexing and the STABLE Function Pattern](#performance)
6. [The Service Role Trap — and How to Avoid It](#service-role-trap)
7. [Testing RLS Policies Before They Ship](#testing-rls)
8. [Combining RLS With Encrypted Per-Tenant Secrets](#combining-with-encryption)
9. [How Sales AI Uses This Pattern](#how-sales-ai-uses-this)
10. [FAQ: Supabase RLS Multi-Tenant SaaS](#faq)

---

## What RLS Does (and Doesn't Do)

PostgreSQL's Row-Level Security adds implicit `WHERE` clauses to every query based on policies you define. When a user runs:

```sql
SELECT * FROM api_keys;
```

…with RLS enabled and an org-isolation policy, what Postgres actually executes is:

```sql
SELECT * FROM api_keys
WHERE org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
);
```

The application code never sees the full table. It receives only the rows the current user is authorised to access. Even if application code omits the filter — intentionally or by bug — the database adds it automatically.

**What RLS does:**
- Prevents cross-tenant data leaks when application code has bugs
- Enforces access rules at the database layer, independent of which code path runs the query
- Returns zero rows (not an error) for unauthorised access — making accidental leaks invisible to attackers

**What RLS does not do:**
- Replace authentication (you still need JWT verification)
- Handle feature gating, rate limiting, or complex approval workflows
- Protect against the service role key — which bypasses RLS by design (more on this below)

As [Makerkit's production RLS guide](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — covering 100+ production Supabase deployments — states: *"Any table without RLS enabled in the public schema will be accessible to the public, using the anon role."* RLS is not optional.

<!-- ============================================================
IMAGE 1 — What RLS adds to a query
Image gen prompt: Dark-mode query transformation diagram. Two code blocks side by side connected by a right arrow. LEFT "Query as written by app code": SELECT * FROM api_keys — clean, simple, 1 line in white. Arrow labelled "PostgreSQL adds RLS policy". RIGHT "Query as actually executed": SELECT * FROM api_keys WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()) — highlighted in electric blue. Below right: "Tenant B's rows: 0 returned". Clean dark background with subtle grid. No people. 16:9.
Alt tag: Supabase RLS multi-tenant query transformation showing simple SELECT becoming org-scoped query with automatic WHERE clause added by PostgreSQL row level security policy
============================================================ -->

---

## The Schema: Three Tables That Need RLS

A typical BYOK SaaS schema. Every table that holds tenant data needs RLS enabled.

```sql
-- Organisations (tenants)
CREATE TABLE organisations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organisation membership — which users belong to which org
CREATE TABLE org_members (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role    TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
    UNIQUE (org_id, user_id)
);

-- Encrypted API keys per organisation
CREATE TABLE workspace_api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,          -- 'anthropic' | 'openai'
    encrypted_key TEXT NOT NULL,          -- AES-256-GCM ciphertext
    key_prefix    TEXT NOT NULL,          -- first 8 chars, for display only
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    is_active     BOOLEAN DEFAULT TRUE
);

-- Enable RLS on all tenant data tables
ALTER TABLE organisations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_api_keys ENABLE ROW LEVEL SECURITY;
```

The pattern is consistent: every table has an `org_id` column that links it to a tenant. RLS policies use this column to enforce isolation.

---

## User-Level Policies vs Org-Level Policies

Supabase gives you `auth.uid()` — the UUID of the current authenticated user from their JWT. The simpler user-level isolation is:

```sql
-- User can only see their own data
CREATE POLICY "user_isolation" ON some_table
FOR SELECT USING (user_id = auth.uid());
```

This works for personal data (todos, notes, preferences). For multi-tenant SaaS, you need **org-level isolation** — multiple users share access to the same tenant's data:

```sql
-- Any member of the org can see the org's data
CREATE POLICY "org_isolation" ON workspace_api_keys
FOR SELECT USING (
    org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid()
    )
);
```

This policy lets every user who is a member of Org A see Org A's API keys — and blocks anyone who isn't a member from seeing anything.

---

## Production Org-Scoped RLS Policies

Complete RLS for the three-table schema above:

```sql
-- ─── ORGANISATIONS ──────────────────────────────────────────────────────────

-- Members can view their own org
CREATE POLICY "orgs_select" ON organisations
FOR SELECT USING (
    id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- No direct INSERT via API — orgs created server-side only
CREATE POLICY "orgs_insert" ON organisations
FOR INSERT WITH CHECK (false);  -- blocked; use service role for org creation

-- Owners can update their org
CREATE POLICY "orgs_update" ON organisations
FOR UPDATE USING (
    id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role = 'owner'
    )
);


-- ─── ORG_MEMBERS ────────────────────────────────────────────────────────────

-- Members can see who else is in their org
CREATE POLICY "members_select" ON org_members
FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Admins/owners can add members
CREATE POLICY "members_insert" ON org_members
FOR INSERT WITH CHECK (
    org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- Owners can remove members; members can remove themselves
CREATE POLICY "members_delete" ON org_members
FOR DELETE USING (
    user_id = auth.uid()  -- remove yourself
    OR
    org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role = 'owner'
    )
);


-- ─── WORKSPACE_API_KEYS ─────────────────────────────────────────────────────

-- Members can see their org's keys (shows prefix only; encrypted_key never exposed to client)
CREATE POLICY "keys_select" ON workspace_api_keys
FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Admins/owners can add keys
CREATE POLICY "keys_insert" ON workspace_api_keys
FOR INSERT WITH CHECK (
    org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- Admins/owners can deactivate keys
CREATE POLICY "keys_update" ON workspace_api_keys
FOR UPDATE USING (
    org_id IN (
        SELECT org_id FROM org_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);
```

**The critical detail on api_keys:** The `encrypted_key` column should never be returned to the client. Even with RLS restricting which rows a user can see, you should select only the columns they need — `id`, `provider`, `key_prefix`, `created_at`, `is_active`. The `encrypted_key` is fetched server-side via the service role for decryption.

---

## Performance: Indexing and the STABLE Function Pattern

The org membership subquery runs on **every row evaluation** for every query on org-scoped tables. On a large table, this is a performance problem.

**Step 1: Index every column used in RLS policies**

```sql
-- Absolutely required — without these, RLS causes sequential scans
CREATE INDEX ON org_members (user_id);
CREATE INDEX ON org_members (org_id);
CREATE INDEX ON workspace_api_keys (org_id);
CREATE INDEX ON organisations (id);
```

**Step 2: Wrap the membership check in a STABLE security definer function**

The `STABLE` tag tells the query planner the function returns the same result within a single query — enabling caching. `SECURITY DEFINER` means it runs with the permissions of its creator (bypassing RLS on `org_members` itself, which is intentional since the function is trusted server-side code).

```sql
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
$$;
```

Now use it in all policies:

```sql
-- Replace the subquery pattern with the cached function
CREATE POLICY "keys_select_optimised" ON workspace_api_keys
FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
```

[Makerkit's RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) documents this pattern as the solution to what they call the top performance killer: *"The subquery `account_id IN (SELECT account_id FROM team_members WHERE user_id = auth.uid())` executes on every row evaluation. For large tables, this can be slow."*

<!-- ============================================================
IMAGE 2 — Performance optimisation: subquery vs STABLE function
Image gen prompt: Dark-mode performance comparison. LEFT "Naive subquery policy": SQL shows org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()). An execution timeline bar shows "subquery runs per row" — 500 ticks for a 500-row table. Time label: "~2,400ms". RIGHT "STABLE function policy": SQL shows org_id IN (SELECT get_user_org_ids()). Timeline shows one function call, cached, then 500 row comparisons. Time label: "~8ms". Green arrow showing "300x faster". Dark background. No people. 16:9.
Alt tag: Supabase RLS multi-tenant performance comparison showing naive subquery policy running per-row versus STABLE security definer function with query plan caching 300x faster
============================================================ -->

---

## The Service Role Trap — and How to Avoid It

Supabase has two client keys: the `anon` key (respects RLS) and the `service_role` key (bypasses RLS entirely).

The failure mode is subtle. In a Next.js app:

```typescript
// ✅ API routes handling user requests — RLS enforced
const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// ✅ Server-side admin operations (migrations, background jobs) — RLS bypassed intentionally
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_KEY!);
```

The trap: using `supabaseAdmin` in an API route that handles user requests. This bypasses RLS and returns data from all tenants.

**Detection pattern:**
```sql
-- Run this query to see which tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Any table with rowsecurity = false that holds tenant data is a potential breach
```

**The rule from [DEV Community's multi-tenant RLS deep dive](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2):**

> *"Critical Requirement: Complete data isolation — users should never be able to access data from organisations they don't belong to, even if they try to bypass application-level security."*

Use the service role key only for:
- Database migrations
- Background jobs (nightly aggregation, cleanup)
- Admin dashboard operations where you intentionally need cross-tenant visibility

---

## Testing RLS Policies Before They Ship

Testing RLS is the step most developers skip — and regret. The core problem: running queries in the SQL Editor bypasses RLS (it uses the service role). You need to test from the client SDK, as an authenticated user.

**Pattern 1: Supabase Studio impersonation**

Supabase Studio has a "Table editor" mode where you can impersonate a specific user. Use this for quick manual testing: impersonate User A, verify they see only Org A's data; impersonate User B, verify they see only Org B's data.

**Pattern 2: Automated tests using the anon client**

```typescript
import { createClient } from "@supabase/supabase-js";

const orgAUser = createClient(url, anonKey);
const orgBUser = createClient(url, anonKey);

// Sign in as user from Org A
await orgAUser.auth.signInWithPassword({ email: "user-a@test.com", password: "..." });

// Sign in as user from Org B
await orgBUser.auth.signInWithPassword({ email: "user-b@test.com", password: "..." });

describe("RLS: workspace_api_keys isolation", () => {
    it("Org A user sees only Org A keys", async () => {
        const { data } = await orgAUser.from("workspace_api_keys").select("*");
        expect(data?.every(row => row.org_id === ORG_A_ID)).toBe(true);
    });
    
    it("Org A user cannot see Org B keys", async () => {
        const { data } = await orgAUser
            .from("workspace_api_keys")
            .select("*")
            .eq("org_id", ORG_B_ID);  // explicit filter — should still return 0 rows
        expect(data?.length).toBe(0);
    });
    
    it("Removed member loses access immediately", async () => {
        // Remove user from org
        await supabaseAdmin.from("org_members")
            .delete()
            .eq("user_id", USER_A_ID).eq("org_id", ORG_A_ID);
        
        // Refresh JWT (new token won't have stale claims)
        await orgAUser.auth.refreshSession();
        
        const { data } = await orgAUser.from("workspace_api_keys").select("*");
        expect(data?.length).toBe(0);  // should see nothing after removal
    });
});
```

**The specific test that catches the most bugs:** verify cross-tenant access with an explicit filter. Some developers assume that a policy that returns zero rows *without* a filter is sufficient. But test that even with `eq("org_id", ORG_B_ID)` — where a user explicitly targets the other org — they still get zero rows. RLS should block this regardless of what the query asks for.

**Pattern 3: pgTAP tests in CI**

For production-grade testing, [pgTAP](https://pgtap.org/) lets you write SQL-based test suites that run directly in Postgres. These are particularly useful for verifying RLS behaviour before applying migrations.

---

## Combining RLS With Encrypted Per-Tenant Secrets

RLS controls which rows a user can see. Encryption controls what they see within those rows.

For BYOK API keys, you need both:

```
RLS policy: "org members can SELECT from workspace_api_keys WHERE org_id = their org"
Column-level: "encrypted_key column never returned to client — selected server-side only"
Encryption: "encrypted_key is AES-256-GCM ciphertext — useless without the master key"
```

```sql
-- Add column-level security: never select encrypted_key in client-facing queries
-- Instead, create a view that excludes it
CREATE VIEW workspace_api_keys_public AS
SELECT id, org_id, provider, key_prefix, created_at, is_active
FROM workspace_api_keys;

-- Apply the same RLS policy to the view
ALTER VIEW workspace_api_keys_public ENABLE ROW LEVEL SECURITY;
-- (policies on the underlying table apply to views automatically in Supabase)
```

The `encrypted_key` is fetched only server-side, via the service role, for decryption in memory. The client never receives it — even when a user queries a table they have RLS access to. Full encryption pattern: [AES-256-GCM API Key Storage →](/blog/aes-256-gcm-api-key-storage)

---

## How Sales AI Uses This Pattern

Sales AI's multi-tenant architecture implements exactly this schema:

- `organisations` table with RLS — members see only their own org
- `org_members` table with RLS — role-based access (owner/admin/member)
- `workspace_api_keys` with RLS + AES-256-GCM encryption — members see key prefix only, encrypted value is server-side-only

The service role is used only in two places: (1) background job processing for async prospect discovery jobs, (2) admin operations during workspace creation. Every user-facing API route uses the anon client with the user's JWT — RLS enforced on every query.

[See the full security architecture →](/security)

---

## FAQ: Supabase RLS Multi-Tenant SaaS

### How does Supabase RLS work?

RLS (Row-Level Security) is a PostgreSQL feature that adds implicit `WHERE` clauses to every query based on policies you define. When enabled on a table, Supabase executes your policies on every `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. Policies use `auth.uid()` — the UUID of the authenticated user from their JWT — to determine which rows they can access. Without RLS, any user with your `anon` key can read all rows in your public schema tables.

### How do I isolate data per tenant in Supabase?

Add an `org_id` column to every table that holds tenant data. Enable RLS on those tables. Create policies that allow access only when `org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())`. Index `org_members(user_id)` and `org_members(org_id)` for performance. Wrap the membership check in a `STABLE SECURITY DEFINER` function to enable query plan caching and avoid the subquery running per-row.

### What is row-level security?

Row-Level Security is a database feature (available in PostgreSQL, which Supabase is built on) that enforces access control at the individual row level. Instead of filtering data in application code — which can have bugs, be forgotten in edge cases, or be bypassed by alternative code paths — RLS filters are defined as SQL policies in the database. They apply automatically to every query, regardless of how the database is accessed.

### How do I test RLS policies?

Use the Supabase client SDK with `signInWithPassword` to authenticate as specific test users, then run queries against the tables you've protected. The SQL Editor bypasses RLS and will not catch policy bugs. Write automated tests: (1) Org A user sees only Org A's rows. (2) Org A user gets zero rows when explicitly querying `org_id = Org B`. (3) Removed members immediately lose access after deletion and JWT refresh. Run these in CI before every deployment that changes schema or policies.

### Can RLS be bypassed?

Yes — the `service_role` key bypasses RLS by design, for administrative operations. Never use the service role key in client-facing API routes. Any code path that uses `supabaseAdmin` (service role client) instead of `supabase` (anon client) bypasses all RLS policies. Audit your codebase for uses of the service role key in request handlers. The `anon` key respects all RLS policies and is safe to use in client-facing code when your policies are correct.

---

## Related Resources

- [Sales AI Security Architecture →](/security)
- [AES-256-GCM API Key Storage →](/blog/aes-256-gcm-api-key-storage)
- [How to Build a BYOK SaaS on Top of an LLM →](/blog/bring-your-own-key-llm-saas)
- [Supabase Row-Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Makerkit: Supabase RLS Best Practices (100+ deployments)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase RLS Features Overview](https://supabase.com/features/row-level-security)
- [DEV Community: Multi-Tenant RLS Deep Dive](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)
- [Supabase Vault — encrypted secret storage](https://supabase.com/docs/guides/database/vault)
- [pgTAP — SQL test framework for Postgres](https://pgtap.org/)

---
<!-- SCHEMA: TechArticle + FAQPage, proficiencyLevel: Advanced -->
