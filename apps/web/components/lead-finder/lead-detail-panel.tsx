import { LeadScoreBreakdown } from "./lead-score-breakdown";
import { EvidenceList } from "./evidence-list";
export function LeadDetailPanel({ lead }: { lead?: any }) { if (!lead) return <div className="ui-card"><p className="muted">Select a lead to inspect evidence.</p></div>; return <div className="ui-card detail-panel"><h3>{lead.company?.name}</h3><p className="muted small">{lead.contact?.name} · {lead.contact?.title} · {lead.contact?.email}</p><LeadScoreBreakdown score={lead.score} /><EvidenceList evidence={lead.evidence} /></div>; }
