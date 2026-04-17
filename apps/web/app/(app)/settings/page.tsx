export default function SettingsPage() {
  return (
    <main>
      <h1 className="page-title">Settings</h1>
      <div className="grid grid-3">
        <article className="card"><h3>Anthropic Key (BYOK)</h3><p>Store encrypted provider credentials per workspace.</p></article>
        <article className="card"><h3>Model Policies</h3><p>Set allowed/default Anthropic models by endpoint.</p></article>
        <article className="card"><h3>Team & Roles</h3><p>Manage owners, admins, and members.</p></article>
      </div>
    </main>
  );
}