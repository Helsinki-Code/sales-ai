import Link from "next/link";

const entries = [
  { href: "/docs/quickstart", title: "Quickstart", text: "Provision workspace, BYOK key, model policy, and first API call." },
  { href: "/docs/api-reference", title: "API Reference", text: "Endpoints, auth contracts, async polling lifecycle, and envelopes." },
  { href: "/docs/oauth", title: "OAuth 2.1 Setup", text: "Supabase OAuth server integration and consent route implementation." }
];

export default function DocsIndexPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Documentation</h1>
      <div className="grid grid-3">
        {entries.map((entry) => (
          <Link key={entry.href} href={entry.href} className="card">
            <h3>{entry.title}</h3>
            <p>{entry.text}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
