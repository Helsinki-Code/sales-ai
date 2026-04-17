-- Sales AI Production Schema
-- Run in Supabase SQL Editor

begin;

create extension if not exists pgcrypto;

-- Enums
create type public.app_role as enum ('owner', 'admin', 'member');
create type public.member_status as enum ('active', 'invited', 'suspended');
create type public.api_key_status as enum ('active', 'revoked', 'expired');
create type public.job_status as enum ('queued', 'running', 'complete', 'failed', 'cancelled');
create type public.provider_type as enum ('anthropic');
create type public.environment_type as enum ('local', 'staging', 'production');
create type public.credential_status as enum ('active', 'inactive', 'revoked');
create type public.webhook_status as enum ('active', 'paused');
create type public.usage_status as enum ('success', 'failed');

-- Utility functions
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_created_at_change()
returns trigger
language plpgsql
as $$
begin
  if new.created_at <> old.created_at then
    raise exception 'created_at is immutable';
  end if;
  return new;
end;
$$;

-- Core tenancy tables
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  environment public.environment_type not null default 'production',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_orgs_updated_at
before update on public.orgs
for each row execute function public.set_updated_at();

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status public.member_status not null default 'active',
  invited_by uuid references auth.users(id),
  invited_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create trigger trg_org_members_updated_at
before update on public.org_members
for each row execute function public.set_updated_at();

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  default_org_id uuid references public.orgs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- RLS helper functions (must be created after tenancy tables)
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id = target_org
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.is_org_admin_or_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id = target_org
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    join public.org_members om on om.org_id = w.org_id
    where w.id = target_workspace
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

-- BYOK credentials and model policies
create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider public.provider_type not null,
  api_key_encrypted text not null,
  status public.credential_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create trigger trg_provider_credentials_updated_at
before update on public.provider_credentials
for each row execute function public.set_updated_at();

create table public.workspace_model_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  endpoint text not null,
  default_model text not null,
  allowed_models text[] not null,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, endpoint)
);

create trigger trg_workspace_model_policies_updated_at
before update on public.workspace_model_policies
for each row execute function public.set_updated_at();

-- API key system
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  status public.api_key_status not null default 'active',
  created_by uuid not null references auth.users(id),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_api_keys_updated_at
before update on public.api_keys
for each row execute function public.set_updated_at();

create table public.api_key_scopes (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  scope text not null,
  created_at timestamptz not null default now(),
  unique (api_key_id, scope)
);

-- Jobs and artifacts
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  endpoint text not null,
  status public.job_status not null,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  stage text,
  input_payload jsonb not null,
  result_payload jsonb,
  error_message text,
  request_id text,
  idempotency_key text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, endpoint, idempotency_key)
);

