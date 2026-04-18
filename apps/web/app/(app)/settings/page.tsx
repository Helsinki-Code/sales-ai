"use client";

import { useState, useEffect } from "react";
import { ApiKeysSection } from "@/components/settings/api-keys-section";
import { ProviderCredentialsSection } from "@/components/settings/provider-credentials-section";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"credentials" | "keys">("credentials");

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
            onClick={() => setActiveTab("keys")}
            style={{
              padding: "0.75rem 1.5rem",
              border: "none",
              background: "none",
              borderBottom: activeTab === "keys" ? "2px solid var(--accent)" : "none",
              cursor: "pointer",
              fontWeight: activeTab === "keys" ? "600" : "400",
              color: activeTab === "keys" ? "var(--ink)" : "var(--slate)"
            }}
          >
            API Keys
          </button>
        </div>

        {activeTab === "credentials" && <ProviderCredentialsSection />}
        {activeTab === "keys" && <ApiKeysSection />}
      </div>
    </main>
  );
}