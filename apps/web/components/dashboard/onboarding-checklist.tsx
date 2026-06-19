import Link from "next/link";

const steps: Array<{ label: string; href: string; hint: string }> = [
  { label: "Configure provider key",        href: "/settings", hint: "Add your Anthropic API key" },
  { label: "Create an API key",             href: "/keys",     hint: "Generate your first workspace key" },
  { label: "Activate billing",              href: "/billing",  hint: "Start your 7-day free trial" },
  { label: "Run your first lead finder job", href: "/lead-finder", hint: "Discover and score leads" },
];

export function OnboardingChecklist({ activeKeysCount }: { activeKeysCount: number }) {
  const completedSteps = activeKeysCount > 0 ? 1 : 0;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="ui-card">
      <div className="ui-card-header">
        <span className="ui-card-title">Setup checklist</span>
        <span className="badge badge-accent">{completedSteps}/{steps.length}</span>
      </div>

      <div className="progress-bar" style={{ marginBottom: "1.25rem" }}>
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="onboarding-steps">
        {steps.map((step, i) => {
          const done = i === 1 && activeKeysCount > 0;
          return (
            <Link key={step.href} href={step.href} className="onboarding-step">
              <span className={`step-circle ${done ? "done" : ""}`}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  String(i + 1)
                )}
              </span>
              <div style={{ display: "grid", gap: "0.1rem" }}>
                <span className="step-label" style={done ? { textDecoration: "line-through", opacity: 0.5 } : undefined}>
                  {step.label}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{step.hint}</span>
              </div>
              <span className="step-arrow" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
