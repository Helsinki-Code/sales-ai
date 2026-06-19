import { Card } from "@/components/ui/card";
export function LeadFinderPreview({ payload }: { payload: unknown }) { return <Card><h3>Request preview</h3><pre>{JSON.stringify(payload, null, 2)}</pre><p className="muted small">Estimated unit usage scales with accepted lead count and enrichment runs.</p></Card>; }
