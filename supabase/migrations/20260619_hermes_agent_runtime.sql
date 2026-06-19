-- Hermes Sales Agent Team runtime. This migration is additive so legacy jobs
-- continue to work while workspaces are rolled onto the Hermes execution path.

alter table public.workspace_model_policies
  add column if not exists default_provider public.provider_type not null default 'anthropic',
  add column if not exists allowed_providers public.provider_type[] not null default array['anthropic']::public.provider_type[];

update public.workspace_model_policies
set allowed_providers = array[default_provider]::public.provider_type[]
where cardinality(allowed_providers) = 0;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engine text not null default 'hermes',
  engine_version text not null,
  workflow text not null,
  provider public.provider_type not null,
  model text not null,
  status public.job_status not null default 'queued',
  input_payload jsonb not null,
  output_payload jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  tool_call_count integer not null default 0 check (tool_call_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  parent_task_id uuid references public.agent_tasks(id) on delete set null,
  role text not null,
  toolsets text[] not null default '{}',
  status public.job_status not null default 'queued',
  input_summary text,
  output_summary text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tool_calls (
  id bigserial primary key,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_task_id uuid references public.agent_tasks(id) on delete set null,
  tool_name text not null,
  status text not null check (status in ('started', 'complete', 'failed', 'blocked')),
  request_summary jsonb not null default '{}'::jsonb,
  response_summary jsonb not null default '{}'::jsonb,
  evidence_urls text[] not null default '{}',
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artifact_type text not null,
  payload jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_agent_memory (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_type text not null check (memory_type in ('icp', 'product_fact', 'brand_voice', 'playbook', 'account_knowledge')),
  content jsonb not null,
  source text not null,
  provenance jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  expires_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_workspace_created on public.agent_runs(workspace_id, created_at desc);
create index if not exists idx_agent_tasks_run_created on public.agent_tasks(agent_run_id, created_at);
create index if not exists idx_agent_tool_calls_run_created on public.agent_tool_calls(agent_run_id, created_at);
create index if not exists idx_agent_artifacts_workspace_created on public.agent_artifacts(workspace_id, created_at desc);
create index if not exists idx_workspace_agent_memory_active on public.workspace_agent_memory(workspace_id, memory_type, expires_at);

drop trigger if exists trg_agent_runs_updated_at on public.agent_runs;
create trigger trg_agent_runs_updated_at before update on public.agent_runs for each row execute function public.set_updated_at();
drop trigger if exists trg_agent_tasks_updated_at on public.agent_tasks;
create trigger trg_agent_tasks_updated_at before update on public.agent_tasks for each row execute function public.set_updated_at();
drop trigger if exists trg_workspace_agent_memory_updated_at on public.workspace_agent_memory;
create trigger trg_workspace_agent_memory_updated_at before update on public.workspace_agent_memory for each row execute function public.set_updated_at();

alter table public.agent_runs enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_artifacts enable row level security;
alter table public.workspace_agent_memory enable row level security;

create policy "agent runs workspace members" on public.agent_runs for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "agent tasks workspace members" on public.agent_tasks for select using (exists (select 1 from public.agent_runs r where r.id = agent_run_id and public.is_workspace_member(r.workspace_id)));
create policy "agent tool calls workspace members" on public.agent_tool_calls for select using (exists (select 1 from public.agent_runs r where r.id = agent_run_id and public.is_workspace_member(r.workspace_id)));
create policy "agent artifacts workspace members" on public.agent_artifacts for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "agent memory workspace members" on public.workspace_agent_memory for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
