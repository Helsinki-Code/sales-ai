export function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "success" | "warning" | "danger";
}) {
  const accentColor =
    accent === "success" ? "var(--success)" :
    accent === "warning" ? "var(--warning)" :
    accent === "danger"  ? "var(--danger)"  : undefined;

  return (
    <div
      className="metric-card"
      style={accentColor ? { borderTopColor: accentColor, borderTopWidth: "2px" } : undefined}
    >
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {hint && <span className="metric-hint">{hint}</span>}
    </div>
  );
}
