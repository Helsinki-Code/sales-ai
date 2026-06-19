import Link from "next/link";

const items: Array<{ label: string; href: string }> = [
  { label: "Provider key configured", href: "/settings" },
  { label: "API key created", href: "/keys" },
  { label: "Billing active / units available", href: "/billing" },
  { label: "First lead finder run completed", href: "/lead-finder" }
];

export function OnboardingChecklist({ activeKeysCount }: { activeKeysCount: number }) {
  return (
    <div className="ui-card">
      <h3>Setup checklist</h3>
      {items.map((item, i) => (
        <p key={item.label}>
          <span className="ui-badge ui-badge-accent">{i === 1 && activeKeysCount > 0 ? "done" : "next"}</span>{" "}
          <Link href={item.href}>{item.label}</Link>
        </p>
      ))}
    </div>
  );
}
