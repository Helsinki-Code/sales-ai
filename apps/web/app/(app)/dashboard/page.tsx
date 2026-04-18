import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

const SALES_TOOLS = [
  { name: "Qualify Lead", endpoint: "qualify", href: "/sales/qualify" },
  { name: "Prospect Analysis", endpoint: "prospect", href: "/sales/prospect" },
  { name: "Find Contacts", endpoint: "contacts", href: "/sales/contacts" },
  { name: "Generate Outreach", endpoint: "outreach", href: "/sales/outreach" }
];

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
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch API keys:", error);
    return null;
  }
}

async function getRecentJobs() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return null;

    const workspaceId = await getWorkspaceId(session.user.id);

    const { data, error } = await supabase
      .from("jobs")
      .select("id, endpoint, status, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Failed to fetch recent jobs:", error);
      return null;
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch recent jobs:", error);
    return null;
  }
}

export default async function DashboardPage() {
  const apiKeys = await getApiKeys();
  const recentJobs = await getRecentJobs();

  const activeKeysCount = apiKeys ? apiKeys.filter((key: any) => key.status === "active").length : 0;

  return (
    <main>
      <h1 className="page-title">Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
        <div className="card">
          <h3>API Keys</h3>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "1rem 0" }}>{activeKeysCount}</p>
          <p style={{ color: "var(--slate)", marginBottom: "1.5rem" }}>active keys</p>
          {apiKeys && apiKeys.length > 0 && (
            <div style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
              {apiKeys.slice(0, 3).map((key: any) => (
                <div key={key.id} style={{ marginBottom: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: "500" }}>{key.name}</div>
                  <div style={{ color: "var(--slate)", fontSize: "0.85rem" }}>
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never used"}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/settings" className="cta" style={{ display: "inline-block" }}>
            Manage Keys
          </Link>
        </div>

        <div className="card">
          <h3>Recent Jobs</h3>
          {recentJobs && recentJobs.length > 0 ? (
            <div style={{ fontSize: "0.9rem" }}>
              {recentJobs.map((job: any) => (
                <div key={job.id} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: "500" }}>{job.endpoint}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                    <span style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      backgroundColor: job.status === "complete" ? "var(--mint)" : job.status === "failed" ? "var(--slate)" : "var(--panel)"
                    }}>
                      {job.status}
                    </span>
                    <span style={{ color: "var(--slate)", fontSize: "0.85rem" }}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--slate)" }}>No jobs yet. Try a sales tool below.</p>
          )}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>Quick Actions</h2>
        <div className="grid">
          {SALES_TOOLS.map(tool => (
            <Link key={tool.endpoint} href={tool.href} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>{tool.name}</h3>
              <p style={{ color: "var(--slate)", margin: 0 }}>Run this tool →</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}