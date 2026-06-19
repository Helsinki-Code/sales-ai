create table if not exists public.lead_finder_runs (
  id uuid primary key default gen_random_uuid(), job_id uuid not null unique references public.jobs(id) on delete cascade, org_id uuid not null references public.orgs(id) on delete cascade, workspace_id uuid not null references public.workspaces(id) on delete cascade, request_payload jsonb not null, status text not null, requested_count integer not null default 0, returned_count integer not null default 0, discovered_companies integer not null default 0, reviewed_companies integer not null default 0, accepted_leads integer not null default 0, estimated_cost_usd numeric(12,6) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.lead_finder_runs(id) on delete cascade, job_id uuid not null references public.jobs(id) on delete cascade, org_id uuid not null references public.orgs(id) on delete cascade, workspace_id uuid not null references public.workspaces(id) on delete cascade, company_name text not null, company_website text, company_domain text, contact_name text, contact_title text, contact_email text, email_confidence text not null default 'unknown', score integer not null, grade text not null, status text not null default 'new', result_payload jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_leads_workspace_created on public.leads(workspace_id, created_at desc);
create index if not exists idx_leads_workspace_score on public.leads(workspace_id, score desc);
create index if not exists idx_leads_company_domain on public.leads(workspace_id, company_domain);
alter table public.lead_finder_runs enable row level security;
alter table public.leads enable row level security;
drop policy if exists lead_finder_runs_workspace_members on public.lead_finder_runs;
create policy lead_finder_runs_workspace_members on public.lead_finder_runs for all using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
drop policy if exists leads_workspace_members on public.leads;
create policy leads_workspace_members on public.leads for all using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
