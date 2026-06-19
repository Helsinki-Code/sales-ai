import Link from "next/link";

export function RecentJobs() {
  return (
    <div className="ui-card">
      <div className="ui-card-header">
        <span className="ui-card-title">Recent jobs</span>
        <Link
          href="/jobs"
          style={{ fontSize: "0.78rem", color: "var(--accent-soft)", fontWeight: 600 }}
        >
          View all →
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "2rem 0",
          color: "var(--text-muted)",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.3 }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <p style={{ fontSize: "0.875rem", textAlign: "center" }}>
          No jobs yet. Run a lead finder search to get started.
        </p>
        <Link href="/lead-finder" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>
          Open Lead Finder
        </Link>
      </div>
    </div>
  );
}
