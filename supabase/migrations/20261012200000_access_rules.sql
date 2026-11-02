-- PVNAVIGATOR_ access rules.
--
-- Free access : one pinned address per account. Pinned by the first successful
--               calculation (any parameters afterwards). No monthly reset.
-- Subscription: one paid period = address_limit unique addresses across all
--               products. A known address inside the period is free of charge;
--               a new paid period counts an address once again.
--
-- The decision is taken here, in SECURITY DEFINER functions, under a per-user
-- advisory lock. Browsers only read their own rows; they cannot create
-- subscription periods, pin addresses, or choose a calculation's access tier.
--
-- Existing calculations keep access_tier = null ("legacy"): their access type
-- cannot be determined reliably, they never pin an address and they are not
-- re-marked. Only rows created through record_completed_calculation() carry a
-- tier.
--
-- Rollout: this file is additive and safe to apply while the previous code is
-- still deployed. Apply it first, deploy the code that calls the RPCs, then
-- apply supabase/post-deploy/20261012200100_access_rules_lockdown.sql (kept
-- outside migrations/ so a plain `supabase db push` cannot run it early).

-- ---------------------------------------------------------------------------
-- subscription_periods: one row per paid period
-- ---------------------------------------------------------------------------

create table public.subscription_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_key text not null default 'pvnavigator_monthly',
  period_start timestamptz not null,
  period_end timestamptz not null,
  address_limit integer not null default 50,
  source text not null default 'manual',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_periods_plan_key_nonempty
    check (char_length(trim(plan_key)) > 0),
  constraint subscription_periods_period_order
    check (period_end > period_start),
  constraint subscription_periods_address_limit_positive
    check (address_limit > 0),
  constraint subscription_periods_source_known
    check (source in ('manual', 'test', 'stripe'))
);

comment on table public.subscription_periods is
  'PVNAVIGATOR_ subscription: one row per paid period. Active when period_start <= now() < period_end. Written only by privileged roles (billing webhook, admin, test seed).';

comment on column public.subscription_periods.address_limit is
  'Unique addresses allowed in this paid period across all products.';

comment on column public.subscription_periods.external_ref is
  'Billing reference (e.g. Stripe subscription / invoice id). Null for manual and test periods.';

create trigger set_subscription_periods_updated_at
  before update on public.subscription_periods
  for each row
  execute function private.set_updated_at();

create index subscription_periods_user_period_idx
  on public.subscription_periods (user_id, period_end desc);

-- ---------------------------------------------------------------------------
-- subscription_period_addresses: unique addresses counted in a paid period
-- ---------------------------------------------------------------------------

