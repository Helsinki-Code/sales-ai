import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

async function getApiKeys() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return null;

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001";
    const res = await fetch(`${baseUrl}/api/admin/api-keys`, {
      headers: {
        Cookie: `sb-auth-token=${session.access_token}`
      }
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data || [];
  } catch (error) {
    console.error("Failed to fetch API keys:", error);
    return null;
  }
}

export default async function DashboardPage() {
  const apiKeys = await getApiKeys();
  const activeKeysCount = apiKeys ? apiKeys.filter((key: any) => key.status === "active").length : 0;
  const hasApiKeys = activeKeysCount > 0;

  return (
    <main>
      <h1 className="page-title">Dashboard</h1>

      {/* Quick Start Checklist */}
      <div className="card" style={{ marginBottom: "3rem" }}>
        <h2>Getting Started</h2>
        <p style={{ color: "var(--slate)", marginBottom: "1.5rem" }}>Follow these steps to start using the API.</p>

        <div>
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--mint)",
                color: "var(--ink)",
                fontWeight: "600",
                marginRight: "1rem",
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>Configure Your Anthropic API Key</div>
              <p style={{ color: "var(--slate)", margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                Bring your own key (BYOK). No shared API, you control the costs.
              </p>
              <Link href="/settings" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
                Go to Settings →
              </Link>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: hasApiKeys ? "var(--mint)" : "var(--panel)",
                color: hasApiKeys ? "var(--ink)" : "var(--slate)",
                fontWeight: "600",
                marginRight: "1rem",
                flexShrink: 0,
              }}
            >
              {hasApiKeys ? "✓" : "2"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>Create an API Key</div>
              <p style={{ color: "var(--slate)", margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                Generate workspace API keys for your apps ({activeKeysCount} active).
              </p>
              <Link href="/keys" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
                Manage API Keys →
              </Link>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--panel)",
                color: "var(--slate)",
                fontWeight: "600",
                marginRight: "1rem",
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>Copy Code & Start Using</div>
              <p style={{ color: "var(--slate)", margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                Browse 15 endpoints. Copy production-ready snippets in cURL, Python, TypeScript, Go, PHP, Ruby, JavaScript.
              </p>
              <Link href="/reference" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
                View API Reference →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "3rem" }}>
        <div className="card">
          <div style={{ color: "var(--slate)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Active API Keys</div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--accent)" }}>{activeKeysCount}</div>
        </div>

        <div className="card">
          <div style={{ color: "var(--slate)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Endpoints Available</div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--accent)" }}>15</div>
        </div>

        <div className="card">
          <div style={{ color: "var(--slate)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Languages Supported</div>
          <div style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--accent)" }}>7</div>
        </div>
      </div>

      {/* Recent Keys */}
      {apiKeys && apiKeys.length > 0 && (
        <div className="card">
          <h2>Recent API Keys</h2>
          <div style={{ fontSize: "0.9rem" }}>
            {apiKeys.slice(0, 3).map((key: any) => (
              <div key={key.id} style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: "500", marginBottom: "0.25rem" }}>{key.name}</div>
                <div style={{ color: "var(--slate)", fontSize: "0.85rem" }}>
                  {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : "Never used"}
                </div>
              </div>
            ))}
          </div>
          <Link href="/keys" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
            View all keys →
          </Link>
        </div>
      )}
    </main>
  );
}