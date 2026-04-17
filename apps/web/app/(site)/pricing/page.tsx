export default function PricingPage() {
  return (
    <main className="container main-section">
      <h1 className="page-title">Pricing & BYOK Policy</h1>
      <div className="grid grid-3">
        <article className="card"><h3>Starter</h3><p>Single workspace, strict BYOK, API key management, and async jobs.</p></article>
        <article className="card"><h3>Growth</h3><p>Multi-workspace support, advanced usage analytics, and webhook delivery.</p></article>
        <article className="card"><h3>Enterprise</h3><p>v1.1: SSO/SAML, compliance exports, and audit stream integration.</p></article>
      </div>
    </main>
  );
}