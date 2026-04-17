export default function DashboardPage() {
  return (
    <main>
      <h1 className="page-title">Dashboard</h1>
      <div className="grid grid-3">
        <article className="card"><h3>Async Jobs</h3><p>Queued, running, complete, and failed jobs by workspace.</p></article>
        <article className="card"><h3>Workspace Health</h3><p>BYOK status, model policy coverage, and endpoint readiness.</p></article>
        <article className="card"><h3>API Keys</h3><p>Active keys, recent usage, and revocation/rotation controls.</p></article>
      </div>
    </main>
  );
}