import Link from "next/link";
const items = [ ["Provider key configured", "/settings"], ["API key created", "/keys"], ["Billing active / units available", "/billing"], ["First lead finder run completed", "/lead-finder"] ];
export function OnboardingChecklist({ activeKeysCount }: { activeKeysCount: number }) { return <div className="ui-card"><h3>Setup checklist</h3>{items.map(([label, href], i) => <p key={label}><span className="ui-badge ui-badge-accent">{i === 1 && activeKeysCount > 0 ? "done" : "next"}</span> <Link href={href}>{label}</Link></p>)}</div>; }
