"use client";

import { useState, useEffect } from "react";

interface ApiKey {
  id: string;
  name: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/api-keys");
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching keys");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      setError("Key name is required");
      return;
    }

    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scopes: ["sales:run", "jobs:read", "jobs:write"] }),
      });

      if (!res.ok) throw new Error("Failed to create key");
      const data = await res.json();
      setNewToken(data.token);
      setNewKeyName("");
      setShowCreateForm(false);
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating key");
    }
  };

  const handleRotateKey = async (keyId: string) => {
    try {
      const res = await fetch(`/api/admin/api-keys/${keyId}/rotate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to rotate key");
      const data = await res.json();
      setNewToken(data.token);
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error rotating key");
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/api-keys/${keyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke key");
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error revoking key");
    }
  };

  return (
    <main>
      <h1 className="page-title">API Keys</h1>
      <p style={{ color: "var(--slate)", marginBottom: "2rem" }}>
        Use these keys in the <code>Authorization: Bearer</code> header when calling the API.
      </p>

      {error && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "var(--slate)",
            color: "white",
            borderRadius: "4px",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {newToken && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--mint)",
            borderRadius: "4px",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Your new API key (save this now — you won't see it again)</div>
          <code
            style={{
              display: "block",
              padding: "0.75rem",
              backgroundColor: "var(--panel)",
              borderRadius: "4px",
              marginBottom: "0.75rem",
              fontSize: "0.85rem",
              overflow: "auto",
              wordBreak: "break-all",
            }}
          >
            {newToken}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newToken);
              alert("Copied to clipboard!");
            }}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "500",
            }}
          >
            Copy Token
          </button>
          <button
            onClick={() => setNewToken(null)}
            style={{
              marginLeft: "0.5rem",
              padding: "0.5rem 1rem",
              backgroundColor: "var(--border)",
              color: "var(--ink)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: "2rem" }}>
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="cta"
            style={{ marginBottom: "1rem" }}
          >
            Create New Key
          </button>
        ) : (
          <form onSubmit={handleCreateKey} style={{ marginBottom: "1rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="keyName" style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem" }}>
                Key Name
              </label>
              <input
                id="keyName"
                type="text"
                placeholder="e.g., Production API"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="cta">
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "var(--border)",
                  color: "var(--ink)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {isLoading ? (
        <div className="card" style={{ textAlign: "center", color: "var(--slate)" }}>
          Loading API keys...
        </div>
      ) : keys.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--slate)" }}>
          No API keys yet. Create one to get started.
        </div>
      ) : (
        <div className="card">
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
                    Name
                  </th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                    Prefix
                  </th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                    Status
                  </th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                    Last Used
                  </th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                    Created
                  </th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600", color: "var(--accent)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem", fontWeight: "500" }}>{key.name}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                      sak_{key.id.substring(0, 8)}...
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                          backgroundColor: key.status === "active" ? "var(--mint)" : "var(--slate)",
                          color: key.status === "active" ? "var(--ink)" : "white",
                        }}
                      >
                        {key.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "var(--slate)" }}>
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                    </td>
                    <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "var(--slate)" }}>
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {key.status === "active" && (
                          <>
                            <button
                              onClick={() => handleRotateKey(key.id)}
                              style={{
                                padding: "0.4rem 0.75rem",
                                fontSize: "0.85rem",
                                backgroundColor: "transparent",
                                color: "var(--accent)",
                                border: "1px solid var(--accent)",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Rotate
                            </button>
                            <button
                              onClick={() => handleRevokeKey(key.id)}
                              style={{
                                padding: "0.4rem 0.75rem",
                                fontSize: "0.85rem",
                                backgroundColor: "transparent",
                                color: "var(--slate)",
                                border: "1px solid var(--slate)",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
