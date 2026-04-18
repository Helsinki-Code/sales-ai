"use client";

import { useState } from "react";
import Link from "next/link";
import { ToolForm } from "@/components/sales/tool-form";
import { ResultViewer } from "@/components/sales/result-viewer";
import { JobPoller } from "@/components/sales/job-poller";

const SYNC_ENDPOINTS = ["quick", "research", "qualify", "contacts", "outreach", "followup", "prep", "proposal", "objections", "icp", "competitors"];
const ASYNC_ENDPOINTS = ["prospect", "leads", "report", "report-pdf"];

const TOOL_INFO: Record<string, { name: string; description: string }> = {
  quick: { name: "Quick Scan", description: "Fast company overview from URL" },
  research: { name: "Company Research", description: "Deep research on company background" },
  qualify: { name: "Lead Qualification", description: "Qualify leads using BANT/MEDDIC" },
  contacts: { name: "Find Contacts", description: "Discover decision makers" },
  outreach: { name: "Generate Outreach", description: "Create cold email sequences" },
  followup: { name: "Follow-Up Strategy", description: "Plan follow-up sequences" },
  prep: { name: "Meeting Prep", description: "Prepare talking points" },
  proposal: { name: "Sales Proposal", description: "Generate proposal outlines" },
  objections: { name: "Objection Handling", description: "Handle common objections" },
  icp: { name: "ICP Builder", description: "Define ideal customer profile" },
  competitors: { name: "Competitor Analysis", description: "Research competitive landscape" },
  prospect: { name: "Prospect Deep Dive", description: "Comprehensive prospect analysis (async)" },
  leads: { name: "Lead Generation", description: "Find and qualify multiple leads (async)" },
  report: { name: "Generate Report", description: "Create analysis reports (async)" },
  "report-pdf": { name: "Report to PDF", description: "Export as PDF (async)" }
};

type PageProps = {
  params: { endpoint: string };
};

export default function ToolPage({ params }: PageProps) {
  const endpoint = params.endpoint;
  const isAsync = ASYNC_ENDPOINTS.includes(endpoint);
  const tool = TOOL_INFO[endpoint];

  const [result, setResult] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tool) {
    return (
      <main>
        <h1 className="page-title">Tool Not Found</h1>
        <p>This tool doesn't exist.</p>
        <Link href="/sales" className="cta">
          Back to Sales Tools
        </Link>
      </main>
    );
  }

  const handleSubmit = async (formData: Record<string, any>) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);

    try {
      const res = await fetch(`/api/sales/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Request failed");
      }

      if (isAsync) {
        setJobId(data.jobId);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/sales" style={{ color: "var(--accent)", textDecoration: "none" }}>
          ← Back to Sales Tools
        </Link>
      </div>

      <h1 className="page-title">{tool.name}</h1>
      <p style={{ color: "var(--slate)", marginBottom: "2rem" }}>{tool.description}</p>

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "2rem" }}>
        <div className="card" style={{ height: "fit-content" }}>
          <h3>Run Tool</h3>
          <ToolForm endpoint={endpoint} onSubmit={handleSubmit} isLoading={isLoading} />
          {error && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                backgroundColor: "var(--slate)",
                color: "white",
                borderRadius: "4px",
                fontSize: "0.9rem"
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div>
          {jobId && !result ? (
            <JobPoller jobId={jobId} endpoint={endpoint} onComplete={setResult} />
          ) : result ? (
            <ResultViewer result={result} />
          ) : (
            <div className="card">
              <p style={{ color: "var(--slate)", textAlign: "center" }}>
                Fill out the form and submit to see results here.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
