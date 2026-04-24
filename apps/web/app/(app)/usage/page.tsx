"use client";

import { useEffect, useState } from "react";

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
  token_cost_usd: number;
  managed_estimated_cost_usd: number;
  total_cost_usd: number;
  managed_crawler_runs: number;
  managed_pages_crawled: number;
  managed_verification_runs: number;
  managed_cycle_count: number;
  standard_units_consumed: number;
  lead_units_consumed: number;
}

interface UnitWallet {
  current_plan_key: string | null;
  cycle_start_at: string | null;
  cycle_end_at: string | null;
  included_standard_units: number;
  included_lead_units: number;
  purchased_standard_units: number;
  purchased_lead_units: number;
  consumed_standard_units: number;
  consumed_lead_units: number;
}

interface UsageApiResponse {
  success: boolean;
  data?: UsageRow[];
  units?: UnitWallet;
}

type UnitClassFilter = "all" | "standard" | "lead";

function sanitizeModelLabel(model: string): string {
  return model.replace(/parallel/gi, "managed");
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function isManagedRow(row: UsageRow): boolean {
  return row.endpoint === "leads" || sanitizeModelLabel(row.model).toLowerCase().includes("managed");
}

function buildTrendPoints(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 100 - (value / max) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [units, setUnits] = useState<UnitWallet>({
    current_plan_key: null,
    cycle_start_at: null,
    cycle_end_at: null,
    included_standard_units: 0,
    included_lead_units: 0,
    purchased_standard_units: 0,
    purchased_lead_units: 0,
    consumed_standard_units: 0,
    consumed_lead_units: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [unitClassFilter, setUnitClassFilter] = useState<UnitClassFilter>("all");

  useEffect(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    setFromDate(from.toISOString().split("T")[0] ?? "");
    setToDate(to.toISOString().split("T")[0] ?? "");
  }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      void fetchUsage();
    }
  }, [fromDate, toDate]);

  const fetchUsage = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/usage?from=${fromDate}&to=${toDate}`);
      const payload = (await res.json()) as UsageApiResponse;
      if (res.ok && payload.success) {
        const rows = (payload.data ?? []).map((row) => ({
          ...row,
          request_count: toNumber(row.request_count),
          success_count: toNumber(row.success_count),
          failure_count: toNumber(row.failure_count),
          input_tokens: toNumber(row.input_tokens),
          output_tokens: toNumber(row.output_tokens),
          cost_usd: toNumber(row.cost_usd),
          token_cost_usd: toNumber(row.token_cost_usd),
          managed_estimated_cost_usd: toNumber(row.managed_estimated_cost_usd),
          total_cost_usd: toNumber(row.total_cost_usd || row.cost_usd),
          managed_crawler_runs: toNumber((row as { managed_crawler_runs?: unknown }).managed_crawler_runs),
          managed_pages_crawled: toNumber((row as { managed_pages_crawled?: unknown }).managed_pages_crawled),
          managed_verification_runs: toNumber(
            (row as { managed_verification_runs?: unknown }).managed_verification_runs
          ),
          managed_cycle_count: toNumber((row as { managed_cycle_count?: unknown }).managed_cycle_count),
          standard_units_consumed: toNumber(row.standard_units_consumed),
          lead_units_consumed: toNumber(row.lead_units_consumed)
        }));
        setUsage(rows);

        if (payload.units) {
          setUnits({
            ...payload.units,
            included_standard_units: toNumber(payload.units.included_standard_units),
            included_lead_units: toNumber(payload.units.included_lead_units),
            purchased_standard_units: toNumber(payload.units.purchased_standard_units),
            purchased_lead_units: toNumber(payload.units.purchased_lead_units),
            consumed_standard_units: toNumber(payload.units.consumed_standard_units),
            consumed_lead_units: toNumber(payload.units.consumed_lead_units)
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch usage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsage = usage.filter((row) => {
    if (endpointFilter !== "all" && row.endpoint !== endpointFilter) return false;
    if (modelFilter !== "all" && sanitizeModelLabel(row.model) !== modelFilter) return false;
    if (unitClassFilter === "standard" && row.standard_units_consumed <= 0) return false;
    if (unitClassFilter === "lead" && row.lead_units_consumed <= 0) return false;
    return true;
  });

  const totalRequests = filteredUsage.reduce((sum, row) => sum + row.request_count, 0);
  const totalTokens = filteredUsage.reduce((sum, row) => sum + row.input_tokens + row.output_tokens, 0);
  const tokenCost = filteredUsage.reduce((sum, row) => sum + row.token_cost_usd, 0);
  const managedCost = filteredUsage.reduce((sum, row) => sum + row.managed_estimated_cost_usd, 0);
  const totalCost = filteredUsage.reduce((sum, row) => sum + row.total_cost_usd, 0);
  const successRate =
    totalRequests > 0
      ? ((filteredUsage.reduce((sum, row) => sum + row.success_count, 0) / totalRequests) * 100).toFixed(1)
      : "0";

  const byEndpoint = filteredUsage.reduce((acc, row) => {
    acc[row.endpoint] = (acc[row.endpoint] ?? 0) + row.request_count;
    return acc;
  }, {} as Record<string, number>);
  const maxEndpointRequests = Math.max(...Object.values(byEndpoint), 1);

  const endpointOptions = Array.from(new Set(usage.map((row) => row.endpoint))).sort();
  const modelOptions = Array.from(new Set(usage.map((row) => sanitizeModelLabel(row.model)))).sort();

  const standardRemaining = Math.max(
    units.included_standard_units + units.purchased_standard_units - units.consumed_standard_units,
    0
  );
  const leadRemaining = Math.max(units.included_lead_units + units.purchased_lead_units - units.consumed_lead_units, 0);

  const trendByDate = new Map<string, { requests: number; totalCost: number }>();
  filteredUsage.forEach((row) => {
    const current = trendByDate.get(row.usage_date) ?? { requests: 0, totalCost: 0 };
    current.requests += row.request_count;
    current.totalCost += row.total_cost_usd;
    trendByDate.set(row.usage_date, current);
  });
  const trendDates = Array.from(trendByDate.keys()).sort();
  const requestTrendPoints = buildTrendPoints(trendDates.map((key) => trendByDate.get(key)?.requests ?? 0));
  const costTrendPoints = buildTrendPoints(trendDates.map((key) => trendByDate.get(key)?.totalCost ?? 0));

  return (
    <main>
      <h1 className="page-title">Usage & Analytics</h1>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
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
          <div>
            <label htmlFor="endpoint-filter" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
              Endpoint
            </label>
            <select
              id="endpoint-filter"
              value={endpointFilter}
              onChange={(e) => setEndpointFilter(e.target.value)}
              style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "4px" }}
            >
              <option value="all">All</option>
              {endpointOptions.map((endpoint) => (
                <option key={endpoint} value={endpoint}>
                  {endpoint}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="model-filter" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
              Model
            </label>
            <select
              id="model-filter"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "4px" }}
            >
              <option value="all">All</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="unit-filter" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", fontSize: "0.9rem" }}>
              Unit Class
            </label>
            <select
              id="unit-filter"
              value={unitClassFilter}
              onChange={(e) => setUnitClassFilter(e.target.value as UnitClassFilter)}
              style={{ padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "4px" }}
            >
              <option value="all">All</option>
              <option value="standard">Standard</option>
              <option value="lead">Lead</option>
            </select>
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
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Success Rate</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>{successRate}%</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: "2rem" }}>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>AI Token Cost</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>{formatCurrency(tokenCost)}</p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Managed Discovery Cost (Estimated)</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>{formatCurrency(managedCost)}</p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Total Platform Meter Cost</p>
          <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>{formatCurrency(totalCost)}</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: "2rem" }}>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Standard Units</p>
          <p style={{ margin: "0.6rem 0 0", fontWeight: "600" }}>
            {units.consumed_standard_units.toLocaleString()} used / {standardRemaining.toLocaleString()} remaining
          </p>
          <p style={{ color: "var(--slate)", margin: "0.25rem 0 0", fontSize: "0.86rem" }}>
            Included {units.included_standard_units.toLocaleString()} + Purchased {units.purchased_standard_units.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Lead Units</p>
          <p style={{ margin: "0.6rem 0 0", fontWeight: "600" }}>
            {units.consumed_lead_units.toLocaleString()} used / {leadRemaining.toLocaleString()} remaining
          </p>
          <p style={{ color: "var(--slate)", margin: "0.25rem 0 0", fontSize: "0.86rem" }}>
            Included {units.included_lead_units.toLocaleString()} + Purchased {units.purchased_lead_units.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p style={{ color: "var(--slate)", margin: 0, fontSize: "0.9rem" }}>Cycle</p>
          <p style={{ margin: "0.6rem 0 0", fontWeight: "600" }}>{units.current_plan_key ?? "not_set"}</p>
          <p style={{ color: "var(--slate)", margin: "0.25rem 0 0", fontSize: "0.86rem" }}>
            {units.cycle_start_at ? new Date(units.cycle_start_at).toLocaleDateString() : "-"} {"-> "}
            {units.cycle_end_at ? new Date(units.cycle_end_at).toLocaleDateString() : "-"}
          </p>
        </div>
      </div>

      {trendDates.length > 0 ? (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3>Daily Trend</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <p style={{ marginTop: 0, color: "var(--slate)", fontSize: "0.85rem" }}>Requests per day</p>
              <svg viewBox="0 0 100 100" style={{ width: "100%", height: 120, background: "var(--panel)", borderRadius: 8 }}>
                {requestTrendPoints ? (
                  <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={requestTrendPoints} />
                ) : null}
              </svg>
            </div>
            <div>
              <p style={{ marginTop: 0, color: "var(--slate)", fontSize: "0.85rem" }}>Total cost per day</p>
              <svg viewBox="0 0 100 100" style={{ width: "100%", height: 120, background: "var(--panel)", borderRadius: 8 }}>
                {costTrendPoints ? (
                  <polyline fill="none" stroke="#0ea5e9" strokeWidth="2" points={costTrendPoints} />
                ) : null}
              </svg>
            </div>
          </div>
        </div>
      ) : null}

      {Object.keys(byEndpoint).length > 0 ? (
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
      ) : null}

      {isLoading ? (
        <div className="card">
          <p>Loading usage data...</p>
        </div>
      ) : filteredUsage.length > 0 ? (
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
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Token Cost</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Managed Cost (Est.)</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Total Cost</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Std Units</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Lead Units</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Crawler Runs</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Pages Crawled</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Verification Runs</th>
                  <th style={{ textAlign: "right", padding: "0.75rem", fontWeight: "600" }}>Cycles</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsage.map((row, index) => {
                  const managed = isManagedRow(row);
                  return (
                    <tr key={`${row.usage_date}-${row.endpoint}-${row.model}-${index}`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.75rem" }}>{new Date(row.usage_date).toLocaleDateString()}</td>
                      <td style={{ padding: "0.75rem" }}>{row.endpoint}</td>
                      <td style={{ padding: "0.75rem", fontSize: "0.8rem", color: "var(--slate)" }}>
                        {sanitizeModelLabel(row.model)}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.request_count}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--mint)" }}>{row.success_count}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--slate)" }}>
                        {managed && row.input_tokens === 0 ? "N/A" : row.input_tokens.toLocaleString()}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", color: "var(--slate)" }}>
                        {managed && row.output_tokens === 0 ? "N/A" : row.output_tokens.toLocaleString()}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "500" }}>${row.token_cost_usd.toFixed(4)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "500" }}>${row.managed_estimated_cost_usd.toFixed(4)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>${row.total_cost_usd.toFixed(4)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.standard_units_consumed}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.lead_units_consumed}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.managed_crawler_runs}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.managed_pages_crawled}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.managed_verification_runs}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{row.managed_cycle_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <p style={{ color: "var(--slate)" }}>No usage data for this date range.</p>
        </div>
      )}
    </main>
  );
}
