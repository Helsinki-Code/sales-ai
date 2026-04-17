const endpoints = [
  "quick",
  "research",
  "qualify",
  "contacts",
  "outreach",
  "followup",
  "prep",
  "proposal",
  "objections",
  "icp",
  "competitors",
  "prospect",
  "leads",
  "report",
  "report-pdf"
];

export default function ApiReferencePage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">API Reference</h1>
      <article className="card">
        <p>Base URL: `https://api.sales-ai.app/api/v1`</p>
        <p>Auth: `Authorization: Bearer &lt;app_api_key&gt;`</p>
        <p>OpenAPI JSON: `/api/v1/openapi.json`</p>
      </article>
      <div className="grid grid-3" style={{ marginTop: "1rem" }}>
        {endpoints.map((endpoint) => (
          <article className="card" key={endpoint}>
            <h3>POST /sales/{endpoint}</h3>
            <p>Run `{endpoint}` skill execution with BYOK model policy enforcement.</p>
          </article>
        ))}
      </div>
    </main>
  );
}