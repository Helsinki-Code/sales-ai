export default function QuickstartPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Quickstart</h1>
      <article className="card">
        <ol>
          <li>Create org and workspace in dashboard.</li>
          <li>Add Anthropic key in Workspace Settings.</li>
          <li>Create scoped app API key in API Keys section.</li>
          <li>Call `POST /api/v1/sales/qualify` with `Authorization: Bearer &lt;api_key&gt;`.</li>
          <li>Use async pattern for `/prospect`, `/leads`, `/report`, `/report-pdf`.</li>
        </ol>
      </article>
    </main>
  );
}