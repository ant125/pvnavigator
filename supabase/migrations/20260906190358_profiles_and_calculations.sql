-- Phase 1 persistence foundation for PVNavigator.
-- Identity remains auth.users. Application profile + owned calculations live in public.
-- Privileged trigger helpers live in private (not exposed via the Data API).

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, supabase_auth_admin, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;
grant execute on function private.set_updated_at() to postgres, service_role, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'de',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_locale_nonempty check (char_length(trim(locale)) > 0)
);

comment on table public.profiles is
  'Public application profile. 1:1 with auth.users. Email stays in Auth.';

comment on column public.profiles.id is
  'Same UUID as auth.users.id.';

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

-- Signup: create a matching profile. SECURITY DEFINER so supabase_auth_admin
-- (no BYPASSRLS) can insert into public.profiles as the postgres owner.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
grant execute on function private.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

-- Existing Auth users keep their identity; only missing profiles are created.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- calculations
-- ---------------------------------------------------------------------------
-- Completed calculations only. Canonical input + compact result snapshot.
-- Do not persist 15-minute/hourly kernel arrays.
-- Future organisation_id can be added as nullable without replacing user_id.

create table public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_key text not null,
  name text not null,
  input jsonb not null,
  result_snapshot jsonb not null,
  input_schema_version text not null,
  result_schema_version text not null,
  battery_model_version text,
  summary_address text,
  summary_pv_kwp numeric,
  summary_consumption_kwh numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calculations_product_key_nonempty
    check (char_length(trim(product_key)) > 0),
  constraint calculations_name_nonempty
    check (char_length(trim(name)) > 0),
  constraint calculations_input_schema_version_nonempty
    check (char_length(trim(input_schema_version)) > 0),
  constraint calculations_result_schema_version_nonempty
    check (char_length(trim(result_schema_version)) > 0),
  constraint calculations_battery_model_version_nonempty
    check (
      battery_model_version is null
      or char_length(trim(battery_model_version)) > 0
    ),
  constraint calculations_summary_pv_kwp_nonnegative
    check (summary_pv_kwp is null or summary_pv_kwp >= 0),
  constraint calculations_summary_consumption_kwh_nonnegative
    check (summary_consumption_kwh is null or summary_consumption_kwh >= 0)
);

comment on table public.calculations is
  'User-owned historical calculations. Opening a row shows the stored snapshot; recalculation is an explicit later action.';

comment on column public.calculations.user_id is
  'Creator / private owner. Remains meaningful if organisation_id is added later.';

comment on column public.calculations.product_key is
  'Product identifier, e.g. speicher_grenze. No product table in Phase 1.';

comment on column public.calculations.input is
  'Canonical calculation input JSON. Schema identified by input_schema_version.';

comment on column public.calculations.result_snapshot is
  'Compact historical result. No kernel time-series arrays.';

comment on column public.calculations.battery_model_version is
  'Optional BATTERY_MODEL_VERSION from pv-core when the product uses it.';

comment on column public.calculations.summary_address is
  'Dashboard listing helper from the resolved / entered address.';

comment on column public.calculations.summary_pv_kwp is
  'Dashboard listing helper from the entered PV size (kWp).';

comment on column public.calculations.summary_consumption_kwh is
  'Dashboard listing helper from the entered household annual consumption (kWh).';

create trigger set_calculations_updated_at
  before update on public.calculations
  for each row
  execute function private.set_updated_at();

-- Dashboard: all products for one user, newest first.
create index calculations_user_updated_at_idx
  on public.calculations (user_id, updated_at desc);

-- Product-scoped listing (e.g. SpeicherGrenze).
create index calculations_user_product_updated_at_idx
  on public.calculations (user_id, product_key, updated_at desc);

-- ---------------------------------------------------------------------------
-- Grants
-- Profile INSERT is not granted to authenticated: only the signup trigger
-- (and roles that bypass RLS) may create profile rows.
-- Ownership columns on calculations are not in the UPDATE column grant.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, locale, updated_at) on table public.profiles to authenticated;
grant all on table public.profiles to postgres, service_role;

revoke all on table public.calculations from public, anon, authenticated;
grant select, insert, delete on table public.calculations to authenticated;
grant update (
  name,
  input,
  result_snapshot,
  input_schema_version,
  result_schema_version,
  battery_model_version,
  summary_address,
  summary_pv_kwp,
  summary_consumption_kwh,
  updated_at
) on table public.calculations to authenticated;
grant all on table public.calculations to postgres, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.calculations enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and id = (select auth.uid())
  );

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and id = (select auth.uid())
  )
  with check (
    (select auth.uid()) is not null
    and id = (select auth.uid())
  );

create policy calculations_select_own
  on public.calculations
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

create policy calculations_insert_own
  on public.calculations
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

create policy calculations_update_own
  on public.calculations
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  )
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

create policy calculations_delete_own
  on public.calculations
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );
