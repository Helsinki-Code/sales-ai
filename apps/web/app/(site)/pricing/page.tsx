import type { Metadata } from "next";
import Link from "next/link";

type Plan = {
  key: "starter" | "growth" | "scale";
  label: string;
  badge?: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const plans: Plan[] = [
  {
    key: "starter",
    label: "Starter",
    price: "$79",
    description: "For builders and solo developers moving fast.",
    features: [
      "Single workspace",
      "All 15 sales endpoints",
      "BYOK key management",
      "Async job queue",
      "7-language code snippets",
      "OpenAPI spec access",
      "7-day free trial",
    ],
    cta: "Start free trial",
  },
  {
    key: "growth",
    label: "Growth",
    badge: "Most Popular",
    price: "$199",
    description: "For teams building on top of Sales AI.",
    features: [
      "Everything in Starter",
      "Multi-workspace support",
      "Endpoint-level usage analytics",
      "Webhook delivery for async jobs",
      "Usage breakdown by API key",
      "Priority support",
      "7-day free trial",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    key: "scale",
    label: "Enterprise",
    badge: "Coming soon",
    price: "$599",
    description: "For compliance-first teams and large organizations.",
    features: [
      "Everything in Growth",
      "SSO / SAML",
      "Compliance exports",
      "Audit stream integration",
      "Dedicated account manager",
      "Custom SLA",
    ],
    cta: "Talk to us",
  },
];

const faqs = [
  {
    q: "What am I actually paying for?",
    a: "Your subscription covers the Sales AI platform: all 15 endpoints, async infrastructure, workspace management, key controls, and usage intelligence. Anthropic usage is billed separately to your own account.",
  },
  {
    q: "Who controls my Anthropic costs?",
    a: "You do. Your key is billed directly by Anthropic. We charge platform access only and do not mark up your token usage.",
  },
  {
    q: "What if I exceed usage limits?",
    a: "Starter and Growth use a unit model. You can purchase additional unit packs from the billing dashboard at any time without upgrading plans.",
  },
  {
    q: "Is this for startups or enterprise teams?",
    a: "Both. Starter is ideal for individual developers and builders. Growth supports multi-workspace teams. Enterprise adds SSO/SAML, compliance controls, and dedicated support.",
  },
];

export const metadata: Metadata = {
  title: "Simple Pricing. Your LLM Costs Stay Separate.",
  description:
    "Pay for platform access. Your Anthropic spend goes directly to Anthropic — no token markup, no hidden margin.",
};

export default function PricingPage() {
  return (
    <main>
      {/* ── HERO ─────────────────────────────────────── */}
      <section className="container" style={{ padding: "5.5rem 0 3.5rem", textAlign: "center" }}>
        <p className="hero-eyebrow" style={{ justifyContent: "center", marginBottom: "1rem" }}>
          <span className="hero-eyebrow-dot" />
          Pricing
        </p>
        <h1 className="hero-headline" style={{ maxWidth: "none", textAlign: "center" }}>
          Simple pricing. Transparent costs.
        </h1>
        <p className="hero-body" style={{ maxWidth: "48ch", margin: "1rem auto 0", textAlign: "center" }}>
          Pay for platform access. Everything your Anthropic key spends goes directly to Anthropic — not to us.
          Annual billing saves 20%.
        </p>
      </section>

      {/* ── PLANS ────────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: "4rem" }}>
        <div className="grid-3" style={{ alignItems: "start" }}>
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={`card ${plan.featured ? "pricing-card-featured" : ""}`}
              style={{ position: "relative", padding: "1.75rem" }}
            >
              {plan.badge && (
                <span
                  className={`badge ${plan.featured ? "badge-accent" : "badge-neutral"}`}
                  style={{ position: "absolute", top: "1.25rem", right: "1.25rem" }}
                >
                  {plan.badge}
                </span>
              )}
              <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                {plan.label}
              </p>
              <div style={{ marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>/ month</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                {plan.description}
              </p>
              <ul className="check-list">
                {plan.features.map((f) => (
                  <li key={f} className="check-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: "1.75rem" }}>
                <Link
                  href={`/billing?plan=${plan.key}&interval=monthly`}
                  className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"}`}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {plan.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "1.25rem" }}>
          Annual billing available. 20% discount across all paid plans.
        </p>
      </section>

      {/* ── FAQ ──────────────────────────────────────── */}
      <section className="container" style={{ paddingBottom: "5rem" }}>
        <h2 className="section-title" style={{ marginBottom: "1.5rem" }}>Common questions</h2>
        <div className="grid-2">
          {faqs.map((item) => (
            <div key={item.q} className="card">
              <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.5rem" }}>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