create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create table public.job_events (
  id bigserial primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stage text not null,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  artifact_type text not null,
  file_name text not null,
  mime_type text,
  storage_path text,
  content_base64 text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Usage and rollups
create table public.usage_events (
  id bigserial primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  endpoint text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  duration_ms integer not null default 0,
  status public.usage_status not null,
  cost_usd numeric(12,6),
  request_id text,
  created_at timestamptz not null default now()
);

create table public.usage_daily_rollups (
  id bigserial primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  usage_date date not null,
  endpoint text not null,
  model text not null,
  request_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric(14,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, usage_date, endpoint, model)
);

create trigger trg_usage_daily_rollups_updated_at
before update on public.usage_daily_rollups
for each row execute function public.set_updated_at();

create or replace function public.rollup_usage_daily()
returns trigger
language plpgsql
as $$
begin
  insert into public.usage_daily_rollups (
    org_id,
    workspace_id,
    usage_date,
    endpoint,
    model,
    request_count,
    success_count,
    failure_count,
    input_tokens,
    output_tokens,
    cost_usd
  )
  values (
    new.org_id,
    new.workspace_id,
    date(new.created_at),
    new.endpoint,
    new.model,
    1,
    case when new.status = 'success' then 1 else 0 end,
    case when new.status = 'failed' then 1 else 0 end,
    new.input_tokens,
    new.output_tokens,
    coalesce(new.cost_usd, 0)
  )
  on conflict (workspace_id, usage_date, endpoint, model)
  do update set
    request_count = public.usage_daily_rollups.request_count + 1,
    success_count = public.usage_daily_rollups.success_count + case when new.status = 'success' then 1 else 0 end,
    failure_count = public.usage_daily_rollups.failure_count + case when new.status = 'failed' then 1 else 0 end,
    input_tokens = public.usage_daily_rollups.input_tokens + new.input_tokens,
    output_tokens = public.usage_daily_rollups.output_tokens + new.output_tokens,
    cost_usd = public.usage_daily_rollups.cost_usd + coalesce(new.cost_usd, 0),
    updated_at = now();

  return new;
end;
$$;

create trigger trg_usage_events_rollup
after insert on public.usage_events
for each row execute function public.rollup_usage_daily();

-- Audit and webhooks
create table public.audit_logs (
  id bigserial primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_user_id uuid references auth.users(id),
  actor_api_key_id uuid references public.api_keys(id),
  action text not null,
  target_type text,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  secret_hash text not null,
  event_types text[] not null,
  status public.webhook_status not null default 'active',
  last_delivery_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_webhook_endpoints_updated_at
before update on public.webhook_endpoints
for each row execute function public.set_updated_at();

-- Immutability triggers
create trigger trg_orgs_immutable_created_at
before update on public.orgs
for each row execute function public.prevent_created_at_change();

create trigger trg_workspaces_immutable_created_at
before update on public.workspaces
for each row execute function public.prevent_created_at_change();

create trigger trg_api_keys_immutable_created_at
before update on public.api_keys
for each row execute function public.prevent_created_at_change();

-- Indexes
create index idx_org_members_user_org on public.org_members(user_id, org_id);
create index idx_workspaces_org on public.workspaces(org_id);
create index idx_provider_credentials_workspace_provider on public.provider_credentials(workspace_id, provider);
create index idx_model_policies_workspace_endpoint on public.workspace_model_policies(workspace_id, endpoint);
create index idx_api_keys_workspace_status on public.api_keys(workspace_id, status, created_at desc);
create index idx_api_keys_org_status on public.api_keys(org_id, status, created_at desc);
create index idx_jobs_workspace_status_created on public.jobs(workspace_id, status, created_at desc);
create index idx_jobs_api_key_created on public.jobs(api_key_id, created_at desc);
create index idx_jobs_request on public.jobs(request_id);
create index idx_job_events_job_created on public.job_events(job_id, created_at desc);
create index idx_artifacts_workspace_created on public.artifacts(workspace_id, created_at desc);
create index idx_usage_events_workspace_created on public.usage_events(workspace_id, created_at desc);
create index idx_usage_events_api_key_created on public.usage_events(api_key_id, created_at desc);
create index idx_usage_daily_rollups_workspace_date on public.usage_daily_rollups(workspace_id, usage_date desc);
create index idx_audit_logs_org_created on public.audit_logs(org_id, created_at desc);
create index idx_webhooks_workspace_status on public.webhook_endpoints(workspace_id, status);

-- Enable RLS
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.workspace_model_policies enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_key_scopes enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.artifacts enable row level security;
alter table public.usage_events enable row level security;
alter table public.usage_daily_rollups enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhook_endpoints enable row level security;

-- orgs
create policy "org members read orgs" on public.orgs
for select using (public.is_org_member(id));

create policy "owners/admins update orgs" on public.orgs
for update using (public.is_org_admin_or_owner(id));

-- org_members
create policy "org members read members" on public.org_members
for select using (public.is_org_member(org_id));

create policy "org admins manage members" on public.org_members
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

-- workspaces
create policy "org members read workspaces" on public.workspaces
for select using (public.is_org_member(org_id));

create policy "org admins manage workspaces" on public.workspaces
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

create policy "users read own profile" on public.profiles
for select using (auth.uid() = id);

create policy "users update own profile" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

-- provider_credentials
create policy "admins read provider creds" on public.provider_credentials
for select using (public.is_org_admin_or_owner(org_id));

create policy "admins manage provider creds" on public.provider_credentials
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

-- model policies
create policy "members read model policies" on public.workspace_model_policies
for select using (public.is_org_member(org_id));

create policy "admins manage model policies" on public.workspace_model_policies
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

-- api keys and scopes
create policy "admins read api keys" on public.api_keys
for select using (public.is_org_admin_or_owner(org_id));

create policy "admins manage api keys" on public.api_keys
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

create policy "admins read key scopes" on public.api_key_scopes
for select using (
  exists (
    select 1 from public.api_keys k
    where k.id = api_key_id
      and public.is_org_admin_or_owner(k.org_id)
  )
);

create policy "admins manage key scopes" on public.api_key_scopes
for all using (
  exists (
    select 1 from public.api_keys k
    where k.id = api_key_id
      and public.is_org_admin_or_owner(k.org_id)
  )
)
with check (
  exists (
    select 1 from public.api_keys k
    where k.id = api_key_id
      and public.is_org_admin_or_owner(k.org_id)
  )
);

-- jobs and events
create policy "members read jobs" on public.jobs
for select using (public.is_org_member(org_id));

create policy "admins manage jobs" on public.jobs
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

create policy "members read job events" on public.job_events
for select using (public.is_workspace_member(workspace_id));

create policy "admins manage job events" on public.job_events
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members read artifacts" on public.artifacts
for select using (public.is_org_member(org_id));

create policy "admins manage artifacts" on public.artifacts
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

-- usage
create policy "members read usage events" on public.usage_events
for select using (public.is_org_member(org_id));

create policy "admins manage usage events" on public.usage_events
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

create policy "members read usage rollups" on public.usage_daily_rollups
for select using (public.is_org_member(org_id));

create policy "admins manage usage rollups" on public.usage_daily_rollups
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

-- audit
create policy "admins read audit logs" on public.audit_logs
for select using (public.is_org_admin_or_owner(org_id));

create policy "admins write audit logs" on public.audit_logs
for insert with check (public.is_org_admin_or_owner(org_id));

-- webhooks
create policy "admins read webhooks" on public.webhook_endpoints
for select using (public.is_org_admin_or_owner(org_id));

create policy "admins manage webhooks" on public.webhook_endpoints
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

commit;