create table public.subscription_period_addresses (
  period_id uuid not null references public.subscription_periods (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  address_key text not null,
  address_label text,
  first_calculation_id uuid references public.calculations (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (period_id, address_key),
  constraint subscription_period_addresses_key_nonempty
    check (char_length(trim(address_key)) > 0)
);

comment on table public.subscription_period_addresses is
  'Addresses that consumed one slot of a paid period. Re-calculating a listed address does not add a row.';

create index subscription_period_addresses_user_idx
  on public.subscription_period_addresses (user_id, period_id);

-- ---------------------------------------------------------------------------
-- free_addresses: the single pinned free address per account
-- ---------------------------------------------------------------------------

create table public.free_addresses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  address_key text not null,
  address_label text not null,
  calculation_id uuid references public.calculations (id) on delete set null,
  claimed_at timestamptz not null default now(),
  constraint free_addresses_key_nonempty
    check (char_length(trim(address_key)) > 0),
  constraint free_addresses_label_nonempty
    check (char_length(trim(address_label)) > 0)
);

comment on table public.free_addresses is
  'One free address per account, pinned by the first successful free calculation. Never pinned from history, never reset.';

-- ---------------------------------------------------------------------------
-- calculations: access tier decided at creation, immutable afterwards
-- ---------------------------------------------------------------------------

alter table public.calculations
  add column access_tier text,
  add column address_key text,
  add constraint calculations_access_tier_known
    check (access_tier is null or access_tier in ('free', 'paid'));

comment on column public.calculations.access_tier is
  'free | paid, decided server-side when the row was recorded. null = created before the access rules (legacy): shown and exported as before, never re-marked.';

comment on column public.calculations.address_key is
  'Normalised address key used for the access decision. null for legacy rows.';

-- The UPDATE column grant from the first migration does not include
-- access_tier or address_key, so clients cannot change them. Direct INSERTs
-- stay possible for the previously deployed code (its rows become legacy),
-- but only for the pre-existing columns: a client can never write a tier.
-- post-deploy/20261012200100_access_rules_lockdown.sql removes the INSERT path
-- entirely once every deployment records through record_completed_calculation().
revoke insert on table public.calculations from authenticated;
grant insert (
  user_id,
  product_key,
  name,
  input,
  result_snapshot,
  input_schema_version,
  result_schema_version,
  battery_model_version,
  summary_address,
  summary_pv_kwp,
  summary_consumption_kwh
) on table public.calculations to authenticated;

-- ---------------------------------------------------------------------------
-- Grants + RLS for the new tables: own rows, read only
-- ---------------------------------------------------------------------------

revoke all on table public.subscription_periods from public, anon, authenticated;
grant select on table public.subscription_periods to authenticated;
grant all on table public.subscription_periods to postgres, service_role;

revoke all on table public.subscription_period_addresses from public, anon, authenticated;
grant select on table public.subscription_period_addresses to authenticated;
grant all on table public.subscription_period_addresses to postgres, service_role;

revoke all on table public.free_addresses from public, anon, authenticated;
grant select on table public.free_addresses to authenticated;
grant all on table public.free_addresses to postgres, service_role;

alter table public.subscription_periods enable row level security;
alter table public.subscription_period_addresses enable row level security;
alter table public.free_addresses enable row level security;

create policy subscription_periods_select_own
  on public.subscription_periods
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

create policy subscription_period_addresses_select_own
  on public.subscription_period_addresses
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

create policy free_addresses_select_own
  on public.free_addresses
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Decision (private). Same logic for the pre-check and for the record step.
-- Returns jsonb: allowed, tier, reason, subscription{...}|null, free_address_label.
-- ---------------------------------------------------------------------------

create or replace function private.decide_calculation_access(
  p_user uuid,
  p_address_key text
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_period record;
  v_used integer;
  v_free record;
  v_subscription jsonb := null;
  v_limit_reached boolean := false;
begin
  if p_user is null then
    return jsonb_build_object(
      'allowed', false, 'tier', null, 'reason', 'unauthenticated',
      'subscription', null, 'free_address_label', null
    );
  end if;

  if p_address_key is null or char_length(trim(p_address_key)) = 0 then
    return jsonb_build_object(
      'allowed', false, 'tier', null, 'reason', 'invalid_address',
      'subscription', null, 'free_address_label', null
    );
  end if;

  -- Active paid period: period_start <= now() < period_end.
  select sp.id, sp.period_end, sp.address_limit
    into v_period
    from public.subscription_periods sp
   where sp.user_id = p_user
     and sp.period_start <= now()
     and now() < sp.period_end
   order by sp.period_end desc
   limit 1;

  if found then
    select count(*)::integer
      into v_used
      from public.subscription_period_addresses spa
     where spa.period_id = v_period.id;

    v_subscription := jsonb_build_object(
      'period_id', v_period.id,
      'period_end', v_period.period_end,
      'address_limit', v_period.address_limit,
      'used_addresses', v_used
    );

    if exists (
      select 1
        from public.subscription_period_addresses spa
       where spa.period_id = v_period.id
         and spa.address_key = p_address_key
    ) then
      return jsonb_build_object(
        'allowed', true, 'tier', 'paid', 'reason', 'subscription_known_address',
        'subscription', v_subscription, 'free_address_label', null
      );
    end if;

    if v_used < v_period.address_limit then
      return jsonb_build_object(
        'allowed', true, 'tier', 'paid', 'reason', 'subscription_new_address',
        'subscription', v_subscription, 'free_address_label', null
      );
    end if;

    v_limit_reached := true;
  end if;

  -- Free rules (no active period, or its quota is used up).
  select fa.address_key, fa.address_label
    into v_free
    from public.free_addresses fa
   where fa.user_id = p_user;

  if not found then
    return jsonb_build_object(
      'allowed', true, 'tier', 'free', 'reason', 'free_claim_pending',
      'subscription', v_subscription, 'free_address_label', null
    );
  end if;

  if v_free.address_key = p_address_key then
    return jsonb_build_object(
      'allowed', true, 'tier', 'free', 'reason', 'free_address',
      'subscription', v_subscription, 'free_address_label', v_free.address_label
    );
  end if;

  return jsonb_build_object(
    'allowed', false, 'tier', null,
    'reason', case when v_limit_reached then 'subscription_limit_reached' else 'free_address_mismatch' end,
    'subscription', v_subscription, 'free_address_label', v_free.address_label
  );
end;
$$;

revoke all on function private.decide_calculation_access(uuid, text) from public, anon, authenticated;
grant execute on function private.decide_calculation_access(uuid, text) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Pre-check (read only). Called by the server before the physics run so a
-- refused address fails fast. Never pins or counts anything.
-- ---------------------------------------------------------------------------

create or replace function public.check_calculation_access(p_address_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.decide_calculation_access(auth.uid(), p_address_key);
$$;

revoke all on function public.check_calculation_access(text) from public, anon;
grant execute on function public.check_calculation_access(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record a successful calculation. Atomic under a per-user advisory lock:
-- re-decide → insert the row with its tier → pin the free address or count
-- the subscription address. A failed calculation never reaches this
-- function, so it never pins or consumes anything.
-- Raises 'PVN_ACCESS_DENIED:<reason>' when the re-check refuses.
-- ---------------------------------------------------------------------------

create or replace function public.record_completed_calculation(
  p_address_key text,
  p_address_label text,
  p_calculation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_decision jsonb;
  v_tier text;
  v_reason text;
  v_id uuid;
  v_label text;
begin
  if v_user is null then
    raise exception 'PVN_ACCESS_DENIED:unauthenticated' using errcode = '42501';
  end if;

  if p_calculation is null or jsonb_typeof(p_calculation) <> 'object' then
    raise exception 'PVN_INVALID_CALCULATION' using errcode = '22023';
  end if;

  -- Serialise all access decisions of this user.
  perform pg_advisory_xact_lock(hashtext('pvn_access'), hashtext(v_user::text));

  v_decision := private.decide_calculation_access(v_user, p_address_key);
  v_tier := v_decision->>'tier';
  v_reason := v_decision->>'reason';

  if not coalesce((v_decision->>'allowed')::boolean, false) then
    raise exception 'PVN_ACCESS_DENIED:%', v_reason using errcode = '42501';
  end if;

  v_label := nullif(trim(coalesce(p_address_label, '')), '');
  if v_label is null then
    v_label := nullif(trim(coalesce(p_calculation->>'summary_address', '')), '');
  end if;
  if v_label is null then
    v_label := p_address_key;
  end if;

  insert into public.calculations (
    user_id,
    product_key,
    name,
    input,
    result_snapshot,
    input_schema_version,
    result_schema_version,
    battery_model_version,
    summary_address,
    summary_pv_kwp,
    summary_consumption_kwh,
    access_tier,
    address_key
  )
  values (
    v_user,
    p_calculation->>'product_key',
    p_calculation->>'name',
    coalesce(p_calculation->'input', '{}'::jsonb),
    coalesce(p_calculation->'result_snapshot', '{}'::jsonb),
    p_calculation->>'input_schema_version',
    p_calculation->>'result_schema_version',
    p_calculation->>'battery_model_version',
    p_calculation->>'summary_address',
    (p_calculation->>'summary_pv_kwp')::numeric,
    (p_calculation->>'summary_consumption_kwh')::numeric,
    v_tier,
    p_address_key
  )
  returning id into v_id;

  if v_tier = 'paid' and v_reason = 'subscription_new_address' then
    insert into public.subscription_period_addresses (
      period_id, user_id, address_key, address_label, first_calculation_id
    )
    values (
      (v_decision->'subscription'->>'period_id')::uuid,
      v_user,
      p_address_key,
      v_label,
      v_id
    )
    on conflict (period_id, address_key) do nothing;
  elsif v_tier = 'free' and v_reason = 'free_claim_pending' then
    -- No ON CONFLICT on purpose: the advisory lock makes a clash impossible,
    -- and if it ever happened the whole record must fail rather than silently
    -- hand out a free report for a second address.
    insert into public.free_addresses (user_id, address_key, address_label, calculation_id)
    values (v_user, p_address_key, v_label, v_id);
  end if;

  return jsonb_build_object(
    'calculation_id', v_id,
    'access_tier', v_tier,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.record_completed_calculation(text, text, jsonb) from public, anon;
grant execute on function public.record_completed_calculation(text, text, jsonb) to authenticated, service_role;
