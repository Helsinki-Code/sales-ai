begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'provider_type' and e.enumlabel = 'openai'
  ) then
    alter type public.provider_type add value 'openai';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'provider_type' and e.enumlabel = 'gemini'
  ) then
    alter type public.provider_type add value 'gemini';
  end if;
end
$$;

alter table public.workspace_model_policies
  add column if not exists default_provider public.provider_type not null default 'anthropic',
  add column if not exists allowed_providers public.provider_type[] not null default array['anthropic']::public.provider_type[];

update public.workspace_model_policies
set
  default_provider = coalesce(default_provider, 'anthropic'::public.provider_type),
  allowed_providers = case
    when allowed_providers is null or cardinality(allowed_providers) = 0
      then array[coalesce(default_provider, 'anthropic'::public.provider_type)]
    when not (coalesce(default_provider, 'anthropic'::public.provider_type) = any(allowed_providers))
      then array_append(allowed_providers, coalesce(default_provider, 'anthropic'::public.provider_type))
    else allowed_providers
  end;

alter table public.usage_events
  add column if not exists managed_crawler_runs integer not null default 0,
  add column if not exists managed_pages_crawled integer not null default 0,
  add column if not exists managed_verification_runs integer not null default 0,
  add column if not exists managed_cycle_count integer not null default 0;

alter table public.usage_daily_rollups
  add column if not exists managed_crawler_runs bigint not null default 0,
  add column if not exists managed_pages_crawled bigint not null default 0,
  add column if not exists managed_verification_runs bigint not null default 0,
  add column if not exists managed_cycle_count bigint not null default 0;

alter table public.leads_runs
  add column if not exists cycle_index integer not null default 0,
  add column if not exists accepted_so_far integer not null default 0,
  add column if not exists missing_count integer not null default 0,
  add column if not exists rejected_count integer not null default 0,
  add column if not exists enriched_count integer not null default 0,
  add column if not exists crawler_runs integer not null default 0,
  add column if not exists pages_crawled integer not null default 0,
  add column if not exists verification_runs integer not null default 0,
  add column if not exists cycle_diagnostics jsonb not null default '{}'::jsonb;

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
    managed_crawler_runs,
    managed_pages_crawled,
    managed_verification_runs,
    managed_cycle_count,
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
    coalesce(new.managed_crawler_runs, new.parallel_api_calls, 0),
    coalesce(new.managed_pages_crawled, 0),
    coalesce(new.managed_verification_runs, new.parallel_enrichment_runs, 0),
    coalesce(new.managed_cycle_count, 0),
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
    managed_crawler_runs = public.usage_daily_rollups.managed_crawler_runs + coalesce(new.managed_crawler_runs, new.parallel_api_calls, 0),
    managed_pages_crawled = public.usage_daily_rollups.managed_pages_crawled + coalesce(new.managed_pages_crawled, 0),
    managed_verification_runs = public.usage_daily_rollups.managed_verification_runs + coalesce(new.managed_verification_runs, new.parallel_enrichment_runs, 0),
    managed_cycle_count = public.usage_daily_rollups.managed_cycle_count + coalesce(new.managed_cycle_count, 0),
    standard_units_consumed = public.usage_daily_rollups.standard_units_consumed + coalesce(new.standard_units_consumed, 0),
    lead_units_consumed = public.usage_daily_rollups.lead_units_consumed + coalesce(new.lead_units_consumed, 0),
    updated_at = now();

  return new;
end;
$$;

commit;
