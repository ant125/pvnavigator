-- ABO (29 EUR, 50 addresses) and PRO (59 EUR, 200 addresses).
--
-- A paid period is opened only when the invoice price, amount and currency
-- match one legal catalog row. The amount alone is not enough. Existing
-- subscription_periods rows are never updated: a replay keeps the original
-- limit and the addresses already used.
--
-- Plan changes are status only (scheduled_plan_key). They do not open a
-- period and do not reset the current quota.
--
-- calculation_runs limits concurrent and burst physics runs across server
-- instances. It is not an address quota. Slots expire on their own.

alter table public.stripe_subscriptions
  add column scheduled_plan_key text,
  add column scheduled_effective_at timestamptz,
  add column schedule_event_created bigint not null default 0;

alter table public.stripe_subscriptions
  add constraint stripe_subscriptions_scheduled_plan_known
  check (
    scheduled_plan_key is null
    or scheduled_plan_key in ('pvnavigator_abo', 'pvnavigator_pro')
  );

comment on column public.stripe_subscriptions.scheduled_plan_key is
  'Tariff that starts at the next paid period. Null while the current price continues. Does not change the open subscription_periods row.';

-- ---------------------------------------------------------------------------
-- Apply one verified Stripe command. Replaces the single-price function.
-- 2900 cents + pvnavigator_abo + 50 addresses, or 5900 + pvnavigator_pro + 200.
-- ---------------------------------------------------------------------------

