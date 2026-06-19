"use client";

import { useState } from "react";
import { ProviderCredentialsSection } from "@/components/settings/provider-credentials-section";
import { ModelPoliciesSection } from "@/components/settings/model-policies-section";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"credentials" | "policies">("credentials");

  return (
    <div style={{ paddingTop: "1.75rem" }}>
      <div style={{ marginBottom: "0.5rem" }}>
        <p className="eyebrow" style={{ marginBottom: "0.3rem" }}>Configuration</p>
        <h1 className="page-title">Settings</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", marginTop: "0.35rem" }}>
          Configure your Anthropic provider key and model policies.
        </p>
      </div>

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === "credentials" ? "active" : ""}`}
          onClick={() => setActiveTab("credentials")}
          type="button"
        >
          Provider Credentials
        </button>
        <button
          className={`settings-tab ${activeTab === "policies" ? "active" : ""}`}
          onClick={() => setActiveTab("policies")}
          type="button"
        >
          Model Policies
        </button>
      </div>

      {activeTab === "credentials" && <ProviderCredentialsSection />}
      {activeTab === "policies" && <ModelPoliciesSection />}
    </div>
  );
}
