"use client";

import { useState, useEffect } from "react";

interface UsageRow {
  usage_date: string;
  endpoint: string;
  model: string;
  request_count: number;
  success_count: number;
  failure_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    // Set default date range (last 30 days)
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);

    setFromDate(from.toISOString().split("T")[0]);
    setToDate(to.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchUsage();
    }
  }, [fromDate, toDate]);

  const fetchUsage = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/usage?from=${fromDate}&to=${toDate}`);
      const data = await res.json();
      if (res.ok) {
        setUsage(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch usage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRequests = usage.reduce((sum, row) => sum + row.request_count, 0);
  const totalTokens = usage.reduce((sum, row) => sum + row.input_tokens + row.output_tokens, 0);
  const totalCost = usage.reduce((sum, row) => sum + row.cost_usd, 0);
  const successRate = totalRequests > 0 ? ((usage.reduce((sum, row) => sum + row.success_count, 0) / totalRequests) * 100).toFixed(1) : "0";

  const byEndpoint = usage.reduce((acc, row) => {
    const key = row.endpoint;
    if (!acc[key]) acc[key] = 0;
    acc[key] += row.request_count;
    return acc;
  }, {} as Record<string, number>);

  const maxEndpointRequests = Math.max(...Object.values(byEndpoint), 1);

  return (
    <main>
      <h1 className="page-title">Usage & Analytics</h1>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
          <div>
            <label htmlFor="from-date" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
              From
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "4px" }}
            />
          </div>
          <div>
            <label htmlFor="to-date" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
              To
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "4px" }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: "2rem" }}>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Total Requests</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>{totalRequests}</p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Total Tokens</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>{totalTokens.toLocaleString()}</p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Total Cost</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>${totalCost.toFixed(2)}</p>
        </div>
      </div>

      {Object.keys(byEndpoint).length > 0 && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3>Requests by Endpoint</h3>
          <div style={{ display: "grid", gap: "1rem" }}>
            {Object.entries(byEndpoint)
              .sort(([, a], [, b]) => b - a)
              .map(([endpoint, count]) => (
                <div key={endpoint}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                    <span style={{ fontWeight: "500" }}>{endpoint}</span>
                    <span style={{ color: "var(--slate)" }}>{count}</span>
                  </div>
                  <div style={{ height: "8px", backgroundColor: "var(--panel)", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        backgroundColor: "var(--accent)",
                        width: `${(count / maxEndpointRequests) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card"><p>Loading usage data...</p></div>
      ) : usage.length > 0 ? (
        <div className="card">
          <h3>Detailed Usage</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600" }}>Endpoint</th>
                  <th style={{ textAlign: "left", padding: "0.75rem", fontWeight: "600" }}>Model</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Requests</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Success</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Input Tokens</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Output Tokens</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem" }}>{new Date(row.usage_date).toLocaleDateString()}</td>
                    <td style={{ padding: "0.75rem" }}>{row.endpoint}</td>
                    <td style={{ padding: "0.75rem", fontSize: "0.8rem", color: "var(--slate)" }}>{row.model}</td>
                    <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.request_count}</td>
                    <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--mint)" }}>{row.success_count}</td>
                    <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--slate)" }}>{row.input_tokens.toLocaleString()}</td>
                    <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--slate)" }}>{row.output_tokens.toLocaleString()}</td>
                    <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "500" }}>${row.cost_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card"><p style={{ color: "var(--slate)" }}>No usage data for this date range.</p></div>
      )}
    </main>
  );
}