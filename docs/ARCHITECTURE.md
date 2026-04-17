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

## Data ownership
- Durable state in Supabase Postgres.
- Queue/caching in Redis.
- Existing sales assets are vendored at `vendor/ai-sales-team/{skills,scripts,agents,templates}` and reused read-only by path.
