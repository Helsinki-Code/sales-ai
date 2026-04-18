"use client";

import { useState } from "react";

export function ProviderCredentialsSection() {
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
        body: JSON.stringify({ provider: "anthropic", apiKey })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save credentials");
      }

      setMessage({ type: "success", text: "Anthropic API key saved successfully!" });
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
    <div className="card" style={{ maxWidth: "500px" }}>
      <h3>Bring Your Own Anthropic Key</h3>
      <p style={{ color: "var(--slate)", marginBottom: "1.5rem" }}>
        Enter your Anthropic API key. It's encrypted and used only for your workspace.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="api-key" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
          API Key
        </label>
        <input
          id="api-key"
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
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
          {isLoading ? "Saving..." : "Save Key"}
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
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "var(--panel)",
          borderRadius: "4px",
          fontSize: "0.85rem",
          color: "var(--slate)"
        }}
      >
        <p style={{ margin: "0 0 0.5rem 0", fontWeight: "500" }}>How to get your API key:</p>
        <ol style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
          <li>Go to <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>console.anthropic.com/keys</a></li>
          <li>Create or copy an existing API key</li>
          <li>Paste it above and save</li>
        </ol>
      </div>
    </div>
  );
}
