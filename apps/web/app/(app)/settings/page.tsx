"use client";

import { useState } from "react";
import { ProviderCredentialsSection } from "@/components/settings/provider-credentials-section";
import { ModelPoliciesSection } from "@/components/settings/model-policies-section";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"credentials" | "policies">("credentials");

  return (
    <main>
      <h1 className="page-title">Settings</h1>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid var(--border)", marginBottom: "2rem" }}>
          <button
            onClick={() => setActiveTab("credentials")}
            style={{
              padding: "0.75rem 1.5rem",
              border: "none",
              background: "none",
              borderBottom: activeTab === "credentials" ? "2px solid var(--accent)" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "credentials" ? "600" : "400",
              color: activeTab === "credentials" ? "var(--ink)" : "var(--slate)"
            }}
          >
            Provider Credentials
          </button>
          <button
            onClick={() => setActiveTab("policies")}
            style={{
              padding: "0.75rem 1.5rem",
              border: "none",
              background: "none",
              borderBottom: activeTab === "policies" ? "2px solid var(--accent)" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "policies" ? "600" : "400",
              color: activeTab === "policies" ? "var(--ink)" : "var(--slate)"
            }}
          >
            Model Policies
          </button>
        </div>

        {activeTab === "credentials" && <ProviderCredentialsSection />}
        {activeTab === "policies" && <ModelPoliciesSection />}
      </div>
    </main>
  );
}