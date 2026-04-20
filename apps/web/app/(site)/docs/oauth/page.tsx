import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OAuth 2.1 Setup",
  description:
    "Connect Supabase OAuth with PKCE for multi-tenant Sales AI integrations, including consent, code exchange, and token refresh.",
};

export default function OAuthDocsPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">OAuth 2.1 Setup</h1>
      <p className="muted">
        Building a multi-tenant product on top of Sales AI? This guide covers Supabase OAuth
        integration, consent routing, and token lifecycle management.
      </p>

      <section className="card">
        <h2>Who this is for</h2>
        <p>
          Teams building SaaS products or internal tools that authenticate multiple users against
          Sales AI, where each user has their own workspace and BYOK setup.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Overview</h2>
        <ol>
          <li>Your app redirects users to Sales AI consent flow.</li>
          <li>User authenticates and approves scopes.</li>
          <li>Sales AI redirects with authorization code.</li>
          <li>Your server exchanges code for access token.</li>
          <li>Your app calls Sales AI endpoints on behalf of that user.</li>
        </ol>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 1: Register your OAuth client</h2>
        <p>In Settings -&gt; Developer -&gt; OAuth Apps, define app name, redirect URI, and scopes.</p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 2: Implement authorization redirect (PKCE)</h2>
        <pre className="code-block">
{`const codeVerifier = generateRandomString(64);
const codeChallenge = await sha256(codeVerifier);

const authUrl = new URL("https://api.sales-ai.app/oauth/authorize");
authUrl.searchParams.set("client_id", YOUR_CLIENT_ID);
authUrl.searchParams.set("redirect_uri", YOUR_REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "read write");
authUrl.searchParams.set("code_challenge", codeChallenge);
authUrl.searchParams.set("code_challenge_method", "S256");
authUrl.searchParams.set("state", generateRandomString(16));

redirect(authUrl.toString());`}
        </pre>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 3: Handle callback and token exchange</h2>
        <pre className="code-block">
{`const response = await fetch("https://api.sales-ai.app/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: YOUR_CLIENT_ID,
    client_secret: YOUR_CLIENT_SECRET,
    redirect_uri: YOUR_REDIRECT_URI,
    code: authorizationCode,
    code_verifier: storedCodeVerifier,
  }),
});

const { access_token, refresh_token, expires_in } = await response.json();`}
        </pre>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 4: Make authenticated requests</h2>
        <pre className="code-block">
{`const result = await fetch("https://api.sales-ai.app/api/v1/sales/qualify", {
  method: "POST",
  headers: {
    "Authorization": ` + "`Bearer ${accessToken}`" + `,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ lead: "..." }),
});`}
        </pre>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Step 5: Refresh tokens</h2>
        <pre className="code-block">
{`const response = await fetch("https://api.sales-ai.app/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: YOUR_CLIENT_ID,
    client_secret: YOUR_CLIENT_SECRET,
    refresh_token: storedRefreshToken,
  }),
});`}
        </pre>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Token scopes</h2>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Scope</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>read</code></td>
              <td>GET requests, job polling, usage views</td>
            </tr>
            <tr>
              <td><code>write</code></td>
              <td>POST endpoint calls and job creation</td>
            </tr>
            <tr>
              <td><code>admin</code></td>
              <td>Workspace management and key administration</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Supabase integration note</h2>
        <p>
          If your own app also runs on Supabase, you can integrate directly with Sales AI Supabase
          OAuth server. Request the Supabase-to-Supabase integration guide for production setup.
        </p>
      </section>
    </main>
  );
}

