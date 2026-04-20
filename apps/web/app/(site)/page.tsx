import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const featureCards = [
  {
    title: "Your LLM costs stay yours",
    body: "Use your own Anthropic API key. Every token you spend hits your account directly. No shared keys, no hidden per-call fees, and no vendor lock-in.",
  },
  {
    title: "Production code in your language",
    body: "Copy verified snippets in cURL, Python, TypeScript, JavaScript, Go, PHP, or Ruby. Real working calls to live endpoints, ready to paste.",
  },
  {
    title: "Long jobs do not fail",
    body: "Prospect and lead discovery run in an async queue. Poll for results or use webhooks. No serverless timeout failures in your pipeline.",
  },
];

const endpointCards = [
  ["/sales/research", "Deep prospect research before a call"],
  ["/sales/qualify", "Lead scoring and qualification"],
  ["/sales/outreach", "Personalized outreach copy"],
  ["/sales/followup", "Multi-step follow-up sequences"],
  ["/sales/prep", "Pre-call meeting prep and briefing"],
  ["/sales/proposal", "Proposal generation from context"],
  ["/sales/objections", "Deal-specific objection handling"],
  ["/sales/icp", "ICP fit scoring and gap analysis"],
  ["/sales/competitors", "Competitive intelligence on demand"],
  ["/sales/contacts", "Contact enrichment and profiling"],
  ["/sales/prospect", "Async prospect discovery"],
  ["/sales/leads", "Async lead discovery"],
  ["/sales/report", "Sales performance reporting"],
  ["/sales/report-pdf", "PDF export"],
  ["/sales/quick", "Fast sales queries without queue"],
] as const;

const objections = [
  {
    q: "Why not call Anthropic directly?",
    a: "You can, but you still have to build 15 sales-specific prompt layers, output schemas, async jobs, retries, and failure handling. Sales AI ships that foundation from day one.",
  },
  {
    q: "Who controls Anthropic costs?",
    a: "You do. Your key is billed directly by Anthropic. We charge platform access only and do not mark up your token usage.",
  },
  {
    q: "What if my language is not listed?",
    a: "If your stack can make HTTP requests, it can call Sales AI. We provide snippets for cURL, Python, TypeScript, JavaScript, Go, PHP, and Ruby.",
  },
  {
    q: "Is this for startups or enterprise teams?",
    a: "Both. Starter is ideal for builders. Growth supports multi-workspace teams. Enterprise adds SSO/SAML and compliance controls.",
  },
];

export const metadata: Metadata = {
  title: "We Built a Sales AI API With 15 Endpoints - Here Is What Every One Does",
  description:
    "REST endpoints for qualifying leads, writing outreach, researching prospects, and more. BYOK with no vendor markup. Build in minutes.",
};

export default function HomePage() {
  return (
    <main>
      <section className="container hero hero-with-visual">
        <div>
          <p className="eyebrow">Sales AI Platform</p>
          <h1>15 Sales AI Endpoints. Your Key. Your Costs.</h1>
          <p>
            15 production-ready sales endpoints. Call from cURL, Python, TypeScript,
            JavaScript, Go, PHP, or Ruby. Full BYOK. Your Anthropic key hits your account,
            not ours.
          </p>
          <div className="inline-actions">
            <Link className="cta" href="/login">
              Connect Your Key
            </Link>
            <Link className="text-link" href="/docs">
              Browse the Docs -&gt;
            </Link>
          </div>
          <p className="muted small" style={{ marginTop: "0.9rem" }}>
            Built on Render, Vercel, and Supabase
          </p>
        </div>

        <figure className="visual-panel">
          <Image
            src="/brand/hero-platform.svg"
            alt="Minimal architectural illustration showing Sales AI endpoint workflow and structured output pipeline"
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <section className="container main-section">
        <pre className="code-block">
{`# Qualify a lead in one API call
import requests

r = requests.post(
  "https://api.sales-ai.app/api/v1/sales/qualify",
  headers={"Authorization": "Bearer YOUR_APP_KEY"},
  json={"lead": "Acme Corp, 500 employees, Series B, uses Salesforce"}
)
print(r.json())
# -> { score: 87, tier: "A", reasoning: "...", next_action: "..." }`}
        </pre>
        <p className="muted small">Every endpoint returns structured JSON for CRM, automation, and workflow use.</p>
      </section>

      <section className="container main-section">
        <div className="grid grid-3">
          {featureCards.map((card) => (
            <article key={card.title} className="card">
              <h3>{card.title}</h3>
              <p className="muted">{card.body}</p>
            </article>
          ))}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="kpi">15</div>
            <div className="muted">Production endpoints</div>
          </div>
          <div className="stat-card">
            <div className="kpi">7</div>
            <div className="muted">Languages supported</div>
          </div>
          <div className="stat-card">
            <div className="kpi">Async</div>
            <div className="muted">Background job queue with polling</div>
          </div>
          <div className="stat-card">
            <div className="kpi">AES-256-GCM</div>
            <div className="muted">Key encryption at rest</div>
          </div>
        </div>
      </section>

      <section className="container main-section">
        <h2 className="section-title">15 Sales Skills. All Callable in Minutes.</h2>
        <p className="muted">
          Every endpoint is purpose-built for one job. Structured inputs, structured outputs,
          and fast implementation in your existing stack.
        </p>

        <table className="doc-table" aria-label="Sales endpoint catalog">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {endpointCards.map(([endpoint, summary]) => (
              <tr key={endpoint}>
                <td>
                  <code>{endpoint}</code>
                </td>
                <td>{summary}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inline-actions">
          <Link className="text-link" href="/docs/api-reference">
            See full request and response schemas -&gt;
          </Link>
        </div>
      </section>

      <section className="container main-section">
        <h2 className="section-title">Security built for the way you work</h2>
        <div className="grid grid-3">
          <article className="card">
            <h3>Encrypted at rest</h3>
            <p className="muted">Your Anthropic key is encrypted before storage with AES-256-GCM.</p>
          </article>
          <article className="card">
            <h3>Tenant isolation</h3>
            <p className="muted">Workspace data is isolated by row-level security policies.</p>
          </article>
          <article className="card">
            <h3>Operational hardening</h3>
            <p className="muted">Scoped API keys, request IDs, retries, DLQ support, and rate limits.</p>
          </article>
        </div>
        <div className="inline-actions">
          <Link className="text-link" href="/security">
            Full security details -&gt;
          </Link>
        </div>
      </section>

      <section className="container main-section">
        <h2 className="section-title">Questions developers actually ask</h2>
        <div className="grid">
          {objections.map((item) => (
            <article key={item.q} className="card">
              <h3>{item.q}</h3>
              <p className="muted">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container main-section">
        <article className="card">
          <h2 className="section-title">Start in the time it takes to read the docs</h2>
          <p className="muted">
            Sign up, connect your Anthropic key, and make your first <code>/sales/qualify</code>
            call. No long onboarding, no setup calls, no vendor markup.
          </p>
          <div className="inline-actions">
            <Link className="cta" href="/login">
              Connect Your Key
            </Link>
            <Link className="text-link" href="/docs/quickstart">
              Read the quickstart -&gt;
            </Link>
          </div>
          <p className="muted small" style={{ marginTop: "0.9rem" }}>
            Your Anthropic key stays encrypted. You control what you spend.
          </p>
        </article>
      </section>
    </main>
  );
}

