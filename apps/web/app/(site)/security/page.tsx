import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your Key Never Leaves Your Control.",
  description:
    "Learn how Sales AI secures BYOK credentials with AES-256-GCM, tenant isolation, audit logs, and resilient async infrastructure.",
};

export default function SecurityPage() {
  return (
    <main>
      <section className="container hero hero-with-visual">
        <div>
          <p className="eyebrow">Security</p>
          <h1>Your Key Never Leaves Your Control.</h1>
          <p>
            You are trusting Sales AI with Anthropic credentials. This page shows exactly how
            credentials, tenant boundaries, and runtime operations are protected.
          </p>
        </div>

        <figure className="visual-panel">
          <Image
            src="/brand/security-encryption.svg"
            alt="Minimal security shield visual representing encrypted key handling and tenant isolation"
            width={900}
            height={620}
            priority
          />
        </figure>
      </section>

      <section className="container main-section grid">
        <article className="card">
          <h2>Your Anthropic key is encrypted before storage. Always.</h2>
          <p className="muted">
            Keys are encrypted with AES-256-GCM before they are written to the database. Plaintext
            is never logged and only exists in memory for active request execution.
          </p>
          <pre className="code-block">
{`Algorithm:   AES-256-GCM
Storage:     Encrypted at rest in Supabase Postgres
Plaintext:   Never logged, decrypted in-memory only
Visibility:  Anthropic billing remains on your account`}
          </pre>
        </article>

        <article className="card">
          <h2>Your data is invisible to other workspaces by architecture.</h2>
          <p className="muted">
            Row-level security enforces tenant boundaries at the database layer. API requests are
            scoped to the active org and workspace on every call.
          </p>
          <table className="doc-table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Protection</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Database</td>
                <td>RLS policies on all tenant tables</td>
              </tr>
              <tr>
                <td>API</td>
                <td>Org and workspace scope checks on each authenticated request</td>
              </tr>
              <tr>
                <td>Keys</td>
                <td>Scoped API keys for endpoint and role-based access</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="card">
          <h2>Production-grade operational hardening</h2>
          <ul>
            <li><strong>Request IDs:</strong> trace any call using <code>x-request-id</code></li>
            <li><strong>Audit logs:</strong> track key, workspace, and permission changes</li>
            <li><strong>Scoped API keys:</strong> least-privilege integrations by endpoint</li>
            <li><strong>Rate limits:</strong> protect budget from runaway workloads</li>
            <li><strong>Retry + DLQ:</strong> failed async jobs never disappear silently</li>
          </ul>
        </article>

        <article className="card">
          <h2>We cannot run up your Anthropic bill by design.</h2>
          <p className="muted">
            Anthropic billing is direct to your account. Sales AI does not proxy provider billing
            and does not apply token markup.
          </p>
          <div className="inline-actions">
            <Link className="text-link" href="mailto:security@sales-ai.app">
              Questions about security? Talk to us -&gt;
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}

