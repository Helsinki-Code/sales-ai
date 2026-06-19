"use client";
import { LeadFinderForm } from "./lead-finder-form";
import { JobStatusCard } from "@/components/jobs/job-status-card";
import { JobTimeline } from "@/components/jobs/job-timeline";
import { LeadResultsTable } from "./lead-results-table";
import { useLeadFinderJob } from "@/hooks/use-lead-finder-job";
export function LeadFinderPage() { const { state, jobId, job, error, run } = useLeadFinderJob(); const leads = job?.result_payload ?? job?.result ?? []; return <main className="app-grid"><LeadFinderForm onSubmit={run} /><section className="lead-finder-grid"><div className="app-grid"><JobStatusCard state={state} jobId={jobId} />{error ? <div className="ui-card"><p className="ui-badge ui-badge-danger">{error}</p></div> : null}<JobTimeline job={job} /></div><LeadResultsTable leads={Array.isArray(leads) ? leads : []} /></section></main>; }
