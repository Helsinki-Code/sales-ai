"use client";

interface ResultViewerProps {
  result: any;
}

export function ResultViewer({ result }: ResultViewerProps) {
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
            navigator.clipboard.writeText(JSON.stringify(result, null, 2));
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
          renderArray(data)
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
              <div style={{ fontFamily: "monospace" }}>{meta.model}</div>
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
