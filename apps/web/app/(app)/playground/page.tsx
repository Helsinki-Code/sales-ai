import Link from "next/link";

const TOOLS = [
  { name: "Quick Scan", endpoint: "quick", description: "Fast company overview from URL", type: "sync" },
  { name: "Company Research", endpoint: "research", description: "Deep research on company background", type: "sync" },
  { name: "Lead Qualification", endpoint: "qualify", description: "Qualify leads using BANT/MEDDIC", type: "sync" },
  { name: "Find Contacts", endpoint: "contacts", description: "Discover decision makers", type: "sync" },
  { name: "Generate Outreach", endpoint: "outreach", description: "Create cold email sequences", type: "sync" },
  { name: "Follow-Up Strategy", endpoint: "followup", description: "Plan follow-up sequences", type: "sync" },
  { name: "Meeting Prep", endpoint: "prep", description: "Prepare talking points", type: "sync" },
  { name: "Sales Proposal", endpoint: "proposal", description: "Generate proposal outlines", type: "sync" },
  { name: "Objection Handling", endpoint: "objections", description: "Handle common objections", type: "sync" },
  { name: "ICP Builder", endpoint: "icp", description: "Define ideal customer profile", type: "sync" },
  { name: "Competitor Analysis", endpoint: "competitors", description: "Research competitive landscape", type: "sync" },
  { name: "Prospect Deep Dive", endpoint: "prospect", description: "Comprehensive prospect analysis", type: "async" },
  { name: "Lead Generation", endpoint: "leads", description: "Find and qualify multiple leads", type: "async" },
  { name: "Generate Report", endpoint: "report", description: "Create analysis reports", type: "async" },
  { name: "Report to PDF", endpoint: "report-pdf", description: "Export as PDF", type: "async" },
];

export default function PlaygroundPage() {
  return (
    <main>
      <h1 className="page-title">API Playground</h1>
      <p style={{ color: "var(--slate)", marginBottom: "2rem" }}>
        Test endpoints interactively. For production use, copy code snippets from{" "}
        <Link href="/reference" style={{ color: "var(--accent)" }}>
          API Reference
        </Link>
        .
      </p>

      <div className="grid grid-3">
        {TOOLS.map((tool) => (
          <Link
            href={`/playground/${tool.endpoint}`}
            key={tool.endpoint}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article className="card" style={{ cursor: "pointer", height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                <h3 style={{ margin: 0 }}>{tool.name}</h3>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "3px",
                    backgroundColor: tool.type === "sync" ? "var(--mint)" : "var(--accent)",
                    color: tool.type === "sync" ? "var(--ink)" : "white",
                  }}
                >
                  {tool.type === "sync" ? "Instant" : "Async"}
                </span>
              </div>
              <p style={{ color: "var(--slate)", margin: 0 }}>{tool.description}</p>
            </article>
          </Link>
        ))}
      </div>
    </main>
  );
}
