"use client";

import Link from "next/link";

const SALES_TOOLS = [
  {
    name: "Quick Scan",
    endpoint: "quick",
    description: "Fast company overview from a URL",
    type: "sync"
  },
  {
    name: "Company Research",
    endpoint: "research",
    description: "Deep research on company background and market",
    type: "sync"
  },
  {
    name: "Lead Qualification",
    endpoint: "qualify",
    description: "Qualify leads using BANT/MEDDIC framework",
    type: "sync"
  },
  {
    name: "Find Contacts",
    endpoint: "contacts",
    description: "Discover decision makers and contact info",
    type: "sync"
  },
  {
    name: "Generate Outreach",
    endpoint: "outreach",
    description: "Create personalized cold email sequences",
    type: "sync"
  },
  {
    name: "Follow-Up Strategy",
    endpoint: "followup",
    description: "Plan follow-up sequences for prospects",
    type: "sync"
  },
  {
    name: "Meeting Prep",
    endpoint: "prep",
    description: "Prepare talking points and objection handling",
    type: "sync"
  },
  {
    name: "Sales Proposal",
    endpoint: "proposal",
    description: "Generate custom proposal outlines",
    type: "sync"
  },
  {
    name: "Objection Handling",
    endpoint: "objections",
    description: "Strategies for common sales objections",
    type: "sync"
  },
  {
    name: "ICP Builder",
    endpoint: "icp",
    description: "Define ideal customer profile",
    type: "sync"
  },
  {
    name: "Competitor Analysis",
    endpoint: "competitors",
    description: "Research competitive landscape",
    type: "sync"
  },
  {
    name: "Prospect Deep Dive",
    endpoint: "prospect",
    description: "Comprehensive async prospect analysis",
    type: "async"
  },
  {
    name: "Lead Generation",
    endpoint: "leads",
    description: "Find and qualify multiple leads",
    type: "async"
  },
  {
    name: "Generate Report",
    endpoint: "report",
    description: "Create analysis reports from job results",
    type: "async"
  },
  {
    name: "Report to PDF",
    endpoint: "report-pdf",
    description: "Export reports as professional PDFs",
    type: "async"
  }
];

export default function SalesPage() {
  return (
    <main>
      <h1 className="page-title">Sales Tools</h1>
      <p style={{ color: "var(--slate)", marginBottom: "2rem", maxWidth: "600px" }}>
        Powered by Claude AI. Use these tools to research companies, qualify leads, generate outreach, and close deals faster.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {SALES_TOOLS.map((tool) => (
          <Link
            key={tool.endpoint}
            href={`/sales/${tool.endpoint}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "100%",
                cursor: "pointer",
                transition: "all 0.2s",
                border: "1px solid var(--border)"
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0" }}>{tool.name}</h3>
                <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem", lineHeight: "1.4" }}>
                  {tool.description}
                </p>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    backgroundColor: tool.type === "async" ? "var(--panel)" : "var(--mint)",
                    color: tool.type === "async" ? "var(--slate)" : "var(--ink)"
                  }}
                >
                  {tool.type === "async" ? "Async Job" : "Instant"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
