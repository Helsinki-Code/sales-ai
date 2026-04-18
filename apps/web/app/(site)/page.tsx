import Link from "next/link";

const features = [
  { title: "Bring Your Own Key", body: "Use your own Anthropic API key. You control the costs, we provide the endpoints. No shared keys, no hidden fees." },
  { title: "7-Language Snippets", body: "Copy production-ready code in cURL, Python, TypeScript, JavaScript, Go, PHP, and Ruby. All snippets verified to work." },
  { title: "Async Job Engine", body: "Long-running analysis runs in the background. Poll for results or configure webhooks. No timeouts." }
];

export default function HomePage() {
  return (
    <main>
      <section className="container hero">
        <h1>AI Sales API. Bring Your Own Key.</h1>
        <p>
          15 production-ready sales AI endpoints. Call from cURL, Python, TypeScript, or Go. Full BYOK — your Anthropic key, your costs.
        </p>
        <div className="nav-links">
          <Link className="cta" href="/login">Get Started</Link>
          <Link className="cta" href="/login">View API Docs</Link>
        </div>
      </section>

      <section className="container main-section grid grid-3">
        {features.map((feature) => (
          <article className="card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="container main-section grid grid-3">
        <article className="card"><div className="kpi">15</div><p>Production endpoints</p></article>
        <article className="card"><div className="kpi">7</div><p>Languages supported</p></article>
        <article className="card"><div className="kpi">Async</div><p>Job queue with polling</p></article>
      </section>
    </main>
  );
}