create or replace function public.apply_stripe_billing_event(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_action text;
  v_user uuid;
  v_customer text;
  v_link text;
  v_sub text;
  v_invoice text;
  v_status text;
  v_price text;
  v_reason text;
  v_amount integer;
  v_currency text;
  v_start timestamptz;
  v_end timestamptz;
  v_event_created bigint;
  v_period_id uuid;
  v_other uuid;
  v_plan_key text;
  v_limit integer;
  v_scheduled_plan text;
  v_scheduled_at timestamptz;
begin
  if p_event_id is null or char_length(trim(p_event_id)) = 0 then
    raise exception 'PVN_BILLING_EVENT_ID' using errcode = '22023';
  end if;

  insert into public.stripe_events (stripe_event_id, event_type, livemode, outcome)
  values (p_event_id, coalesce(nullif(trim(p_event_type), ''), 'unknown'), coalesce(p_livemode, false), 'processed')
  on conflict (stripe_event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('outcome', 'duplicate');
  end if;

  if coalesce(p_livemode, false) then
    update public.stripe_events
       set outcome = 'ignored'
     where stripe_event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored', 'reason', 'livemode');
  end if;

  v_action := coalesce(p_payload->>'action', 'ignore');

  if v_action = 'ignore' then
    update public.stripe_events
       set outcome = 'ignored'
     where stripe_event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored', 'reason', coalesce(p_payload->>'reason', 'ignored'));
  end if;

  v_user := private.billing_uuid(p_payload->>'user_id');
  v_customer := nullif(trim(coalesce(p_payload->>'customer_id', '')), '');

  if v_user is null or not exists (select 1 from auth.users u where u.id = v_user) then
    update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored', 'reason', 'unknown_user');
  end if;

  if v_action = 'link_customer' then
    v_link := private.link_stripe_customer(v_user, v_customer);
    if v_link <> 'linked' then
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'customer_' || v_link);
    end if;
    update public.stripe_checkout_claims
       set session_id = null, session_url = null, session_expires_at = null, claim_until = null
     where user_id = v_user;
    return jsonb_build_object('outcome', 'processed', 'action', 'link_customer');
  end if;

  if v_action = 'sync_subscription' then
    v_link := private.link_stripe_customer(v_user, v_customer);
    if v_link <> 'linked' then
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'customer_' || v_link);
    end if;

    v_sub := nullif(trim(coalesce(p_payload->>'subscription_id', '')), '');
    v_status := nullif(trim(coalesce(p_payload->>'status', '')), '');
    v_event_created := coalesce((p_payload->>'event_created')::bigint, 0);
    if v_sub is null or v_status is null then
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'subscription_shape');
    end if;

    insert into public.stripe_subscriptions (
      stripe_subscription_id, user_id, stripe_customer_id, status,
      cancel_at_period_end, cancel_at, current_period_start, current_period_end,
      price_id, latest_invoice_id, livemode, status_event_created
    )
    values (
      v_sub, v_user, v_customer, v_status,
      coalesce((p_payload->>'cancel_at_period_end')::boolean, false),
      nullif(p_payload->>'cancel_at', '')::timestamptz,
      nullif(p_payload->>'current_period_start', '')::timestamptz,
      nullif(p_payload->>'current_period_end', '')::timestamptz,
      nullif(p_payload->>'price_id', ''),
      nullif(p_payload->>'latest_invoice_id', ''),
      false,
      v_event_created
    )
    on conflict (stripe_subscription_id) do update
      set status = excluded.status,
          cancel_at_period_end = excluded.cancel_at_period_end,
          cancel_at = excluded.cancel_at,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          price_id = excluded.price_id,
          latest_invoice_id = excluded.latest_invoice_id,
          status_event_created = excluded.status_event_created,
          updated_at = now()
      where public.stripe_subscriptions.status_event_created < excluded.status_event_created;

    -- A finished subscription cannot keep a future tariff change.
    update public.stripe_subscriptions
       set scheduled_plan_key = null,
           scheduled_effective_at = null
     where stripe_subscription_id = v_sub
       and status in ('canceled', 'incomplete_expired')
       and status_event_created = v_event_created;

    return jsonb_build_object('outcome', 'processed', 'action', 'sync_subscription');
  end if;

  if v_action = 'sync_plan_change' then
    v_link := private.link_stripe_customer(v_user, v_customer);
    if v_link <> 'linked' then
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'customer_' || v_link);
    end if;

    v_sub := nullif(trim(coalesce(p_payload->>'subscription_id', '')), '');
    v_event_created := coalesce((p_payload->>'event_created')::bigint, 0);
    v_scheduled_plan := nullif(trim(coalesce(p_payload->>'scheduled_plan_key', '')), '');
    v_scheduled_at := nullif(p_payload->>'scheduled_effective_at', '')::timestamptz;
    if v_sub is null then
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'subscription_shape');
    end if;
    if v_scheduled_plan is not null and (
      v_scheduled_plan not in ('pvnavigator_abo', 'pvnavigator_pro')
      or v_scheduled_at is null
    ) then
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'plan_change_shape');
    end if;

    update public.stripe_subscriptions
       set scheduled_plan_key = v_scheduled_plan,
           scheduled_effective_at = case when v_scheduled_plan is null then null else v_scheduled_at end,
           schedule_event_created = v_event_created
     where stripe_subscription_id = v_sub
       and user_id = v_user
       and schedule_event_created <= v_event_created;

    if not found then
      if exists (
        select 1
          from public.stripe_subscriptions s
         where s.stripe_subscription_id = v_sub
           and s.user_id = v_user
      ) then
        update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
        return jsonb_build_object('outcome', 'ignored', 'reason', 'stale_event');
      end if;
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'subscription_missing');
    end if;

    -- Status only. The open period and its used addresses stay as they are.
    return jsonb_build_object('outcome', 'processed', 'action', 'sync_plan_change');
  end if;

  if v_action = 'invoice_failed' then
    v_invoice := nullif(trim(coalesce(p_payload->>'invoice_id', '')), '');
    v_sub := nullif(trim(coalesce(p_payload->>'subscription_id', '')), '');
    if v_invoice is null then
      update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
      return jsonb_build_object('outcome', 'ignored', 'reason', 'invoice_shape');
    end if;
    if v_customer is not null then
      perform private.link_stripe_customer(v_user, v_customer);
    end if;
    insert into public.stripe_invoices (
      stripe_invoice_id, user_id, stripe_subscription_id, stripe_customer_id,
      status, billing_reason, livemode
    )
    values (
      v_invoice, v_user, v_sub, v_customer,
      'payment_failed', nullif(p_payload->>'billing_reason', ''), false
    )
    on conflict (stripe_invoice_id) do update
      set status = case
            when public.stripe_invoices.status = 'paid' then public.stripe_invoices.status
            else excluded.status
          end
      where public.stripe_invoices.subscription_period_id is null;
    return jsonb_build_object('outcome', 'processed', 'action', 'invoice_failed');
  end if;

  if v_action <> 'invoice_paid' then
    update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored', 'reason', 'unknown_action');
  end if;

  v_link := private.link_stripe_customer(v_user, v_customer);
  if v_link <> 'linked' then
    update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored', 'reason', 'customer_' || v_link);
  end if;

  v_invoice := nullif(trim(coalesce(p_payload->>'invoice_id', '')), '');
  v_sub := nullif(trim(coalesce(p_payload->>'subscription_id', '')), '');
  v_price := nullif(trim(coalesce(p_payload->>'price_id', '')), '');
  v_reason := nullif(trim(coalesce(p_payload->>'billing_reason', '')), '');
  v_currency := lower(nullif(trim(coalesce(p_payload->>'currency', '')), ''));
  v_amount := (p_payload->>'amount_paid')::integer;
  v_start := nullif(p_payload->>'period_start', '')::timestamptz;
  v_end := nullif(p_payload->>'period_end', '')::timestamptz;

  -- The catalog is supplied by the server from its Price ID configuration.
  -- A row counts only when price, amount, currency and the legal plan tuple agree.
  if jsonb_typeof(p_payload->'allowed_prices') = 'array' and v_currency = 'eur' then
    select item.plan_key, item.address_limit
      into v_plan_key, v_limit
      from jsonb_to_recordset(p_payload->'allowed_prices')
        as item(price_id text, amount integer, currency text, plan_key text, address_limit integer)
     where nullif(trim(item.price_id), '') = v_price
       and item.amount = v_amount
       and lower(nullif(trim(item.currency), '')) = 'eur'
       and (
         (item.plan_key = 'pvnavigator_abo' and item.amount = 2900 and item.address_limit = 50)
         or
         (item.plan_key = 'pvnavigator_pro' and item.amount = 5900 and item.address_limit = 200)
       )
     limit 1;
  end if;

  if v_invoice is null or v_sub is null
     or v_plan_key is null or v_limit is null
     or v_reason not in ('subscription_create', 'subscription_cycle')
     or v_start is null or v_end is null or v_end <= v_start
  then
    if v_invoice is not null then
      insert into public.stripe_invoices (
        stripe_invoice_id, user_id, stripe_subscription_id, stripe_customer_id,
        status, billing_reason, amount_paid, currency, period_start, period_end, livemode
      )
      values (
        v_invoice, v_user, v_sub, v_customer,
        'not_granted', v_reason, v_amount, v_currency, v_start, v_end, false
      )
      on conflict (stripe_invoice_id) do nothing;
    end if;
    update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored', 'reason', 'not_our_price');
  end if;

  select s.user_id into v_other
    from public.stripe_subscriptions s
   where s.user_id = v_user
     and s.stripe_subscription_id <> v_sub
     and s.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused')
   limit 1;
  if found then
    insert into public.stripe_invoices (
      stripe_invoice_id, user_id, stripe_subscription_id, stripe_customer_id,
      status, billing_reason, amount_paid, currency, period_start, period_end, livemode
    )
    values (
      v_invoice, v_user, v_sub, v_customer,
      'not_granted', v_reason, v_amount, v_currency, v_start, v_end, false
    )
    on conflict (stripe_invoice_id) do nothing;
    update public.stripe_events set outcome = 'ignored' where stripe_event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored', 'reason', 'second_subscription');
  end if;

  insert into public.subscription_periods (
    user_id, plan_key, period_start, period_end, address_limit, source, external_ref
  )
  values (
    v_user, v_plan_key, v_start, v_end, v_limit, 'stripe', v_invoice
  )
  on conflict (external_ref) where source = 'stripe' and external_ref is not null
  do nothing
  returning id into v_period_id;

  if v_period_id is null then
    select sp.id into v_period_id
      from public.subscription_periods sp
     where sp.source = 'stripe'
       and sp.external_ref = v_invoice;
  end if;

  insert into public.stripe_invoices (
    stripe_invoice_id, user_id, stripe_subscription_id, stripe_customer_id,
    status, billing_reason, amount_paid, currency, period_start, period_end,
    subscription_period_id, livemode
  )
  values (
    v_invoice, v_user, v_sub, v_customer,
    'paid', v_reason, v_amount, v_currency, v_start, v_end,
    v_period_id, false
  )
  on conflict (stripe_invoice_id) do update
    set status = 'paid',
        amount_paid = excluded.amount_paid,
        currency = excluded.currency,
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        subscription_period_id = coalesce(public.stripe_invoices.subscription_period_id, excluded.subscription_period_id);

  insert into public.stripe_subscriptions (
    stripe_subscription_id, user_id, stripe_customer_id, status,
    cancel_at_period_end, current_period_start, current_period_end,
    price_id, latest_invoice_id, livemode, status_event_created
  )
  values (
    v_sub, v_user, v_customer, 'active',
    false, v_start, v_end,
    v_price, v_invoice, false, 0
  )
  on conflict (stripe_subscription_id) do nothing;

  return jsonb_build_object(
    'outcome', 'processed',
    'action', 'invoice_paid',
    'period_id', v_period_id,
    'plan_key', v_plan_key,
    'address_limit', v_limit
  );
