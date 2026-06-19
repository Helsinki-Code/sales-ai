import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "Your Anthropic key. Your bill.",
    body: "Every token hits your Anthropic account. No shared keys, no per-call margin, no vendor lock-in. Transparent cost separation from day one.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    title: "Production code in 7 languages.",
    body: "Copy verified snippets in cURL, Python, TypeScript, JavaScript, Go, PHP, or Ruby. Real working calls to live endpoints, ready to paste into your stack.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    title: "Long jobs do not timeout.",
    body: "Prospect and lead discovery run in an async queue. Receive a job_id, poll for results, or configure webhooks. No serverless timeouts in your pipeline.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

const endpointRows = [
  ["/sales/research",   "Deep prospect research before a call"],
  ["/sales/qualify",    "Lead scoring and qualification"],
  ["/sales/outreach",   "Personalized outreach copy"],
  ["/sales/followup",   "Multi-step follow-up sequences"],
  ["/sales/prep",       "Pre-call briefing and talk track"],
  ["/sales/proposal",   "Proposal generation from context"],
  ["/sales/objections", "Deal-specific objection handling"],
  ["/sales/icp",        "ICP fit scoring and gap analysis"],
  ["/sales/competitors","Competitive intelligence on demand"],
  ["/sales/contacts",   "Contact enrichment and profiling"],
  ["/sales/prospect",   "Async prospect discovery"],
  ["/sales/leads",      "Async lead discovery"],
  ["/sales/report",     "Sales performance reporting"],
  ["/sales/report-pdf", "PDF export"],
  ["/sales/quick",      "Fast sales queries without queue"],
] as const;

const stats = [
  { value: "15",         label: "Sales endpoints" },
  { value: "7",          label: "Languages" },
  { value: "Async",      label: "Job queue with polling" },
  { value: "AES-256",    label: "Key encryption at rest" },
];

export const metadata: Metadata = {
  title: "Sales AI — 15 Endpoints. Your Key. Your Costs.",
  description:
    "Production-ready sales API with 15 endpoints for qualifying leads, writing outreach, researching prospects. BYOK — your Anthropic key, no vendor markup.",
};

export default function HomePage() {
  return (
    <main>
      {/* ── HERO ─────────────────────────────────────── */}
      <section className="container" style={{ padding: "6rem 0 3.5rem" }}>
        <div className="hero-grid">
          <div className="animate-in">
            <p className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              Sales AI Platform
            </p>
            <h1 className="hero-headline">15 Sales AI Endpoints. Your Key. Your Costs.</h1>
            <p className="hero-body">
              15 production-ready sales endpoints callable from cURL, Python, TypeScript, JavaScript,
              Go, PHP, or Ruby. Full BYOK — your Anthropic key hits your account, not ours.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn btn-primary">
                Connect Your Key
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <Link href="/docs" className="btn btn-ghost" style={{ color: "var(--text-muted)" }}>
                Browse the docs
              </Link>
            </div>
            <p style={{ marginTop: "1.25rem", fontSize: "0.78rem", color: "var(--text-faint)" }}>
              Built on Vercel · Supabase · Anthropic · Stripe
            </p>
          </div>

          {/* Terminal demo */}
          <div className="animate-in animate-in-delay-2">
            <div className="terminal-window">
              <div className="terminal-header">
                <span className="terminal-dot red" />
                <span className="terminal-dot yellow" />
                <span className="terminal-dot green" />
                <span className="terminal-tab">qualify.py</span>
              </div>
              <pre className="terminal-body">
                <code>{`import requests

r = requests.post(
  `}<span className="t-string">"https://api.sales-ai.app/api/v1/sales/qualify"</span>{`,
  headers={`}<span className="t-string">"Authorization"</span>{`: `}<span className="t-string">"Bearer YOUR_KEY"</span>{`},
  json={`}<span className="t-string">"lead"</span>{`: `}<span className="t-string">"Acme Corp, 500 employees, Series B"</span>{`}
)
`}<span className="t-comment"># Structured JSON response</span>{`
print(r.json())
`}{`→ `}<span className="t-success">{"{"}</span>{` `}<span className="t-prop">"score"</span>{`: `}<span className="t-number">87</span>{`, `}<span className="t-prop">"tier"</span>{`: `}<span className="t-string">"A"</span>{`,
  `}<span className="t-prop">"reasoning"</span>{`: `}<span className="t-string">"Series B signals..."</span>{`,
  `}<span className="t-prop">"next_action"</span>{`: `}<span className="t-string">"Book intro call"</span>{` `}<span className="t-success">{"}"}</span></code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: "4rem" }}>
        <div className="grid-3">
          {features.map((f, i) => (
            <article
              key={f.title}
              className={`feature-card animate-in animate-in-delay-${i + 1}`}
            >
              <div className="feature-card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: "4rem" }}>
        <div className="grid-4">
          {stats.map((s) => (
            <div key={s.label} className="stat-card">
              <div className="kpi">{s.value}</div>
              <div className="kpi-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ENDPOINTS TABLE ───────────────────────────── */}
      <section className="container" style={{ paddingBottom: "4rem" }}>
        <div className="section-header-row">
          <p className="section-eyebrow">API Surface</p>
          <h2 className="section-title">15 sales skills. All callable in minutes.</h2>
          <p className="section-body" style={{ marginTop: "0.5rem" }}>
            Every endpoint is purpose-built for one job — structured inputs, structured JSON output,
            fast implementation in your existing stack.
          </p>
        </div>
        <table className="doc-table" aria-label="Sales endpoint catalog">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {endpointRows.map(([endpoint, summary]) => (
              <tr key={endpoint}>
                <td><code>{endpoint}</code></td>
                <td>{summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inline-actions">
          <Link href="/docs/api-reference" className="text-link">
            See full request and response schemas →
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: "5rem" }}>
        <div className="cta-section">
          <p className="section-eyebrow" style={{ marginBottom: "0.75rem" }}>Get started</p>
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.25rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            Start in the time it takes to read the docs.
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "1rem", maxWidth: "44ch", margin: "0 auto 2rem" }}>
            Sign up, connect your Anthropic key, and make your first <code>/sales/qualify</code> call.
            No long onboarding, no setup calls.
          </p>
          <div style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login" className="btn btn-primary">
              Connect Your Key
            </Link>
            <Link href="/docs/quickstart" className="btn btn-secondary">
              Read the quickstart
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
