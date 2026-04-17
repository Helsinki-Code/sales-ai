# Security Notes

- Strict BYOK: workspace must provide Anthropic key.
- Credential encryption: AES-256-GCM before DB insert.
- API keys are hashed at rest (`token_hash`); plaintext only returned on creation/rotation.
- Tenant isolation: RLS policies on all tenant tables.
- Request tracing: `x-request-id` propagated to logs/usage/jobs.
- Job safety: retries + dead-letter queue handling in worker.
- Required action: rotate leaked Supabase service-role key before production.