begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'billing_status'
  ) then
    create type public.billing_status as enum (
      'not_started',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    );
  end if;
end $$;

create table if not exists public.org_billing (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  billing_status public.billing_status not null default 'not_started',
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_org_billing_updated_at on public.org_billing;
create trigger trg_org_billing_updated_at
before update on public.org_billing
for each row execute function public.set_updated_at();

create table if not exists public.billing_webhook_events (
  id bigserial primary key,
  event_id text not null unique,
  event_type text not null,
  org_id uuid references public.orgs(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_org_billing_status on public.org_billing(org_id, billing_status);
create index if not exists idx_org_billing_customer on public.org_billing(stripe_customer_id);
create index if not exists idx_org_billing_subscription on public.org_billing(stripe_subscription_id);
create index if not exists idx_billing_webhook_events_org_created on public.billing_webhook_events(org_id, created_at desc);
create index if not exists idx_billing_webhook_events_subscription on public.billing_webhook_events(stripe_subscription_id);

alter table public.org_billing enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists "members read org billing" on public.org_billing;
create policy "members read org billing" on public.org_billing
for select using (public.is_org_member(org_id));

drop policy if exists "admins manage org billing" on public.org_billing;
create policy "admins manage org billing" on public.org_billing
for all using (public.is_org_admin_or_owner(org_id))
with check (public.is_org_admin_or_owner(org_id));

drop policy if exists "admins read billing webhook events" on public.billing_webhook_events;
create policy "admins read billing webhook events" on public.billing_webhook_events
for select using (
  org_id is not null
  and public.is_org_admin_or_owner(org_id)
);

commit;
