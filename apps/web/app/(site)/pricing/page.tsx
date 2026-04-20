import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

type PricingPlan = {
  key: "starter" | "growth" | "scale";
  label: string;
  note?: string;
  priceMonthly: string;
  features: string[];
  cta: string;
};

const plans: PricingPlan[] = [
  {
    key: "starter",
    label: "Starter",
    note: "Recommended",
    priceMonthly: "$79",
    features: [
      "Single workspace",
      "All 15 endpoints",
      "BYOK key management",
      "Async job queue",
      "7-language snippets",
      "OpenAPI spec access",
      "7-day free trial (card required)",
    ],
    cta: "Connect Your Key - free to start",
  },
  {
    key: "growth",
    label: "Growth",
    priceMonthly: "$199",
    features: [
      "Everything in Starter",
      "Multi-workspace support",
      "Endpoint-level usage analytics",
      "Webhook delivery for async jobs",
      "Usage breakdown by API key",
      "7-day free trial (card required)",
    ],
    cta: "Start Growth Trial",
  },
  {
    key: "scale",
    label: "Enterprise",
    note: "Coming in v1.1",
    priceMonthly: "$599",
    features: [
      "Everything in Growth",
      "SSO / SAML",
      "Compliance exports",
      "Audit stream integration",
      "Dedicated support",
    ],
    cta: "Talk to us",
  },
];

export const metadata: Metadata = {
  title: "Simple Pricing. Your LLM Costs Stay Separate.",
  description:
    "Pay for platform access while your Anthropic spend stays direct. No token markup, no hidden vendor margin.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="container hero hero-with-visual">
        <div>
          <p className="eyebrow">Pricing</p>
          <h1>Simple Pricing. Your LLM Costs Stay Separate.</h1>
          <p>
            Pay for platform access. Everything your Anthropic key spends goes directly to
            Anthropic, not to us.
          </p>
        </div>

        <figure className="visual-panel">
          <Image
            src="/brand/pricing-value.svg"
            alt="Minimal pricing chart visual emphasizing transparent BYOK cost separation"
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <section className="container main-section">
        <div className="grid grid-3">
          {plans.map((plan) => (
            <article className="card" key={plan.key}>
              <div className="pill-row">
                <span className="pill">{plan.label}</span>
                {plan.note ? <span className="pill">{plan.note}</span> : null}
              </div>
              <h2 style={{ marginTop: "0.8rem" }}>{plan.priceMonthly}/mo</h2>
              <p className="muted">Annual billing is 20% lower across paid plans.</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <div className="inline-actions">
                <Link className="cta" href={`/billing?plan=${plan.key}&interval=monthly`}>
                  {plan.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container main-section">
        <article className="card">
          <h2 className="section-title">What am I actually paying for?</h2>
          <p className="muted">
            Your subscription covers the Sales AI platform: all 15 endpoints, async infrastructure,
            workspace management, key controls, and usage intelligence. Anthropic usage is billed
            separately by Anthropic to your own account.
          </p>
        </article>
      </section>
    </main>
  );
}
