export default function SecurityPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Security</h1>
      <div className="grid grid-3">
        <article className="card"><h3>Credential Safety</h3><p>Anthropic BYOK secrets are encrypted at rest with AES-256-GCM before persistence.</p></article>
        <article className="card"><h3>RLS Isolation</h3><p>Every tenant table is protected by org/workspace policies in Supabase Postgres.</p></article>
        <article className="card"><h3>Operational Hardening</h3><p>Request IDs, audit logs, scoped API keys, rate limiting, retries, and DLQ flows.</p></article>
      </div>
    </main>
  );
}