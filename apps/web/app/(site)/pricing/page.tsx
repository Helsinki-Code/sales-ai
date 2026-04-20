import Link from "next/link";

type PlanCard = {
  key: "starter" | "growth" | "scale";
  label: string;
  monthly: string;
  annual: string;
  description: string;
};

const PLANS: PlanCard[] = [
  {
    key: "starter",
    label: "Starter",
    monthly: "$79",
    annual: "$758.40",
    description: "Single-team setup with core sales tools and API access.",
  },
  {
    key: "growth",
    label: "Growth",
    monthly: "$199",
    annual: "$1,910.40",
    description: "Advanced workflows for growing teams and larger outbound programs.",
  },
  {
    key: "scale",
    label: "Scale",
    monthly: "$599",
    annual: "$5,750.40",
    description: "High-volume execution with enterprise-ready throughput.",
  },
];

export default function PricingPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Pricing</h1>
      <p style={{ color: "var(--slate)", marginTop: "-0.25rem", marginBottom: "1.25rem", maxWidth: "680px" }}>
        All plans include a 7-day free trial that starts at checkout (card required).
        Billing is organization-level and can be managed anytime from the Billing page.
      </p>
      <div className="grid grid-3">
        {PLANS.map((plan) => (
          <article className="card" key={plan.key}>
            <h3>{plan.label}</h3>
            <p style={{ color: "var(--slate)" }}>{plan.description}</p>
            <p style={{ marginBottom: "0.5rem" }}>
              <strong>{plan.monthly}</strong>/month
            </p>
            <p style={{ color: "var(--slate)", marginTop: 0, marginBottom: "1rem" }}>
              {plan.annual}/year (20% annual discount)
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link href={`/billing?plan=${plan.key}&interval=monthly`} className="cta">
                Start Trial
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
