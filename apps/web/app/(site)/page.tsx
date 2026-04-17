import Link from "next/link";

const blocks = [
  { title: "Strict BYOK", body: "Every workspace runs on its own Anthropic key. No hidden shared key fallback." },
  { title: "Async Sales Engine", body: "Long-running prospect and lead workflows execute safely in Redis-backed workers." },
  { title: "Tenant Isolation", body: "Supabase RLS policies enforce org/workspace boundaries for every sensitive table." }
];

export default function HomePage() {
  return (
    <main>
      <section className="container hero">
        <h1>Close More Deals With a Real Sales Agent Runtime.</h1>
        <p>
          Sales AI turns your existing sales skills into secure REST endpoints, queue-backed jobs, and a clean dashboard your team can actually run in production.
        </p>
        <div className="nav-links">
          <Link className="cta" href="/docs/quickstart">Start Quickstart</Link>
          <Link className="cta" href="/dashboard">View Dashboard</Link>
        </div>
      </section>

      <section className="container main-section grid grid-3">
        {blocks.map((block) => (
          <article className="card" key={block.title}>
            <h3>{block.title}</h3>
            <p>{block.body}</p>
          </article>
        ))}
      </section>

      <section className="container main-section grid grid-3">
        <article className="card"><div className="kpi">15</div><p>Sales endpoints shipped</p></article>
        <article className="card"><div className="kpi">202</div><p>Async API pattern with polling</p></article>
        <article className="card"><div className="kpi">RLS</div><p>Org-isolated data access model</p></article>
      </section>
    </main>
  );
}