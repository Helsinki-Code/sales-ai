"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { generateSnippet, generatePollingSnippet, getEndpointInfo } from "@/components/reference/snippet-generator";
import { CodeBlock } from "@/components/reference/code-block";

const SYNC_ENDPOINTS = ["quick", "research", "qualify", "contacts", "outreach", "followup", "prep", "proposal", "objections", "icp", "competitors"];
const ASYNC_ENDPOINTS = ["prospect", "leads", "report", "report-pdf"];
const ALL_ENDPOINTS = [...SYNC_ENDPOINTS, ...ASYNC_ENDPOINTS];

type Language = "curl" | "python" | "typescript" | "javascript" | "go" | "php" | "ruby";
const LANGUAGES: Language[] = ["curl", "python", "typescript", "javascript", "go", "php", "ruby"];

interface FormData {
  [key: string]: string | number;
}

function sanitizeBaseUrl(raw: string) {
  return raw.replace(/\/+$/, "");
}

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

export default function ReferencePage() {
  const searchParams = useSearchParams();
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("qualify");
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("curl");
  const [apiKey, setApiKey] = useState<string>("YOUR_API_KEY");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [formData, setFormData] = useState<FormData>({});

  useEffect(() => {
    const urlFromEnv = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";
    setBaseUrl(sanitizeBaseUrl(urlFromEnv));

    // Fetch API key on mount
    (async () => {
      try {
        const res = await fetch("/api/admin/api-keys");
        const data = await res.json();
        const keys = Array.isArray(data?.data) ? data.data : [];
        if (res.ok && keys.length > 0) {
          const activeKey = keys.find((k: any) => k.status === "active");
          if (activeKey) {
            // Show prefix only for security
            setApiKey(`sak_${activeKey.id.substring(0, 8)}...`);
          }
        }
      } catch (error) {
        console.error("Failed to fetch API keys:", error);
      }
    })();
  }, []);

  useEffect(() => {
    const endpointFromQuery = searchParams.get("endpoint");
    if (endpointFromQuery && ALL_ENDPOINTS.includes(endpointFromQuery)) {
      setSelectedEndpoint(endpointFromQuery);
      setFormData({});
    }
  }, [searchParams]);

  const endpointInfo = getEndpointInfo(selectedEndpoint);
  if (!endpointInfo) return null;

  // Build form fields based on endpoint
  const renderFormField = (param: any) => {
    const value = formData[param.name] || "";

    return (
      <div key={param.name} style={{ marginBottom: "1rem" }}>
        <label
          htmlFor={param.name}
          style={{
            display: "block",
            fontSize: "0.9rem",
            fontWeight: "500",
            marginBottom: "0.5rem",
          }}
        >
          {param.name} {param.required ? "*" : "(optional)"}
        </label>
        {param.type === "array" ? (
          <textarea
            id={param.name}
            placeholder={`["uuid-1", "uuid-2"]`}
            value={value}
            onChange={(e) => setFormData({ ...formData, [param.name]: e.target.value })}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
            rows={3}
          />
        ) : (
          <input
            id={param.name}
            type={param.type === "number" ? "number" : "text"}
            placeholder={param.description}
            value={value}
            onChange={(e) => setFormData({ ...formData, [param.name]: e.target.value })}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>
    );
  };

  // Build payload from form data
  const buildPayload = (): Record<string, any> => {
    const payload: Record<string, any> = {};
    endpointInfo.params.forEach((param) => {
      const rawValue = formData[param.name];
      if (rawValue !== undefined && rawValue !== "") {
        const value = formData[param.name];
        if (param.type === "number") {
          payload[param.name] = Number(value);
        } else if (param.type === "array") {
          try {
            payload[param.name] = JSON.parse(value as string);
          } catch {
            payload[param.name] = [];
          }
        } else {
          payload[param.name] = value;
        }
      } else if (param.required) {
        payload[param.name] = sampleValueForParam(param);
      }
    });
    return payload;
  };

  const payload = buildPayload();
  const snippet = generateSnippet(selectedLanguage, selectedEndpoint, payload, apiKey, baseUrl);
  const isAsync = ASYNC_ENDPOINTS.includes(selectedEndpoint);

  return (
    <main style={{ paddingBottom: "4rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ color: "var(--accent)", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="page-title">API Reference</h1>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "2rem" }}>
        {/* Left Sidebar */}
        <aside
          style={{
            backgroundColor: "var(--panel)",
            borderRadius: "4px",
            padding: "1rem",
            height: "fit-content",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", fontWeight: "600", color: "var(--slate)" }}>
            Endpoints
          </h3>

          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: "500", color: "var(--accent)", marginBottom: "0.5rem" }}>
              SYNC (Instant)
            </div>
            {SYNC_ENDPOINTS.map((endpoint) => (
              <button
                key={endpoint}
                onClick={() => {
                  setSelectedEndpoint(endpoint);
                  setFormData({});
                  setSelectedLanguage("curl");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  marginBottom: "0.5rem",
                  border: "none",
                  backgroundColor: selectedEndpoint === endpoint ? "var(--accent)" : "transparent",
                  color: selectedEndpoint === endpoint ? "white" : "var(--ink)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: selectedEndpoint === endpoint ? "600" : "400",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (selectedEndpoint !== endpoint) {
                    (e.target as HTMLButtonElement).style.backgroundColor = "var(--border)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEndpoint !== endpoint) {
                    (e.target as HTMLButtonElement).style.backgroundColor = "transparent";
                  }
                }}
              >
                /{endpoint}
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: "500", color: "var(--accent)", marginBottom: "0.5rem" }}>
              ASYNC (Polling)
            </div>
            {ASYNC_ENDPOINTS.map((endpoint) => (
              <button
                key={endpoint}
                onClick={() => {
                  setSelectedEndpoint(endpoint);
                  setFormData({});
                  setSelectedLanguage("curl");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  marginBottom: "0.5rem",
                  border: "none",
                  backgroundColor: selectedEndpoint === endpoint ? "var(--accent)" : "transparent",
                  color: selectedEndpoint === endpoint ? "white" : "var(--ink)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                  fontWeight: selectedEndpoint === endpoint ? "600" : "400",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (selectedEndpoint !== endpoint) {
                    (e.target as HTMLButtonElement).style.backgroundColor = "var(--border)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEndpoint !== endpoint) {
                    (e.target as HTMLButtonElement).style.backgroundColor = "transparent";
                  }
                }}
              >
                /{endpoint}
              </button>
            ))}
          </div>
        </aside>

        {/* Right Content */}
        <div>
          <div className="card" style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0 }}>POST /api/sales/{selectedEndpoint}</h2>
              <span style={{ fontSize: "0.85rem", fontWeight: "500", color: "var(--accent)" }}>
                {isAsync ? "ASYNC (Polling)" : "SYNC (Instant)"}
              </span>
            </div>
            <p style={{ color: "var(--slate)", margin: 0 }}>{endpointInfo.description}</p>

            <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "var(--panel)", borderRadius: "4px" }}>
              <code style={{ fontSize: "0.85rem", fontFamily: "monospace" }}>
                {baseUrl}/api/sales/{selectedEndpoint}
              </code>
            </div>
          </div>

          {/* Parameters Table */}
          {endpointInfo.params.length > 0 && (
            <div className="card" style={{ marginBottom: "2rem" }}>
              <h3>Parameters</h3>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                        Field
                      </th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                        Type
                      </th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                        Required
                      </th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpointInfo.params.map((param) => (
                      <tr key={param.name} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                          {param.name}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "var(--slate)" }}>
                          {param.type}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "var(--slate)" }}>
                          {param.required ? "Yes" : "No"}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "var(--slate)" }}>
                          {param.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Form to fill parameters */}
          <div className="card" style={{ marginBottom: "2rem" }}>
            <h3>Try It Out</h3>
            {endpointInfo.params.map(renderFormField)}
            <Link
              href={`/playground/${selectedEndpoint}`}
              style={{
                display: "inline-block",
                marginTop: "1rem",
                color: "var(--accent)",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              → Test in Playground
            </Link>
          </div>

          {/* Code Snippets */}
          <div className="card" style={{ marginBottom: "2rem" }}>
            <h3>Code Examples</h3>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto" }}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid var(--border)",
                    backgroundColor: selectedLanguage === lang ? "var(--accent)" : "transparent",
                    color: selectedLanguage === lang ? "white" : "var(--ink)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: selectedLanguage === lang ? "600" : "400",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>

            <CodeBlock code={snippet} language={selectedLanguage} />

            {isAsync && (
              <div style={{ marginTop: "2rem" }}>
                <h4 style={{ marginBottom: "1rem", fontSize: "0.95rem" }}>Poll for Results</h4>
                <p style={{ color: "var(--slate)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                  After receiving a job ID, poll this endpoint every 2-3 seconds until the job completes:
                </p>
                <CodeBlock
                  code={generatePollingSnippet(selectedLanguage, baseUrl, apiKey, "550e8400-e29b-41d4-a716-446655440000")}
                  language={selectedLanguage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
