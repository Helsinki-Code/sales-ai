export default function OAuthDocsPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Supabase OAuth 2.1</h1>
      <article className="card">
        <p>Enable OAuth Server in Supabase Auth and set authorization path to <code>/oauth/consent</code>.</p>
        <p>Our implementation reads <code>authorization_id</code>, checks session, loads client details, and approves/denies authorization requests.</p>
        <p>For setup commands and production guidance, see <code>docs/SUPABASE_OAUTH_SETUP.md</code>.</p>
      </article>
    </main>
  );
}