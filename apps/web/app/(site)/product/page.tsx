export default function ProductPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Product</h1>
      <div className="grid grid-3">
        <article className="card"><h3>REST Skill Engine</h3><p>Use `/api/v1/sales/*` endpoints from web apps, CRMs, and automations.</p></article>
        <article className="card"><h3>Queue + Polling Jobs</h3><p>Prospect and leads endpoints run async with job tracking and cancel support.</p></article>
        <article className="card"><h3>Usage Intelligence</h3><p>Track tokens, duration, model usage, and endpoint-level consumption per key.</p></article>
      </div>
    </main>
  );
}