import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type ApiKeyRow = {
  id: string;
  name: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
};

type DashboardData = {
  keys: ApiKeyRow[];
  activeKeysCount: number;
  totalRequests30d: number;
  totalCost30d: number;
};

type UsageRow = {
  request_count: number | null;
  cost_usd: number | string | null;
};

async function getDashboardData(): Promise<DashboardData> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { keys: [], activeKeysCount: 0, totalRequests30d: 0, totalCost30d: 0 };
    }

    const { workspaceId } = await getWorkspaceContext(user.id);

    const { data: keysData } = await supabase
      .from("api_keys")
      .select("id,name,status,last_used_at,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(10);

    const keys = Array.isArray(keysData) ? (keysData as ApiKeyRow[]) : [];
    const activeKeysCount = keys.filter((key) => key.status === "active").length;

    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromDate = from.toISOString().slice(0, 10);

    const { data: usageRows } = await supabase
      .from("usage_daily_rollups")
      .select("request_count,cost_usd")
      .eq("workspace_id", workspaceId)
      .gte("usage_date", fromDate);

    const typedUsageRows = (usageRows || []) as UsageRow[];
    const totalRequests30d = typedUsageRows.reduce((sum: number, row: UsageRow) => sum + (row.request_count || 0), 0);
    const totalCost30d = typedUsageRows.reduce((sum: number, row: UsageRow) => sum + Number(row.cost_usd || 0), 0);

    return { keys, activeKeysCount, totalRequests30d, totalCost30d };
  } catch (error) {
    console.error("Dashboard data fetch failed:", error);
    return { keys: [], activeKeysCount: 0, totalRequests30d: 0, totalCost30d: 0 };
  }
}

export default async function DashboardPage() {
  const { keys, activeKeysCount, totalRequests30d, totalCost30d } = await getDashboardData();

  return (
    <main>
      <h1 className="page-title">Dashboard</h1>
      <p style={{ color: "var(--slate)", marginTop: "-0.4rem", marginBottom: "1.5rem" }}>
        Live workspace status and setup progress.
      </p>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginTop: 0 }}>Getting Started</h2>
        <p style={{ color: "var(--slate)", marginBottom: "1.2rem" }}>Finish these steps to use the API end-to-end.</p>

        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <div style={{ fontWeight: 600 }}>1) Configure Provider Credentials</div>
            <p style={{ color: "var(--slate)", margin: "0.35rem 0" }}>Add your Anthropic key (BYOK) in settings.</p>
            <Link href="/settings" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
              Open Settings
            </Link>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>2) Create API Key</div>
            <p style={{ color: "var(--slate)", margin: "0.35rem 0" }}>
              Active keys in this workspace: <strong>{activeKeysCount}</strong>
            </p>
            <Link href="/keys" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
              Manage API Keys
            </Link>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>3) Test in Playground</div>
            <p style={{ color: "var(--slate)", margin: "0.35rem 0" }}>Run quick scans and qualification jobs from UI.</p>
            <Link href="/playground" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
              Open Playground
            </Link>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        <div className="card">
          <div style={{ color: "var(--slate)", fontSize: "0.9rem", marginBottom: "0.4rem" }}>Active API Keys</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>{activeKeysCount}</div>
        </div>

        <div className="card">
          <div style={{ color: "var(--slate)", fontSize: "0.9rem", marginBottom: "0.4rem" }}>Requests (Last 30 Days)</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>{totalRequests30d.toLocaleString()}</div>
        </div>

        <div className="card">
          <div style={{ color: "var(--slate)", fontSize: "0.9rem", marginBottom: "0.4rem" }}>Cost (Last 30 Days)</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>${totalCost30d.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Recent API Keys</h2>

        {keys.length === 0 ? (
          <p style={{ color: "var(--slate)", margin: 0 }}>No API keys found yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            {keys.slice(0, 5).map((key) => (
              <div
                key={key.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: "1rem",
                  paddingBottom: "0.7rem",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{key.name}</div>
                  <div style={{ color: "var(--slate)", fontSize: "0.85rem" }}>
                    {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : "Never used"}
                  </div>
                </div>
                <span
                  style={{
                    alignSelf: "center",
                    padding: "0.2rem 0.55rem",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    border: "1px solid var(--border)",
                    background: key.status === "active" ? "#e9f7f0" : "#f8f3ef",
                  }}
                >
                  {key.status}
                </span>
                <span style={{ alignSelf: "center", color: "var(--slate)", fontSize: "0.8rem" }}>
                  {new Date(key.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
