import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadActions } from "@/components/leads/lead-actions";
export const dynamic = "force-dynamic";
async function getLeads(){ try{ const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return[]; const {workspaceId}=await getWorkspaceContext(user.id); const {data}=await supabase.from("leads").select("id,company_name,contact_name,contact_title,contact_email,email_confidence,score,grade,status,created_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(100); return data ?? []; }catch{return [];} }
export default async function LeadsPage(){ const leads=await getLeads(); return <main className="app-grid"><div><p className="eyebrow">CRM-lite</p><h1 className="page-title">Leads</h1><p className="muted">Saved and generated leads across lead finder runs.</p></div><LeadActions/><LeadsFilters/><LeadsTable leads={leads}/></main>; }
