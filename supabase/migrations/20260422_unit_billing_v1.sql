begin;

create table if not exists public.billing_plan_entitlements (
  plan_key text primary key,
  included_standard_units integer not null,
  included_lead_units integer not null,
  workspace_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (included_standard_units >= 0),
  check (included_lead_units >= 0),
  check (workspace_limit is null or workspace_limit > 0)
);

drop trigger if exists trg_billing_plan_entitlements_updated_at on public.billing_plan_entitlements;
create trigger trg_billing_plan_entitlements_updated_at
before update on public.billing_plan_entitlements
for each row execute function public.set_updated_at();

insert into public.billing_plan_entitlements (
  plan_key,
  included_standard_units,
  included_lead_units,
  workspace_limit
)
values
  ('starter', 2000, 500, 1),
  ('growth', 10000, 3000, 5),
  ('scale', 50000, 20000, null)
on conflict (plan_key)
do update set
  included_standard_units = excluded.included_standard_units,
  included_lead_units = excluded.included_lead_units,
  workspace_limit = excluded.workspace_limit,
  updated_at = now();

create table if not exists public.billing_unit_policies (
  endpoint text primary key,
  unit_class text not null check (unit_class in ('standard', 'lead')),
  meter_mode text not null check (meter_mode in ('per_request', 'per_result')),
  units integer not null check (units > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_billing_unit_policies_updated_at on public.billing_unit_policies;
create trigger trg_billing_unit_policies_updated_at
before update on public.billing_unit_policies
for each row execute function public.set_updated_at();

insert into public.billing_unit_policies (endpoint, unit_class, meter_mode, units)
values
  ('quick', 'standard', 'per_request', 1),
  ('research', 'standard', 'per_request', 1),
  ('qualify', 'standard', 'per_request', 1),
  ('contacts', 'standard', 'per_request', 1),
  ('outreach', 'standard', 'per_request', 1),
  ('followup', 'standard', 'per_request', 1),
  ('prep', 'standard', 'per_request', 1),
  ('proposal', 'standard', 'per_request', 1),
  ('objections', 'standard', 'per_request', 1),
  ('icp', 'standard', 'per_request', 1),
  ('competitors', 'standard', 'per_request', 1),
  ('prospect', 'standard', 'per_request', 5),
  ('report', 'standard', 'per_request', 5),
  ('report-pdf', 'standard', 'per_request', 5),
  ('leads', 'lead', 'per_result', 1)
on conflict (endpoint)
do update set
  unit_class = excluded.unit_class,
  meter_mode = excluded.meter_mode,
  units = excluded.units,
  updated_at = now();

alter table public.org_billing
  add column if not exists current_plan_key text,
  add column if not exists cycle_start_at timestamptz,
  add column if not exists cycle_end_at timestamptz,
  add column if not exists included_standard_units integer not null default 0,
  add column if not exists included_lead_units integer not null default 0,
  add column if not exists purchased_standard_units integer not null default 0,
  add column if not exists purchased_lead_units integer not null default 0,
  add column if not exists consumed_standard_units integer not null default 0,
  add column if not exists consumed_lead_units integer not null default 0;

alter table public.org_billing
  drop constraint if exists org_billing_non_negative_units;

alter table public.org_billing
  add constraint org_billing_non_negative_units check (
    included_standard_units >= 0
    and included_lead_units >= 0
    and purchased_standard_units >= 0
    and purchased_lead_units >= 0
    and consumed_standard_units >= 0
    and consumed_lead_units >= 0
  );

create table if not exists public.billing_unit_ledger (
  id bigserial primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  request_id text,
  endpoint text,
  event_type text not null check (event_type in ('included_grant', 'pack_purchase', 'consumption', 'reversal', 'cycle_reset')),
  units_standard integer not null default 0 check (units_standard >= 0),
  units_lead integer not null default 0 check (units_lead >= 0),
  unit_basis text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_billing_unit_ledger_idempotency
  on public.billing_unit_ledger(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_billing_unit_ledger_org_created
  on public.billing_unit_ledger(org_id, created_at desc);

create index if not exists idx_billing_unit_ledger_workspace_created
  on public.billing_unit_ledger(workspace_id, created_at desc);

alter table public.usage_events
  add column if not exists token_cost_usd numeric(12,6),
  add column if not exists managed_estimated_cost_usd numeric(12,6),
  add column if not exists total_cost_usd numeric(12,6),
  add column if not exists standard_units_consumed integer not null default 0,
  add column if not exists lead_units_consumed integer not null default 0;

alter table public.usage_daily_rollups
  add column if not exists token_cost_usd numeric(14,6) not null default 0,
  add column if not exists managed_estimated_cost_usd numeric(14,6) not null default 0,
  add column if not exists total_cost_usd numeric(14,6) not null default 0,
  add column if not exists parallel_api_calls bigint not null default 0,
  add column if not exists parallel_enrichment_runs bigint not null default 0,
  add column if not exists standard_units_consumed bigint not null default 0,
  add column if not exists lead_units_consumed bigint not null default 0;

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
    cost_usd,
    token_cost_usd,
    managed_estimated_cost_usd,
    total_cost_usd,
    parallel_api_calls,
    parallel_enrichment_runs,
    standard_units_consumed,
    lead_units_consumed
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
    coalesce(new.total_cost_usd, new.cost_usd, 0),
    coalesce(new.token_cost_usd, 0),
    coalesce(new.managed_estimated_cost_usd, 0),
    coalesce(new.total_cost_usd, new.cost_usd, 0),
    coalesce(new.parallel_api_calls, 0),
    coalesce(new.parallel_enrichment_runs, 0),
    coalesce(new.standard_units_consumed, 0),
    coalesce(new.lead_units_consumed, 0)
  )
  on conflict (workspace_id, usage_date, endpoint, model)
  do update set
    request_count = public.usage_daily_rollups.request_count + 1,
    success_count = public.usage_daily_rollups.success_count + case when new.status = 'success' then 1 else 0 end,
    failure_count = public.usage_daily_rollups.failure_count + case when new.status = 'failed' then 1 else 0 end,
    input_tokens = public.usage_daily_rollups.input_tokens + new.input_tokens,
    output_tokens = public.usage_daily_rollups.output_tokens + new.output_tokens,
    cost_usd = public.usage_daily_rollups.cost_usd + coalesce(new.total_cost_usd, new.cost_usd, 0),
    token_cost_usd = public.usage_daily_rollups.token_cost_usd + coalesce(new.token_cost_usd, 0),
    managed_estimated_cost_usd = public.usage_daily_rollups.managed_estimated_cost_usd + coalesce(new.managed_estimated_cost_usd, 0),
    total_cost_usd = public.usage_daily_rollups.total_cost_usd + coalesce(new.total_cost_usd, new.cost_usd, 0),
    parallel_api_calls = public.usage_daily_rollups.parallel_api_calls + coalesce(new.parallel_api_calls, 0),
    parallel_enrichment_runs = public.usage_daily_rollups.parallel_enrichment_runs + coalesce(new.parallel_enrichment_runs, 0),
    standard_units_consumed = public.usage_daily_rollups.standard_units_consumed + coalesce(new.standard_units_consumed, 0),
    lead_units_consumed = public.usage_daily_rollups.lead_units_consumed + coalesce(new.lead_units_consumed, 0),
    updated_at = now();

  return new;
end;
$$;

create or replace function public.get_remaining_billing_units(p_org_id uuid)
returns table (
  remaining_standard_units integer,
  remaining_lead_units integer,
  cycle_end_at timestamptz
)
language plpgsql
as $$
declare
  billing_row public.org_billing%rowtype;
begin
  select *
  into billing_row
  from public.org_billing
  where org_id = p_org_id;

  if not found then
    return query select 0::integer, 0::integer, null::timestamptz;
    return;
  end if;

  return query
  select
    greatest(coalesce(billing_row.included_standard_units, 0) + coalesce(billing_row.purchased_standard_units, 0) - coalesce(billing_row.consumed_standard_units, 0), 0)::integer,
    greatest(coalesce(billing_row.included_lead_units, 0) + coalesce(billing_row.purchased_lead_units, 0) - coalesce(billing_row.consumed_lead_units, 0), 0)::integer,
    billing_row.cycle_end_at;
end;
$$;

create or replace function public.consume_billing_units(
  p_org_id uuid,
  p_workspace_id uuid,
  p_api_key_id uuid,
  p_job_id uuid,
  p_request_id text,
  p_endpoint text,
  p_units_standard integer,
  p_units_lead integer,
  p_unit_basis text,
  p_idempotency_key text default null
)
returns table (
  remaining_standard_units integer,
  remaining_lead_units integer,
  cycle_end_at timestamptz
)
language plpgsql
as $$
declare
  billing_row public.org_billing%rowtype;
  prior_entry_id bigint;
begin
  if coalesce(p_units_standard, 0) < 0 or coalesce(p_units_lead, 0) < 0 then
    raise exception 'INVALID_UNIT_CONSUMPTION';
  end if;

  if p_idempotency_key is not null then
    select id into prior_entry_id
    from public.billing_unit_ledger
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return query
      select *
      from public.get_remaining_billing_units(p_org_id);
      return;
    end if;
  end if;

  select *
  into billing_row
  from public.org_billing
  where org_id = p_org_id
  for update;

  if not found then
    raise exception 'BILLING_ROW_NOT_FOUND';
  end if;

  if coalesce(p_units_standard, 0) > greatest(coalesce(billing_row.included_standard_units, 0) + coalesce(billing_row.purchased_standard_units, 0) - coalesce(billing_row.consumed_standard_units, 0), 0)
    or coalesce(p_units_lead, 0) > greatest(coalesce(billing_row.included_lead_units, 0) + coalesce(billing_row.purchased_lead_units, 0) - coalesce(billing_row.consumed_lead_units, 0), 0) then
    raise exception 'INSUFFICIENT_UNITS';
  end if;

  update public.org_billing
  set
    consumed_standard_units = coalesce(consumed_standard_units, 0) + coalesce(p_units_standard, 0),
    consumed_lead_units = coalesce(consumed_lead_units, 0) + coalesce(p_units_lead, 0),
    updated_at = now()
  where org_id = p_org_id;

  insert into public.billing_unit_ledger (
    org_id,
    workspace_id,
    api_key_id,
    job_id,
    request_id,
    endpoint,
    event_type,
    units_standard,
    units_lead,
    unit_basis,
    idempotency_key
  )
  values (
    p_org_id,
    p_workspace_id,
    p_api_key_id,
    p_job_id,
    p_request_id,
    p_endpoint,
    'consumption',
    coalesce(p_units_standard, 0),
    coalesce(p_units_lead, 0),
    p_unit_basis,
    p_idempotency_key
  );

  return query
  select *
  from public.get_remaining_billing_units(p_org_id);
end;
$$;

create or replace function public.reverse_billing_unit_consumption(
  p_org_id uuid,
  p_workspace_id uuid,
  p_api_key_id uuid,
  p_job_id uuid,
  p_request_id text,
  p_endpoint text,
  p_units_standard integer,
  p_units_lead integer,
  p_unit_basis text,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  prior_entry_id bigint;
begin
  if coalesce(p_units_standard, 0) < 0 or coalesce(p_units_lead, 0) < 0 then
    raise exception 'INVALID_UNIT_REVERSAL';
  end if;

  if p_idempotency_key is not null then
    select id into prior_entry_id
    from public.billing_unit_ledger
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return;
    end if;
  end if;

  update public.org_billing
  set
    consumed_standard_units = greatest(coalesce(consumed_standard_units, 0) - coalesce(p_units_standard, 0), 0),
    consumed_lead_units = greatest(coalesce(consumed_lead_units, 0) - coalesce(p_units_lead, 0), 0),
    updated_at = now()
  where org_id = p_org_id;

  insert into public.billing_unit_ledger (
    org_id,
    workspace_id,
    api_key_id,
    job_id,
    request_id,
    endpoint,
    event_type,
    units_standard,
    units_lead,
    unit_basis,
    idempotency_key,
    metadata
  )
  values (
    p_org_id,
    p_workspace_id,
    p_api_key_id,
    p_job_id,
    p_request_id,
    p_endpoint,
    'reversal',
    coalesce(p_units_standard, 0),
    coalesce(p_units_lead, 0),
    p_unit_basis,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.credit_billing_units(
  p_org_id uuid,
  p_workspace_id uuid,
  p_api_key_id uuid,
  p_request_id text,
  p_endpoint text,
  p_event_type text,
  p_units_standard integer,
  p_units_lead integer,
  p_unit_basis text,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  prior_entry_id bigint;
begin
  if p_event_type not in ('included_grant', 'pack_purchase') then
    raise exception 'INVALID_UNIT_CREDIT_EVENT';
  end if;

  if coalesce(p_units_standard, 0) < 0 or coalesce(p_units_lead, 0) < 0 then
    raise exception 'INVALID_UNIT_CREDIT';
  end if;

  if p_idempotency_key is not null then
    select id into prior_entry_id
    from public.billing_unit_ledger
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return;
    end if;
  end if;

  if p_event_type = 'included_grant' then
    update public.org_billing
    set
      included_standard_units = coalesce(included_standard_units, 0) + coalesce(p_units_standard, 0),
      included_lead_units = coalesce(included_lead_units, 0) + coalesce(p_units_lead, 0),
      updated_at = now()
    where org_id = p_org_id;
  else
    update public.org_billing
    set
      purchased_standard_units = coalesce(purchased_standard_units, 0) + coalesce(p_units_standard, 0),
      purchased_lead_units = coalesce(purchased_lead_units, 0) + coalesce(p_units_lead, 0),
      updated_at = now()
    where org_id = p_org_id;
  end if;

  insert into public.billing_unit_ledger (
    org_id,
    workspace_id,
    api_key_id,
    request_id,
    endpoint,
    event_type,
    units_standard,
    units_lead,
    unit_basis,
    idempotency_key,
    metadata
  )
  values (
    p_org_id,
    p_workspace_id,
    p_api_key_id,
    p_request_id,
    p_endpoint,
    p_event_type,
    coalesce(p_units_standard, 0),
    coalesce(p_units_lead, 0),
    p_unit_basis,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.reset_billing_cycle_units(
  p_org_id uuid,
  p_plan_key text,
  p_cycle_start_at timestamptz,
  p_cycle_end_at timestamptz,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  entitlement_row public.billing_plan_entitlements%rowtype;
  prior_entry_id bigint;
  base_metadata jsonb;
begin
  if p_idempotency_key is not null then
    select id into prior_entry_id
    from public.billing_unit_ledger
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return;
    end if;
  end if;

  select *
  into entitlement_row
  from public.billing_plan_entitlements
  where plan_key = p_plan_key;

  if not found then
    raise exception 'UNKNOWN_PLAN_ENTITLEMENT';
  end if;

  update public.org_billing
  set
    current_plan_key = p_plan_key,
    cycle_start_at = p_cycle_start_at,
    cycle_end_at = p_cycle_end_at,
    included_standard_units = entitlement_row.included_standard_units,
    included_lead_units = entitlement_row.included_lead_units,
    purchased_standard_units = 0,
    purchased_lead_units = 0,
    consumed_standard_units = 0,
    consumed_lead_units = 0,
    updated_at = now()
  where org_id = p_org_id;

  base_metadata := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'plan_key', p_plan_key,
    'cycle_start_at', p_cycle_start_at,
    'cycle_end_at', p_cycle_end_at
  );

  insert into public.billing_unit_ledger (
    org_id,
    event_type,
    units_standard,
    units_lead,
    unit_basis,
    idempotency_key,
    metadata
  )
  values (
    p_org_id,
    'cycle_reset',
    0,
    0,
    p_plan_key,
    p_idempotency_key,
    base_metadata
  );

  insert into public.billing_unit_ledger (
    org_id,
    event_type,
    units_standard,
    units_lead,
    unit_basis,
    idempotency_key,
    metadata
  )
  values (
    p_org_id,
    'included_grant',
    entitlement_row.included_standard_units,
    entitlement_row.included_lead_units,
    p_plan_key,
    case when p_idempotency_key is null then null else p_idempotency_key || ':grant' end,
    base_metadata
  );
end;
$$;

create or replace function public.enforce_workspace_plan_limit()
returns trigger
language plpgsql
as $$
declare
  plan_key text;
  max_workspaces integer;
  current_count integer;
begin
  select current_plan_key into plan_key
  from public.org_billing
  where org_id = new.org_id;

  if plan_key is null then
    return new;
  end if;

  select workspace_limit into max_workspaces
  from public.billing_plan_entitlements
  where billing_plan_entitlements.plan_key = plan_key;

  if max_workspaces is null then
    return new;
  end if;

  select count(*)::integer into current_count
  from public.workspaces
  where org_id = new.org_id;

  if current_count >= max_workspaces then
    raise exception 'WORKSPACE_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_workspaces_plan_limit on public.workspaces;
create trigger trg_workspaces_plan_limit
before insert on public.workspaces
for each row execute function public.enforce_workspace_plan_limit();

alter table public.billing_unit_ledger enable row level security;

drop policy if exists "members read billing unit ledger" on public.billing_unit_ledger;
create policy "members read billing unit ledger" on public.billing_unit_ledger
for select using (public.is_org_member(org_id));

drop policy if exists "admins manage billing unit ledger" on public.billing_unit_ledger;
create policy "admins manage billing unit ledger" on public.billing_unit_ledger
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

commit;
