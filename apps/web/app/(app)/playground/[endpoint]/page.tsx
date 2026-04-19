"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ToolForm } from "@/components/sales/tool-form";
import { ResultViewer } from "@/components/sales/result-viewer";
import { JobPoller } from "@/components/sales/job-poller";
import { CodeBlock } from "@/components/reference/code-block";
import { generateSnippet, getEndpointInfo } from "@/components/reference/snippet-generator";

const SYNC_ENDPOINTS = ["quick", "research", "qualify", "contacts", "outreach", "followup", "prep", "proposal", "objections", "icp", "competitors"];
const ASYNC_ENDPOINTS = ["prospect", "leads", "report", "report-pdf"];
const ENDPOINT_ALIASES: Record<string, string> = {
  "quick-scan": "quick",
  quickscan: "quick",
  quick_scan: "quick",
  "company-research": "research",
  "lead-qualification": "qualify",
  "find-contacts": "contacts",
  "generate-outreach": "outreach",
  "follow-up-strategy": "followup",
  "meeting-prep": "prep",
  "sales-proposal": "proposal",
  "objection-handling": "objections",
  "icp-builder": "icp",
  "competitor-analysis": "competitors",
  "prospect-deep-dive": "prospect",
  "lead-generation": "leads",
  "generate-report": "report",
  "report-to-pdf": "report-pdf"
};
type Language = "curl" | "python" | "typescript" | "javascript" | "go" | "php" | "ruby";
const LANGUAGES: Language[] = ["curl", "python", "typescript", "javascript", "go", "php", "ruby"];

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

function sampleValueForParam(param: { name: string; type: string }): string | number | string[] {
  if (param.name === "url") return "https://example.com";
  if (param.name === "prospect") return "Jane Doe, VP Sales";
  if (param.name === "client") return "Acme Corp";
  if (param.name === "topic") return "Price objection";
  if (param.name === "description") return "B2B SaaS companies with 50-500 employees in North America";
  if (param.name === "count") return 25;
  if (param.name === "jobIds") return ["550e8400-e29b-41d4-a716-446655440000"];
  if (param.type === "number") return 1;
  if (param.type === "array") return ["sample"];
  return "sample";
}

function buildDefaultPayload(endpoint: string): Record<string, unknown> {
  const info = getEndpointInfo(endpoint);
  if (!info) return {};

  const payload: Record<string, unknown> = {};
  for (const param of info.params) {
    if (param.required) {
      payload[param.name] = sampleValueForParam({ name: param.name, type: param.type });
    }
  }
  return payload;
}

export default function ToolPage() {
  const params = useParams<{ endpoint?: string | string[] }>();
  const rawEndpoint = params.endpoint;
  const endpointParam =
    typeof rawEndpoint === "string"
      ? rawEndpoint
      : Array.isArray(rawEndpoint)
      ? rawEndpoint[0] || ""
      : "";
  const endpoint = ENDPOINT_ALIASES[endpointParam] || endpointParam;
  const isAsync = ASYNC_ENDPOINTS.includes(endpoint);
  const tool = TOOL_INFO[endpoint];

  const [result, setResult] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("curl");
  const [lastPayload, setLastPayload] = useState<Record<string, any> | null>(null);
  const [baseUrl, setBaseUrl] = useState("https://your-app.vercel.app");

  useEffect(() => {
    const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    if (envUrl) {
      setBaseUrl(envUrl);
      return;
    }

    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin.replace(/\/+$/, ""));
    }
  }, []);

  if (!tool) {
    return (
      <main>
        <h1 className="page-title">Tool Not Found</h1>
        <p>This tool doesn't exist.</p>
        <Link href="/playground" className="cta">
          Back to Playground
        </Link>
      </main>
    );
  }

  const handleSubmit = async (formData: Record<string, any>) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);
    setLastPayload(formData);

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
        <Link href="/playground" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Back to Playground
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
          <button
            type="button"
            onClick={() => setShowSnippets((prev) => !prev)}
            style={{
              display: "block",
              marginTop: "1rem",
              color: "var(--accent)",
              textDecoration: "none",
              fontSize: "0.9rem",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer"
            }}
          >
            {showSnippets ? "Hide code snippets" : "View code snippets"}
          </button>
          <Link
            href={`/reference?endpoint=${endpoint}`}
            style={{
              display: "block",
              marginTop: "0.6rem",
              color: "var(--slate)",
              textDecoration: "none",
              fontSize: "0.85rem"
            }}
          >
            Open full API reference
          </Link>
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

      {showSnippets && (
        <section className="card" style={{ marginTop: "2rem" }}>
          <h3 style={{ marginTop: 0 }}>Code Snippets for This Run</h3>
          <p style={{ color: "var(--slate)", marginTop: "0.25rem" }}>
            Uses your current endpoint and the most recent submitted payload.
          </p>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", overflowX: "auto" }}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                style={{
                  padding: "0.45rem 0.9rem",
                  border: "1px solid var(--border)",
                  backgroundColor: selectedLanguage === lang ? "var(--accent)" : "transparent",
                  color: selectedLanguage === lang ? "white" : "var(--ink)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: selectedLanguage === lang ? "600" : "400",
                  whiteSpace: "nowrap",
                }}
              >
                {lang}
              </button>
            ))}
          </div>

          <CodeBlock
            code={generateSnippet(
              selectedLanguage,
              endpoint,
              lastPayload || buildDefaultPayload(endpoint),
              "YOUR_API_KEY",
              baseUrl
            )}
            language={selectedLanguage}
          />
        </section>
      )}
    </main>
  );
}
