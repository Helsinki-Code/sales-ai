"use client";

import { useState, useEffect } from "react";

interface PolicyRow {
  endpoint: string;
  defaultModel: string;
  allowedModels: string;
}

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
  { name: "Report to PDF", endpoint: "report-pdf" },
];

export function ModelPoliciesSection() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchPolicies();
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
      const policyMap = data.policies || {};
      setPolicies(
        ENDPOINTS.map((ep) => ({
          endpoint: ep.endpoint,
          defaultModel: policyMap[ep.endpoint]?.defaultModel || "",
          allowedModels: policyMap[ep.endpoint]?.allowedModels?.join(", ") || ""
        }))
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to fetch policies"
      });
      setPolicies(ENDPOINTS.map((ep) => ({ endpoint: ep.endpoint, defaultModel: "", allowedModels: "" })));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolicyChange = (endpoint: string, field: "defaultModel" | "allowedModels", value: string) => {
    setPolicies((prev) =>
      prev.map((p) => (p.endpoint === endpoint ? { ...p, [field]: value } : p))
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);
      const policiesMap: Record<string, any> = {};
      policies.forEach((p) => {
        policiesMap[p.endpoint] = {
          defaultModel: p.defaultModel || null,
          allowedModels: p.allowedModels
            ? p.allowedModels.split(",").map((m) => m.trim()).filter(Boolean)
            : []
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

      setMessage({ type: "success", text: "Model policies saved successfully!" });
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
      <h3 style={{ marginBottom: "0.5rem" }}>Model Configuration</h3>
      <p style={{ color: "var(--slate)", marginBottom: "1.5rem" }}>
        Configure default and allowed models for each endpoint. Leave empty to use system defaults.
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
            fontSize: "0.9rem"
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                Endpoint
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                Default Model
              </th>
              <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                Allowed Models
              </th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy, idx) => {
              const endpointInfo = ENDPOINTS.find((e) => e.endpoint === policy.endpoint);
              return (
                <tr key={policy.endpoint} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem" }}>
                    <div style={{ fontWeight: "500" }}>{endpointInfo?.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--slate)" }}>{policy.endpoint}</div>
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <input
                      type="text"
                      placeholder="e.g., claude-3-5-sonnet-20241022"
                      value={policy.defaultModel}
                      onChange={(e) => handlePolicyChange(policy.endpoint, "defaultModel", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        fontFamily: "monospace",
                        boxSizing: "border-box"
                      }}
                    />
                  </td>
                  <td style={{ padding: "0.75rem" }}>
                    <input
                      type="text"
                      placeholder="e.g., claude-3-5-sonnet-20241022, claude-3-opus-20250219"
                      value={policy.allowedModels}
                      onChange={(e) => handlePolicyChange(policy.endpoint, "allowedModels", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
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
