import type { Metadata } from "next";
import Link from "next/link";

const categories = [
  {
    label: "Prospecting & Intelligence",
    endpoints: [
      ["/sales/research",    "Deep-dive company and contact research before a call"],
      ["/sales/prospect",    "Async batch prospect discovery with job polling"],
      ["/sales/leads",       "Async lead discovery with scoring and polling"],
      ["/sales/icp",         "ICP fit scoring, gap analysis, and recommendations"],
      ["/sales/competitors", "Competitive positioning and battlecard generation"],
    ],
  },
  {
    label: "Outreach & Sequencing",
    endpoints: [
      ["/sales/outreach",  "Personalized first-touch outreach copy"],
      ["/sales/followup",  "Multi-step follow-up sequence generation"],
      ["/sales/contacts",  "Contact enrichment, profile building, and verification"],
    ],
  },
  {
    label: "Deal Execution",
    endpoints: [
      ["/sales/qualify",    "Lead scoring and qualification with explicit reasoning"],
      ["/sales/prep",       "Pre-call briefing, agenda, and suggested talk track"],
      ["/sales/objections", "Deal-specific objection handling and rebuttals"],
      ["/sales/proposal",   "Proposal generation from deal context and ICP"],
    ],
  },
  {
    label: "Reporting & Utilities",
    endpoints: [
      ["/sales/report",     "Sales performance reporting and trend analysis"],
      ["/sales/report-pdf", "PDF report export"],
      ["/sales/quick",      "Instant utility sales queries without queue overhead"],
    ],
  },
] as const;

export const metadata: Metadata = {
  title: "Product — 15 Sales Endpoints for the Full Sales Cycle",
  description:
    "REST API with 15 purpose-built sales endpoints for research, qualification, outreach, and reporting. Bring your own key and ship fast.",
};

export default function ProductPage() {
  return (
    <main>
      {/* ── HERO ─────────────────────────────────────── */}
      <section className="container" style={{ padding: "5.5rem 0 3.5rem" }}>
        <p className="hero-eyebrow" style={{ marginBottom: "1rem" }}>
          <span className="hero-eyebrow-dot" />
          Product
        </p>
        <h1 className="hero-headline">Everything a sales team needs. Callable from your code.</h1>
        <p className="hero-body">
          Sales AI is a REST API with 15 purpose-built endpoints covering research, qualification, outreach,
          proposals, objections, and competitive intelligence. Bring your own Anthropic key and wire it into
          your existing stack in minutes.
        </p>
        <div className="hero-actions">
          <Link href="/login" className="btn btn-primary">Connect Your Key</Link>
          <Link href="/docs/api-reference" className="btn btn-ghost" style={{ color: "var(--text-muted)" }}>
            View API Reference
          </Link>
        </div>
      </section>

      {/* ── ASYNC DEMO ───────────────────────────────── */}
      <section className="container" style={{ paddingBottom: "4rem" }}>
        <p className="section-eyebrow">How it works</p>
        <h2 className="section-title" style={{ marginBottom: "0.5rem" }}>One base URL. Fifteen sales skills.</h2>
        <p className="section-body" style={{ marginBottom: "1.5rem" }}>
          Every endpoint in <code>POST /api/v1/sales/*</code> is built for one specific job.
          Structured JSON in, structured JSON out.
        </p>
        <div className="terminal-window" style={{ maxWidth: "640px" }}>
          <div className="terminal-header">
            <span className="terminal-dot red" />
            <span className="terminal-dot yellow" />
            <span className="terminal-dot green" />
            <span className="terminal-tab">prospect-async.py</span>
          </div>
          <pre className="terminal-body">
            <code>{`# Submit async job
job = requests.post(
  `}<span className="t-string">".../sales/prospect"</span>{`,
  json={`}<span className="t-string">"criteria"</span>{`: `}<span className="t-string">"B2B SaaS, 50-200 employees, Series A"</span>{`}
)
job_id = job.json()[`}<span className="t-string">"job_id"</span>{`]

# Poll until complete
while `}<span className="t-keyword">True</span>{`:
  status = requests.get(
    f`}<span className="t-string">".../jobs/&#123;job_id&#125;"</span>{`
  ).json()
  `}<span className="t-keyword">if</span>{` status[`}<span className="t-string">"state"</span>{`] == `}<span className="t-string">"completed"</span>{`:
    results = status[`}<span className="t-string">"result"</span>{`]  `}<span className="t-comment"># → scored leads array</span>{`
    `}<span className="t-keyword">break</span>{`
  time.sleep(`}<span className="t-number">3</span>{`)`}</code>
          </pre>
        </div>
      </section>

      {/* ── ENDPOINTS BY CATEGORY ────────────────────── */}
      <section className="container" style={{ paddingBottom: "5rem" }}>
        <p className="section-eyebrow">API Surface</p>
        <h2 className="section-title" style={{ marginBottom: "2rem" }}>Built for the full sales cycle.</h2>
        <div className="grid-2">
          {categories.map((cat) => (
            <div key={cat.label} className="card">
              <h3 style={{ fontSize: "0.875rem", marginBottom: "0.875rem" }}>{cat.label}</h3>
              <table className="doc-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.endpoints.map(([endpoint, detail]) => (
                    <tr key={endpoint}>
                      <td><code style={{ fontSize: "0.78rem" }}>{endpoint}</code></td>
                      <td style={{ fontSize: "0.8125rem" }}>{detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/docs/api-reference" style={{ color: "var(--accent-soft)", fontSize: "0.875rem", fontWeight: 600 }}>
            See full request/response schemas in the API reference →
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: "5rem" }}>
        <div className="cta-section">
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            It is HTTP. It goes everywhere.
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: "44ch", margin: "0 auto 2rem" }}>
            Integrate with your CRM, outbound systems, internal tools, and customer-facing products using one consistent API surface.
          </p>
          <Link href="/login" className="btn btn-primary">
            Connect Your Key and Make Your First Call
          </Link>
        </div>
      </section>
    </main>
  );
}
