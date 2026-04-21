"use client";

interface ResultViewerProps {
  result: any;
}

export function ResultViewer({ result }: ResultViewerProps) {
  const sanitizeProviderText = (value: string): string => value.replace(/parallel/gi, "managed");

  const sanitizeForDisplay = (input: any): any => {
    if (typeof input === "string") return sanitizeProviderText(input);
    if (Array.isArray(input)) return input.map((item) => sanitizeForDisplay(item));
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input).map(([key, value]) => {
          if (key === "source_provider" && typeof value === "string") {
            return [key, "managed"];
          }
          return [key, sanitizeForDisplay(value)];
        })
      );
    }
    return input;
  };

  const hasWrappedData =
    result && typeof result === "object" && !Array.isArray(result) && Object.prototype.hasOwnProperty.call(result, "data");
  const data = hasWrappedData ? result.data : result;
  const meta = hasWrappedData ? result.meta : undefined;

  const formatValue = (value: any): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toLocaleString();
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return `${value.length} items`;
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const isJson = typeof data === "object" && data !== null;
  const isArray = Array.isArray(data);
  const isLeadsV2Array =
    isArray &&
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    Object.prototype.hasOwnProperty.call(data[0], "source_provider") &&
    Object.prototype.hasOwnProperty.call(data[0], "score_breakdown");

  const renderSignalChip = (label: string, active: boolean) => (
    <span
      style={{
        fontSize: "0.72rem",
        padding: "0.2rem 0.45rem",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        backgroundColor: active ? "var(--panel)" : "transparent",
        color: active ? "var(--ink)" : "var(--slate)"
      }}
    >
      {label}
    </span>
  );

  const renderLeadsCards = (items: any[]) => {
    return (
      <div style={{ display: "grid", gap: "0.85rem" }}>
        {items.map((item, index) => (
          <div
            key={`${item.company_name}-${index}`}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "0.85rem",
              backgroundColor: "var(--panel)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{item.company_name || "Unknown company"}</div>
                <div style={{ color: "var(--slate)", fontSize: "0.78rem", marginTop: "0.2rem" }}>
                  {item.contact_name || "Unknown contact"} {item.contact_title ? `- ${item.contact_title}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{item.score ?? 0}/100</div>
                <div style={{ fontSize: "0.72rem", color: "var(--slate)" }}>
                  {item.score >= 80 ? "Grade A" : item.score >= 60 ? "Grade B" : item.score >= 40 ? "Grade C" : "Grade D"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "0.65rem", fontSize: "0.78rem", color: "var(--slate)" }}>{item.fit_reason}</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.65rem" }}>
              {renderSignalChip("Funding", Boolean(item.recent_funding_flag))}
              {renderSignalChip("Hiring", Boolean(item.recent_hiring_flag))}
              {renderSignalChip("Tech Match", Boolean(item.tech_stack_match_flag))}
              {renderSignalChip("Growth", Boolean(item.growth_signal_flag))}
              {renderSignalChip(`Citations ${item.evidence?.citationsCount ?? 0}`, true)}
            </div>

            <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--slate)" }}>
              Source: Managed Engine | Run: {item.source_run_id} | Confidence: {item.enrichment_confidence}
            </div>
            {item.score_breakdown ? (
              <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "var(--slate)", lineHeight: 1.5 }}>
                ICP {item.score_breakdown.icp_fit?.score ?? 0} | Hiring {item.score_breakdown.hiring_signal?.score ?? 0} |
                Funding {item.score_breakdown.funding_signal?.score ?? 0} | Tech {item.score_breakdown.tech_stack_match?.score ?? 0} |
                Growth {item.score_breakdown.growth_signal?.score ?? 0}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const renderArray = (items: any[]) => {
    if (items.length === 0) return <p style={{ margin: 0 }}>No items returned.</p>;

    return (
      <div style={{ fontSize: "0.85rem", display: "grid", gap: "0.75rem" }}>
        {items.map((item, index) => {
          const title =
            typeof item === "object" && item
              ? item.company_name || item.name || item.contact_name || `Item ${index + 1}`
              : `Item ${index + 1}`;

          return (
            <div key={index} style={{ padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "8px" }}>
              <div style={{ fontWeight: "700", marginBottom: "0.5rem" }}>{title}</div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  lineHeight: "1.5",
                  color: "var(--slate)"
                }}
              >
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>Result</h3>
        <button
          onClick={() => {
            const safeCopy = sanitizeForDisplay(result);
            navigator.clipboard.writeText(JSON.stringify(safeCopy, null, 2));
            alert("Copied to clipboard!");
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--accent)",
            textDecoration: "underline",
            fontSize: "0.9rem"
          }}
        >
          Copy JSON
        </button>
      </div>

      {/* Main Result */}
      <div style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "var(--panel)", borderRadius: "4px" }}>
        <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--slate)" }}>
          {isArray ? `Results (${data.length})` : "Analysis"}
        </h4>
        {typeof data === "string" ? (
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              fontSize: "0.85rem",
              fontFamily: "monospace",
              lineHeight: "1.6"
            }}
          >
            {data}
          </pre>
        ) : isArray ? (
          isLeadsV2Array ? renderLeadsCards(data) : renderArray(data)
        ) : isJson ? (
          <div style={{ fontSize: "0.85rem" }}>
            {Object.entries(data).map(([key, value]) => (
              <div key={key} style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: "600", color: "var(--ink)", marginBottom: "0.25rem" }}>{key}</div>
                <div
                  style={{
                    color: "var(--slate)",
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    fontFamily: "monospace"
                  }}
                >
                  {typeof value === "object" ? JSON.stringify(value, null, 2) : formatValue(value)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0 }}>{formatValue(data)}</p>
        )}
      </div>

      {/* Metadata */}
      {meta && (
        <div style={{ padding: "1rem", backgroundColor: "var(--panel)", borderRadius: "4px" }}>
          <h4 style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--slate)" }}>Usage & Performance</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.85rem" }}>
            <div>
              <div style={{ color: "var(--slate)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Model</div>
              <div style={{ fontFamily: "monospace" }}>
                {typeof meta.model === "string" ? sanitizeProviderText(meta.model) : meta.model}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--slate)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Duration</div>
              <div>{meta.durationMs}ms</div>
            </div>
            <div>
              <div style={{ color: "var(--slate)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Input Tokens</div>
              <div>{meta.tokensUsed?.inputTokens?.toLocaleString() || "0"}</div>
            </div>
            <div>
              <div style={{ color: "var(--slate)", fontSize: "0.8rem", marginBottom: "0.25rem" }}>Output Tokens</div>
              <div>{meta.tokensUsed?.outputTokens?.toLocaleString() || "0"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
