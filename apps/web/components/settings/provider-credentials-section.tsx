"use client";

import { useState } from "react";

type Provider = "anthropic" | "openai" | "gemini";

const providerMetadata: Record<
  Provider,
  {
    label: string;
    placeholder: string;
    docsUrl: string;
  }
> = {
  anthropic: {
    label: "Anthropic",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/keys"
  },
  openai: {
    label: "OpenAI",
    placeholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys"
  },
  gemini: {
    label: "Gemini",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey"
  }
};

export function ProviderCredentialsSection() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/provider-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save credentials");
      }

      setMessage({ type: "success", text: `${providerMetadata[provider].label} API key saved successfully.` });
      setApiKey("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "An error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: "560px" }}>
      <h3>Bring Your Own Model Keys</h3>
      <p style={{ color: "var(--slate)", marginBottom: "1.5rem" }}>
        Save workspace keys for Anthropic, OpenAI, or Gemini. Keys are encrypted at rest and used only for your
        workspace.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="provider-select" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
          Provider
        </label>
        <select
          id="provider-select"
          value={provider}
          onChange={(event) => setProvider(event.target.value as Provider)}
          style={{
            display: "block",
            width: "100%",
            padding: "0.75rem",
            marginBottom: "1rem",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            fontSize: "0.95rem"
          }}
        >
          {(Object.keys(providerMetadata) as Provider[]).map((providerOption) => (
            <option key={providerOption} value={providerOption}>
              {providerMetadata[providerOption].label}
            </option>
          ))}
        </select>

        <label htmlFor="api-key" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
          API Key
        </label>
        <input
          id="api-key"
          type="password"
          placeholder={providerMetadata[provider].placeholder}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          required
          minLength={16}
          style={{
            display: "block",
            width: "100%",
            padding: "0.75rem",
            marginBottom: "1rem",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            fontSize: "0.95rem",
            fontFamily: "monospace",
            boxSizing: "border-box"
          }}
        />

        <button
          type="submit"
          disabled={isLoading || !apiKey}
          className="cta"
          style={{
            opacity: isLoading || !apiKey ? 0.6 : 1,
            cursor: isLoading || !apiKey ? "not-allowed" : "pointer"
          }}
        >
          {isLoading ? "Saving..." : `Save ${providerMetadata[provider].label} Key`}
        </button>
      </form>

      {message && (
        <div
          style={{
            marginTop: "1rem",
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

      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          backgroundColor: "var(--panel)",
          borderRadius: "4px",
          fontSize: "0.85rem",
          color: "var(--slate)"
        }}
      >
        <p style={{ margin: "0 0 0.5rem 0", fontWeight: "500" }}>Get your API keys:</p>
        <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
          {(Object.keys(providerMetadata) as Provider[]).map((providerOption) => (
            <li key={providerOption} style={{ marginBottom: "0.3rem" }}>
              {providerMetadata[providerOption].label}:{" "}
              <a href={providerMetadata[providerOption].docsUrl} target="_blank" rel="noopener noreferrer">
                {providerMetadata[providerOption].docsUrl}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