end;
$$;

revoke all on function public.apply_stripe_billing_event(text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.apply_stripe_billing_event(text, text, boolean, jsonb) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Heavy-calculation guard. Shared by every server instance.
-- 1 calculation at a time per user, at most 12 starts in 10 minutes.
-- A slot expires after 6 minutes if the server never releases it.
-- This does not limit how many variants of one address may be saved.
-- ---------------------------------------------------------------------------

create table public.calculation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  constraint calculation_runs_expiry check (expires_at > started_at)
);

create index calculation_runs_user_started_idx
  on public.calculation_runs (user_id, started_at desc);

comment on table public.calculation_runs is
  'Short-lived slots for heavy calculations. Expired rows stop counting as in flight. Not an address or report quota.';

revoke all on table public.calculation_runs from public, anon, authenticated;
grant all on table public.calculation_runs to postgres, service_role;

alter table public.calculation_runs enable row level security;

create or replace function public.acquire_calculation_run()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_window interval := interval '10 minutes';
  v_ttl interval := interval '6 minutes';
  v_max_concurrent integer := 1;
  v_max_starts integer := 12;
  v_active integer;
  v_recent integer;
  v_retry integer;
  v_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  perform pg_advisory_xact_lock(hashtext('pvn_calc_run'), hashtext(v_user::text));

  delete from public.calculation_runs
   where user_id = v_user
     and started_at < v_now - v_window;

  update public.calculation_runs
     set released_at = v_now
   where user_id = v_user
     and released_at is null
     and expires_at <= v_now;

  select count(*) into v_active
    from public.calculation_runs
   where user_id = v_user
     and released_at is null
     and expires_at > v_now;

  if v_active >= v_max_concurrent then
    select greatest(1, ceil(extract(epoch from (min(expires_at) - v_now))))::integer
      into v_retry
      from public.calculation_runs
     where user_id = v_user
       and released_at is null
       and expires_at > v_now;
    return jsonb_build_object(
      'ok', false,
      'reason', 'concurrent',
      'retry_after_seconds', coalesce(v_retry, 60)
    );
  end if;

  select count(*) into v_recent
    from public.calculation_runs
   where user_id = v_user
     and started_at > v_now - v_window;

  if v_recent >= v_max_starts then
    select greatest(1, ceil(extract(epoch from (min(started_at) + v_window - v_now))))::integer
      into v_retry
      from public.calculation_runs
     where user_id = v_user
       and started_at > v_now - v_window;
    return jsonb_build_object(
      'ok', false,
      'reason', 'rate',
      'retry_after_seconds', coalesce(v_retry, 60)
    );
  end if;

  insert into public.calculation_runs (user_id, expires_at)
  values (v_user, v_now + v_ttl)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.acquire_calculation_run() from public, anon;
grant execute on function public.acquire_calculation_run() to authenticated, service_role;

create or replace function public.release_calculation_run(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or p_id is null then
    return;
  end if;
  update public.calculation_runs
     set released_at = now()
   where id = p_id
     and user_id = v_user
     and released_at is null;
end;
$$;

revoke all on function public.release_calculation_run(uuid) from public, anon;
grant execute on function public.release_calculation_run(uuid) to authenticated, service_role;
