import Link from "next/link";

const grades = [
  { grade: "A", color: "var(--success)",       pct: 0 },
  { grade: "B", color: "var(--accent-soft)",   pct: 0 },
  { grade: "C", color: "var(--warning)",        pct: 0 },
  { grade: "D", color: "var(--danger)",         pct: 0 },
];

export function LeadQualitySummary() {
  return (
    <div className="ui-card">
      <div className="ui-card-header">
        <span className="ui-card-title">Lead quality</span>
        <span className="badge badge-neutral">No data yet</span>
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
        Lead scoring uses ICP fit, persona match, signals, and evidence quality.
        Run your first search to see distribution.
      </p>

      {/* Grade distribution bars */}
      <div style={{ display: "grid", gap: "0.6rem", marginBottom: "1.25rem" }}>
        {grades.map(({ grade, color }) => (
          <div key={grade} style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <span style={{ width: "18px", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)" }}>
              {grade}
            </span>
            <div
              style={{
                flex: 1,
                height: "4px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "99px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "0%",
                  background: color,
                  borderRadius: "99px",
                  transition: "width 0.6s var(--ease-out)",
                }}
              />
            </div>
            <span style={{ width: "28px", fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "right" }}>
              0
            </span>
          </div>
        ))}
      </div>

      <Link href="/lead-finder" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
        Find your next leads
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}
