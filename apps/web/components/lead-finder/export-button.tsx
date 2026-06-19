"use client";
import { Button } from "@/components/ui/button";
export function ExportButton({ runId, leadIds }: { runId?: string; leadIds?: string[] }) { return <Button variant="secondary" onClick={() => { const params = new URLSearchParams(); if (runId) params.set("runId", runId); if (leadIds?.length) params.set("leadIds", leadIds.join(",")); window.location.href = `/api/admin/leads/export?${params.toString()}`; }}>Export CSV</Button>; }
