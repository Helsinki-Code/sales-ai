"use client";

import { useEffect, useState } from "react";

type Provider = "anthropic" | "openai" | "gemini";

interface PolicyRow {
  endpoint: string;
  defaultProvider: Provider;
  defaultModel: string;
  allowedProviders: string;
  allowedModels: string;
}

const PROVIDERS: Provider[] = ["anthropic", "openai", "gemini"];

const ENDPOINTS = [
  { name: "Quick Scan", endpoint: "quick" },
  { name: "Company Research", endpoint: "research" },
  { name: "Lead Qualification", endpoint: "qualify" },
  { name: "Find Contacts", endpoint: "contacts" },
  { name: "Generate Outreach", endpoint: "outreach" },
  { name: "Follow-Up Strategy", endpoint: "followup" },
  { name: "Meeting Prep", endpoint: "prep" },
  { name: "Sales Proposal", endpoint: "proposal" },
  { name: "Objection Handling", endpoint: "objections" },
  { name: "ICP Builder", endpoint: "icp" },
  { name: "Competitor Analysis", endpoint: "competitors" },
  { name: "Prospect Deep Dive", endpoint: "prospect" },
  { name: "Lead Generation", endpoint: "leads" },
  { name: "Generate Report", endpoint: "report" },
  { name: "Report to PDF", endpoint: "report-pdf" }
];

export function ModelPoliciesSection() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    void fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/model-policies");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to fetch policies");
      }
      const data = await res.json();
      const policyMap = (data.policies ?? {}) as Record<
        string,
        { defaultProvider?: Provider; defaultModel?: string; allowedProviders?: string[]; allowedModels?: string[] }
      >;

      setPolicies(
        ENDPOINTS.map((ep) => ({
          endpoint: ep.endpoint,
          defaultProvider: policyMap[ep.endpoint]?.defaultProvider ?? "anthropic",
          defaultModel: policyMap[ep.endpoint]?.defaultModel ?? "",
          allowedProviders: (policyMap[ep.endpoint]?.allowedProviders ?? ["anthropic"]).join(", "),
          allowedModels: (policyMap[ep.endpoint]?.allowedModels ?? []).join(", ")
        }))
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to fetch policies"
      });
      setPolicies(
        ENDPOINTS.map((ep) => ({
          endpoint: ep.endpoint,
          defaultProvider: "anthropic",
          defaultModel: "",
          allowedProviders: "anthropic",
          allowedModels: ""
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolicyChange = (endpoint: string, field: keyof PolicyRow, value: string) => {
    setPolicies((prev) => prev.map((row) => (row.endpoint === endpoint ? { ...row, [field]: value } : row)));
  };

  const handleDefaultProviderChange = (endpoint: string, provider: Provider) => {
    setPolicies((prev) =>
      prev.map((row) => {
        if (row.endpoint !== endpoint) return row;
        const allowed = row.allowedProviders
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (!allowed.includes(provider)) {
          allowed.unshift(provider);
        }
        return {
          ...row,
          defaultProvider: provider,
          allowedProviders: Array.from(new Set(allowed)).join(", ")
        };
      })
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      const policiesMap: Record<
        string,
        {
          defaultProvider: Provider;
          defaultModel: string | null;
          allowedProviders: Provider[];
          allowedModels: string[];
        }
      > = {};

      policies.forEach((row) => {
        const allowedProviders = row.allowedProviders
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry): entry is Provider => PROVIDERS.includes(entry as Provider));
        const providerSet = new Set<Provider>(allowedProviders.length > 0 ? allowedProviders : [row.defaultProvider]);
        providerSet.add(row.defaultProvider);
        const allowedModels = row.allowedModels
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);

        policiesMap[row.endpoint] = {
          defaultProvider: row.defaultProvider,
          defaultModel: row.defaultModel || null,
          allowedProviders: Array.from(providerSet),
          allowedModels
        };
      });

      const res = await fetch("/api/admin/model-policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policies: policiesMap })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to save policies");
      }

      setMessage({ type: "success", text: "Model policies saved successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An error occurred"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <p style={{ color: "var(--slate)", textAlign: "center" }}>Loading policies...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: "0.5rem" }}>Model Policies</h3>
      <p style={{ color: "var(--slate)", marginBottom: "1.5rem" }}>
        Set default provider/model and allowed provider/model list per endpoint.
      </p>

      {message && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            borderRadius: "4px",
            backgroundColor: message.type === "success" ? "var(--mint)" : "var(--slate)",
            color: message.type === "success" ? "var(--ink)" : "white",
            fontSize: "0.9rem"
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.86rem",
            minWidth: "980px"
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>Endpoint</th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>Default Provider</th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>Default Model</th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>Allowed Providers</th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>Allowed Models</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => {
              const endpointInfo = ENDPOINTS.find((entry) => entry.endpoint === policy.endpoint);
              return (
                <tr key={policy.endpoint} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ fontWeight: 500 }}>{endpointInfo?.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--slate)" }}>{policy.endpoint}</div>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <select
                      value={policy.defaultProvider}
                      onChange={(event) => handleDefaultProviderChange(policy.endpoint, event.target.value as Provider)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        fontSize: "0.84rem"
                      }}
                    >
                      {PROVIDERS.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <input
                      type="text"
                      placeholder="e.g. claude-sonnet-4-5"
                      value={policy.defaultModel}
                      onChange={(event) => handlePolicyChange(policy.endpoint, "defaultModel", event.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        fontSize: "0.84rem",
                        fontFamily: "monospace",
                        boxSizing: "border-box"
                      }}
                    />
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <input
                      type="text"
                      placeholder="anthropic, openai"
                      value={policy.allowedProviders}
                      onChange={(event) => handlePolicyChange(policy.endpoint, "allowedProviders", event.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        fontSize: "0.84rem",
                        fontFamily: "monospace",
                        boxSizing: "border-box"
                      }}
                    />
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <input
                      type="text"
                      placeholder="claude-sonnet-4-5, gpt-5.4, gemini-2.5-pro"
                      value={policy.allowedModels}
                      onChange={(event) => handlePolicyChange(policy.endpoint, "allowedModels", event.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        fontSize: "0.84rem",
                        fontFamily: "monospace",
                        boxSizing: "border-box"
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="cta"
        style={{
          opacity: isSaving ? 0.6 : 1,
          cursor: isSaving ? "not-allowed" : "pointer"
        }}
      >
        {isSaving ? "Saving..." : "Save Policies"}
      </button>
    </div>
  );
}
