import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const entries = [
  {
    href: "/docs/quickstart",
    title: "Quickstart",
    text: "Provision a workspace, connect your Anthropic key, set a model policy, and run your first /sales/qualify call.",
    cta: "Start the Quickstart ->",
  },
  {
    href: "/docs/api-reference",
    title: "API Reference",
    text: "Full endpoint catalog with request schemas, response envelopes, async lifecycle, and error contracts.",
    cta: "Browse the API ->",
  },
  {
    href: "/docs/oauth",
    title: "OAuth 2.1 Setup",
    text: "Build multi-tenant integrations on top of Sales AI using Supabase OAuth with consent and token exchange flows.",
    cta: "OAuth Setup Guide ->",
  },
] as const;

export const metadata: Metadata = {
  title: "Sales AI Docs | Quickstart, API Reference, and OAuth",
  description:
    "Go from zero to first API call in under 10 minutes with Sales AI documentation and production-ready guides.",
};

export default function DocsIndexPage() {
  return (
    <main>
      <section className="container hero hero-with-visual">
        <div>
          <p className="eyebrow">Documentation</p>
          <h1>Go from zero to first API call in under 10 minutes.</h1>
          <p>
            Most teams start with Quickstart, run a live endpoint, and then move into full API
            schemas and OAuth setup.
          </p>
        </div>

        <figure className="visual-panel">
          <Image
            src="/brand/docs-quickstart.svg"
            alt="Minimal documentation flow image showing quickstart, API reference, and OAuth guides"
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <section className="container main-section">
        <div className="grid grid-3">
          {entries.map((entry) => (
            <article className="card" key={entry.href}>
              <h2>{entry.title}</h2>
              <p className="muted">{entry.text}</p>
              <Link className="text-link" href={entry.href}>
                {entry.cta}
              </Link>
            </article>
          ))}
        </div>

        <div className="quick-links" aria-label="Quick documentation links">
          <Link href="/api/v1/openapi.json">OpenAPI JSON Spec</Link>
          <Link href="/docs/api-reference">Postman Collection Guide</Link>
          <Link href="/security">Status and Security</Link>
          <Link href="/blog">Changelog and Insights</Link>
        </div>
      </section>
    </main>
  );
}
