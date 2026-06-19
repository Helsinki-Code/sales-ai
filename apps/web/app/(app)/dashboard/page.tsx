import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { RecentJobs } from "@/components/dashboard/recent-jobs";
import { LeadQualitySummary } from "@/components/dashboard/lead-quality-summary";

export const dynamic = "force-dynamic";

async function getData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { activeKeysCount: 0, requests: 0, cost: 0 };
    const { workspaceId } = await getWorkspaceContext(user.id);
    const { data: keys } = await supabase
      .from("api_keys")
      .select("id,status")
      .eq("workspace_id", workspaceId);
    const activeKeysCount = (keys ?? []).filter((k: any) => k.status === "active").length;
    const { data: usage } = await supabase
      .from("usage_daily_rollups")
      .select("request_count,cost_usd")
      .eq("workspace_id", workspaceId)
      .limit(31);
    return {
      activeKeysCount,
      requests: (usage ?? []).reduce((s: number, r: any) => s + Number(r.request_count ?? 0), 0),
      cost: (usage ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0),
    };
  } catch {
    return { activeKeysCount: 0, requests: 0, cost: 0 };
  }
}

export default async function DashboardPage() {
  const data = await getData();

  return (
    <div className="app-grid" style={{ paddingTop: "1.75rem" }}>
      {/* Page header */}
      <div>
        <p className="eyebrow" style={{ marginBottom: "0.3rem" }}>Overview</p>
        <h1 className="page-title">Control center</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", marginTop: "0.35rem" }}>
          Setup status, usage metrics, recent jobs, and lead quality in one place.
        </p>
      </div>

      {/* Metrics row */}
      <div className="metrics-grid">
        <MetricCard
          label="Units remaining"
          value="Ready"
          hint="Check Billing for exact balance"
        />
        <MetricCard
          label="Leads found this month"
          value="—"
          hint="Populates from Lead Finder runs"
        />
        <MetricCard
          label="Average lead score"
          value="—"
          hint="Scores persist from saved leads"
        />
        <MetricCard
          label="Requests (30 days)"
          value={data.requests.toLocaleString()}
          hint={`~$${data.cost.toFixed(2)} estimated cost`}
          accent={data.requests > 0 ? "success" : undefined}
        />
      </div>

      {/* Two-column: checklist + lead quality */}
      <div className="lead-finder-grid">
        <OnboardingChecklist activeKeysCount={data.activeKeysCount} />
        <LeadQualitySummary />
      </div>

      {/* Recent jobs */}
      <RecentJobs />
    </div>
  );
}
