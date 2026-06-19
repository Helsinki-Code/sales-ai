"use client";
const presets = [{ name: "B2B SaaS", industries: "B2B SaaS", personas: "VP Sales\nHead of RevOps", keywords: "Salesforce\nHubSpot\nAI SDR" }, { name: "Enterprise IT", industries: "Enterprise Software", personas: "CIO\nVP IT", keywords: "security\ncloud\ncompliance" }];
export function LeadFinderPresets({ onApply }: { onApply: (preset: any) => void }) { return <div className="pill-row">{presets.map((preset) => <button key={preset.name} type="button" className="ui-button ui-button-ghost" onClick={() => onApply(preset)}>{preset.name}</button>)}</div>; }
