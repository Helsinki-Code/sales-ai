"use client";

import { useState, useEffect } from "react";

interface ApiKey {
  id: string;
  name: string;
  status: string;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyMessage, setNewKeyMessage] = useState<{ type: "success" | "error"; text: string; token?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/api-keys");
      const data = await res.json();
      if (res.ok) {
        setKeys(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("create");
    setNewKeyMessage(null);

    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scopes: ["sales:run", "jobs:read", "jobs:write"] })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create key");
      }

      setNewKeyMessage({
        type: "success",
        text: "API key created! Copy it now—you won't see it again.",
        token: data.data.token
      });
      setNewKeyName("");
      fetchKeys();
    } catch (error) {
      setNewKeyMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create key"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    setActionLoading(keyId);
    try {
      const res = await fetch(`/api/admin/api-keys/${keyId}`, { method: "DELETE" });
      if (res.ok) {
        fetchKeys();
      }
    } catch (error) {
      console.error("Failed to revoke key:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    setActionLoading(`rotate-${keyId}`);
    try {
      const res = await fetch(`/api/admin/api-keys/${keyId}/rotate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setNewKeyMessage({
          type: "success",
          text: "Key rotated! Copy the new token now.",
          token: data.data.token
        });
        fetchKeys();
      }
    } catch (error) {
      console.error("Failed to rotate key:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return <div className="card"><p>Loading API keys...</p></div>;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0 }}>API Keys</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="cta"
            style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
          >
            {showCreateForm ? "Cancel" : "Create New Key"}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateKey} style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border)" }}>
            <label htmlFor="key-name" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              Key Name
            </label>
            <input
              id="key-name"
              type="text"
              placeholder="e.g., Production API"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              required
              style={{
                display: "block",
                width: "100%",
                padding: "0.75rem",
                marginBottom: "1rem",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                boxSizing: "border-box"
              }}
            />
            <button type="submit" disabled={actionLoading === "create"} className="cta">
              {actionLoading === "create" ? "Creating..." : "Create Key"}
            </button>
          </form>
        )}

        {newKeyMessage && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "1rem",
              borderRadius: "4px",
              backgroundColor: newKeyMessage.type === "success" ? "var(--mint)" : "var(--slate)",
              color: newKeyMessage.type === "success" ? "var(--ink)" : "white"
            }}
          >
            <p style={{ margin: "0 0 0.75rem 0" }}>{newKeyMessage.text}</p>
            {newKeyMessage.token && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "rgba(0,0,0,0.1)",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  wordBreak: "break-all",
                  marginBottom: "0.75rem"
                }}
              >
                {newKeyMessage.token}
              </div>
            )}
            <button
              onClick={() => setNewKeyMessage(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "0.9rem"
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {keys.length === 0 ? (
          <p style={{ color: "var(--slate)" }}>No API keys yet. Create one to get started.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.9rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600" }}>Created</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600" }}>Last Used</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem" }}>{key.name}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          backgroundColor: key.status === "active" ? "var(--mint)" : "var(--slate)",
                          color: key.status === "active" ? "var(--ink)" : "white"
                        }}
                      >
                        {key.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem", color: "var(--slate)", fontSize: "0.85rem" }}>
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.75rem", color: "var(--slate)", fontSize: "0.85rem" }}>
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                    </td>
                    <td style={{ padding: "0.75rem", textAlign: "right" }}>
                      <button
                        onClick={() => handleRotateKey(key.id)}
                        disabled={actionLoading === `rotate-${key.id}`}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--accent)",
                          textDecoration: "underline",
                          marginRight: "1rem",
                          opacity: actionLoading === `rotate-${key.id}` ? 0.5 : 1
                        }}
                      >
                        Rotate
                      </button>
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        disabled={actionLoading === key.id}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--slate)",
                          textDecoration: "underline",
                          opacity: actionLoading === key.id ? 0.5 : 1
                        }}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
