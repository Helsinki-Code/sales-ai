import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobFilters } from "@/components/jobs/job-filters";
export const dynamic = "force-dynamic";
async function getJobs(){ try{ const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return[]; const {workspaceId}=await getWorkspaceContext(user.id); const {data}=await supabase.from("jobs").select("id,status,endpoint,stage,progress,created_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(50); return data ?? []; }catch{return [];} }
export default async function JobsPage(){ const jobs=await getJobs(); return <main className="app-grid"><div><p className="eyebrow">Observability</p><h1 className="page-title">Jobs</h1><p className="muted">Timeline and status for async work.</p></div><JobFilters/><JobsTable jobs={jobs}/></main>; }
