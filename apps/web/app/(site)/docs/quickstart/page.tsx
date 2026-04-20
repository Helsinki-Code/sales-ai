import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Provision a workspace, connect your Anthropic key, and make your first Sales AI API call in about 10 minutes.",
};

export default function QuickstartPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Quickstart</h1>
      <p className="muted">
        Provision a workspace, connect your Anthropic key, and make your first API call. This takes
        about 10 minutes.
      </p>

      <section className="card">
        <h2>Step 1: Create Your Workspace</h2>
        <p>
          Sign up at <a className="text-link" href="https://sales-ai-web-eta.vercel.app/login">sales-ai-web-eta.vercel.app/login</a>.
          After verification, create your workspace. This is your isolated environment for keys,
          usage tracking, and settings.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 2: Connect Your Anthropic Key</h2>
        <p>
          Navigate to <strong>Settings -&gt; API Keys -&gt; Add Anthropic Key</strong>. Your key is
          encrypted with AES-256-GCM before storage. If needed, create a key in
          <a className="text-link" href="https://console.anthropic.com" style={{ marginLeft: "0.4rem" }}>
            Anthropic Console
          </a>.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 3: Set Your Model Policy</h2>
        <p>
          Under <strong>Settings -&gt; Model Policy</strong>, choose the default Claude model. Start
          with <code>claude-sonnet-4-20250514</code> for balanced quality and cost.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 4: Mint a Workspace API Key</h2>
        <p>
          Go to <strong>Settings -&gt; Workspace Keys -&gt; Create Key</strong>. This Bearer token
          authenticates requests to Sales AI. Copy it immediately.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 5: Make Your First Call</h2>
        <p>Use the qualify endpoint to test your setup.</p>
        <pre className="code-block">
{`curl -X POST https://api.sales-ai.app/api/v1/sales/qualify \
  -H "Authorization: Bearer YOUR_WORKSPACE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": "Acme Corp, 500 employees, Series B SaaS, currently using HubSpot"
  }'`}
        </pre>

        <pre className="code-block" style={{ marginTop: "0.9rem" }}>
{`import requests

response = requests.post(
    "https://api.sales-ai.app/api/v1/sales/qualify",
    headers={"Authorization": "Bearer YOUR_WORKSPACE_KEY"},
    json={"lead": "Acme Corp, 500 employees, Series B SaaS, currently using HubSpot"}
)
print(response.json())`}
        </pre>

        <pre className="code-block" style={{ marginTop: "0.9rem" }}>
{`{
  "status": "success",
  "data": {
    "score": 84,
    "tier": "A",
    "reasoning": "Series B company with existing CRM investment signals budget and intent...",
    "recommended_next_action": "Schedule discovery call, lead with ROI angle",
    "disqualifiers": []
  },
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "tokens_used": 312,
    "duration_ms": 1840,
    "request_id": "req_01abc..."
  }
}`}
        </pre>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>What is next</h2>
        <ul>
          <li>Explore all endpoints in API Reference</li>
          <li>Run async jobs with /sales/prospect and /sales/leads</li>
          <li>Track usage in the workspace dashboard</li>
          <li>Add more workspaces on Growth plan</li>
        </ul>
      </section>
    </main>
  );
}

