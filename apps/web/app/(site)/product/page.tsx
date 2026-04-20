import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const prospecting = [
  ["/sales/research", "Deep-dive company and contact research"],
  ["/sales/prospect", "Async batch prospect discovery"],
  ["/sales/leads", "Async lead discovery with polling"],
  ["/sales/icp", "ICP fit scoring and gap analysis"],
  ["/sales/competitors", "Competitive positioning and battlecards"],
] as const;

const outreach = [
  ["/sales/outreach", "Personalized first-touch outreach"],
  ["/sales/followup", "Multi-step follow-up sequence generation"],
  ["/sales/contacts", "Contact enrichment and profile building"],
] as const;

const execution = [
  ["/sales/qualify", "Lead scoring with explicit reasoning"],
  ["/sales/prep", "Pre-call briefing and talk track"],
  ["/sales/objections", "Deal-specific objection handling"],
  ["/sales/proposal", "Proposal generation from context"],
] as const;

const reporting = [
  ["/sales/report", "Sales performance reporting"],
  ["/sales/report-pdf", "PDF report export"],
  ["/sales/quick", "Instant utility query endpoint"],
] as const;

export const metadata: Metadata = {
  title: "Everything a Sales Team Needs. Callable from Your Code.",
  description:
    "REST API with 15 purpose-built sales endpoints for research, qualification, outreach, and reporting. Bring your own key and ship fast.",
};

function EndpointTable({ title, rows }: { title: string; rows: readonly (readonly [string, string])[] }) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([endpoint, detail]) => (
            <tr key={endpoint}>
              <td>
                <code>{endpoint}</code>
              </td>
              <td>{detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export default function ProductPage() {
  return (
    <main>
      <section className="container hero hero-with-visual">
        <div>
          <p className="eyebrow">Product</p>
          <h1>Everything a Sales Team Needs. Callable from Your Code.</h1>
          <p>
            Sales AI is a REST API with 15 purpose-built endpoints covering research, qualification,
            outreach, proposals, objections, and competitive intelligence. Bring your own Anthropic
            key and wire it into the stack you already run.
          </p>
          <div className="inline-actions">
            <Link className="cta" href="/login">
              Connect Your Key
            </Link>
            <Link className="text-link" href="/docs/api-reference">
              View API Reference -&gt;
            </Link>
          </div>
        </div>

        <figure className="visual-panel">
          <Image
            src="/brand/product-endpoints.svg"
            alt="Minimal endpoint map visual showing grouped sales API capabilities"
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <section className="container main-section">
        <h2 className="section-title">One base URL. Fifteen sales skills.</h2>
        <p className="muted">
          Every endpoint in <code>POST /api/v1/sales/*</code> is built for one specific sales job.
          Structured JSON in, structured JSON out.
        </p>
        <pre className="code-block">
{`curl -X POST https://api.sales-ai.app/api/v1/sales/research \
  -H "Authorization: Bearer YOUR_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"company":"Acme Corp","context":"B2B SaaS, Series B, uses Salesforce"}'`}
        </pre>
        <p className="muted small">Consistent envelope for every endpoint. Parse it once and reuse everywhere.</p>
      </section>

      <section className="container main-section">
        <h2 className="section-title">Built for the full sales cycle</h2>
        <p className="muted">
          Not generic completions. Purpose-built endpoints with stable schemas your app can act on.
        </p>
        <div className="grid grid-2">
          <EndpointTable title="Prospecting and Intelligence" rows={prospecting} />
          <EndpointTable title="Outreach and Sequencing" rows={outreach} />
          <EndpointTable title="Deal Execution" rows={execution} />
          <EndpointTable title="Reporting and Utilities" rows={reporting} />
        </div>
        <div className="inline-actions">
          <Link className="text-link" href="/docs/api-reference">
            See full request and response schemas in the API reference -&gt;
          </Link>
        </div>
      </section>

      <section className="container main-section">
        <h2 className="section-title">Long-running jobs do not fail. They queue.</h2>
        <p className="muted">
          Use <code>/sales/prospect</code> and <code>/sales/leads</code> for intensive jobs.
          Receive a <code>job_id</code>, poll <code>/jobs/{'{id}'}</code>, or configure webhooks.
        </p>
        <pre className="code-block">
{`# Submit the job
job = requests.post(".../sales/prospect", json={"criteria": "..."})
job_id = job.json()["job_id"]

# Poll for completion
while True:
  status = requests.get(f".../jobs/{job_id}").json()
  if status["state"] == "completed":
    results = status["result"]
    break
  time.sleep(3)`}
        </pre>
      </section>

      <section className="container main-section">
        <h2 className="section-title">Know exactly what you are spending and where.</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="kpi">Per-endpoint</div>
            <div className="muted">See which skills consume the most spend</div>
          </div>
          <div className="stat-card">
            <div className="kpi">Per-key</div>
            <div className="muted">Break down usage by workspace keys</div>
          </div>
          <div className="stat-card">
            <div className="kpi">Model logs</div>
            <div className="muted">Track model versions on every request</div>
          </div>
        </div>
      </section>

      <section className="container main-section">
        <article className="card">
          <h2 className="section-title">It is HTTP. It goes everywhere.</h2>
          <p className="muted">
            Integrate with your CRM, outbound systems, internal tools, and customer-facing SaaS
            products using one consistent API surface.
          </p>
          <div className="inline-actions">
            <Link className="cta" href="/login">
              Connect Your Key and Make Your First Call
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}

