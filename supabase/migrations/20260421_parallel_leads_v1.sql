begin;

alter table public.usage_events
  add column if not exists parallel_api_calls integer not null default 0,
  add column if not exists parallel_enrichment_runs integer not null default 0,
  add column if not exists parallel_estimated_cost_usd numeric(12,6);

create table if not exists public.leads_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null,
  generator_used text,
  findall_run_ids text[] not null default '{}',
  task_run_ids text[] not null default '{}',
  retry_count integer not null default 0,
  parallel_api_calls integer not null default 0,
  matched_candidates integer not null default 0,
  deduped_candidates integer not null default 0,
  enriched_candidates integer not null default 0,
  filtered_candidates integer not null default 0,
  qualified_candidates integer not null default 0,
  evidence_coverage numeric(5,2),
  duration_ms integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leads_runs_updated_at on public.leads_runs;
create trigger trg_leads_runs_updated_at
before update on public.leads_runs
for each row execute function public.set_updated_at();

create index if not exists idx_leads_runs_workspace_created on public.leads_runs(workspace_id, created_at desc);
create index if not exists idx_leads_runs_org_created on public.leads_runs(org_id, created_at desc);
create index if not exists idx_leads_runs_status on public.leads_runs(status);

alter table public.leads_runs enable row level security;

drop policy if exists "members read leads runs" on public.leads_runs;
create policy "members read leads runs" on public.leads_runs
for select using (public.is_org_member(org_id));

drop policy if exists "admins manage leads runs" on public.leads_runs;
create policy "admins manage leads runs" on public.leads_runs
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

commit;

