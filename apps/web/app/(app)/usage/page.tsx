export default function UsagePage() {
  return (
    <main>
      <h1 className="page-title">Usage</h1>
      <div className="grid grid-3">
        <article className="card"><h3>Tokens</h3><p>Input/output token totals by endpoint and model.</p></article>
        <article className="card"><h3>Duration</h3><p>Median and p95 runtime for sync and async workloads.</p></article>
        <article className="card"><h3>Key Analytics</h3><p>Consumption trends per API key and workspace.</p></article>
      </div>
    </main>
  );
}