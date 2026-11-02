-- Stripe sandbox linkage for the PVNAVIGATOR_ monthly subscription.
--
-- Additive and safe to apply before the app that calls it is deployed:
-- new tables and functions only. subscription_periods stays the access
-- source (one paid invoice = one period, address_limit 50). Clients can
-- read their own customer and subscription status. They cannot insert a
-- period, pin a price, or change a tariff.
--
-- Writes go through the functions below, granted only to service_role.
-- The webhook verifies the Stripe signature first; these functions then
-- apply the already-checked command idempotently.
--
-- Livemode events are recorded and ignored. They never open a period.
-- This file does not move or weaken the access-rules lockdown, which stays
-- in supabase/post-deploy until that separate rollout step.

-- ---------------------------------------------------------------------------
-- Customers, subscriptions, invoices, processed events, checkout claims
-- ---------------------------------------------------------------------------

create table public.stripe_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_customers_id_nonempty
    check (char_length(trim(stripe_customer_id)) > 0)
);

create unique index stripe_customers_stripe_id_uidx
  on public.stripe_customers (stripe_customer_id);

comment on table public.stripe_customers is
  'Maps one auth user to one Stripe customer. Written only by the billing functions.';

create trigger set_stripe_customers_updated_at
  before update on public.stripe_customers
  for each row
  execute function private.set_updated_at();

create table public.stripe_subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  status text not null,
  cancel_at_period_end boolean not null default false,
  cancel_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  price_id text,
  latest_invoice_id text,
  livemode boolean not null default false,
  -- Stripe event.created (unix seconds) of the snapshot last applied.
  status_event_created bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_subscriptions_id_nonempty
    check (char_length(trim(stripe_subscription_id)) > 0),
  constraint stripe_subscriptions_status_nonempty
    check (char_length(trim(status)) > 0)
);

create index stripe_subscriptions_user_idx
  on public.stripe_subscriptions (user_id);

comment on table public.stripe_subscriptions is
  'Latest Stripe subscription status. Distinct from paid access: access is a subscription_periods row created only from a paid invoice.';

create trigger set_stripe_subscriptions_updated_at
  before update on public.stripe_subscriptions
  for each row
  execute function private.set_updated_at();

create table public.stripe_invoices (
  stripe_invoice_id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text not null,
  billing_reason text,
  amount_paid integer,
  currency text,
  period_start timestamptz,
  period_end timestamptz,
  subscription_period_id uuid references public.subscription_periods (id) on delete set null,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  constraint stripe_invoices_id_nonempty
    check (char_length(trim(stripe_invoice_id)) > 0)
);

comment on table public.stripe_invoices is
  'Stripe invoices seen by the webhook. A row here does not by itself grant access; only a linked subscription_periods row does.';

create table public.stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  outcome text not null,
  created_at timestamptz not null default now(),
  constraint stripe_events_id_nonempty
    check (char_length(trim(stripe_event_id)) > 0),
  constraint stripe_events_outcome_known
    check (outcome in ('processed', 'ignored'))
);

comment on table public.stripe_events is
  'Webhook idempotency. The row is inserted in the same transaction as the access change, so a crash rolls both back and Stripe can retry.';

-- One Stripe invoice grants at most one paid period. Replays do not reset usage.
create unique index subscription_periods_stripe_invoice_uidx
  on public.subscription_periods (external_ref)
  where source = 'stripe' and external_ref is not null;

comment on column public.subscription_periods.external_ref is
  'For source = stripe, the Stripe invoice id of the payment that opened this period. Null for manual and test periods.';

create table public.stripe_checkout_claims (
  user_id uuid primary key references auth.users (id) on delete cascade,
  claim_until timestamptz,
  session_id text,
  session_url text,
  session_expires_at timestamptz
);

comment on table public.stripe_checkout_claims is
  'Short lock plus the open Checkout URL so a double click cannot start two subscriptions. Not readable by the browser.';

-- ---------------------------------------------------------------------------
-- Grants + RLS. Own customer/subscription status is readable. Nothing else.
-- ---------------------------------------------------------------------------

revoke all on table public.stripe_customers from public, anon, authenticated;
grant select on table public.stripe_customers to authenticated;
grant all on table public.stripe_customers to postgres, service_role;

revoke all on table public.stripe_subscriptions from public, anon, authenticated;
grant select on table public.stripe_subscriptions to authenticated;
grant all on table public.stripe_subscriptions to postgres, service_role;

revoke all on table public.stripe_invoices from public, anon, authenticated;
grant all on table public.stripe_invoices to postgres, service_role;

revoke all on table public.stripe_events from public, anon, authenticated;
grant all on table public.stripe_events to postgres, service_role;

revoke all on table public.stripe_checkout_claims from public, anon, authenticated;
grant all on table public.stripe_checkout_claims to postgres, service_role;

alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.stripe_invoices enable row level security;
alter table public.stripe_events enable row level security;
alter table public.stripe_checkout_claims enable row level security;

create policy stripe_customers_select_own
  on public.stripe_customers
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

create policy stripe_subscriptions_select_own
  on public.stripe_subscriptions
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Helpers (private). Not exposed through the Data API.
-- ---------------------------------------------------------------------------

create or replace function private.billing_uuid(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p_value::uuid
    else null
  end
$$;

revoke all on function private.billing_uuid(text) from public, anon, authenticated;

-- Links a customer to a user. Refuses to move an existing link onto someone else.
create or replace function private.link_stripe_customer(p_user uuid, p_customer text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if p_user is null or p_customer is null or char_length(trim(p_customer)) = 0 then
    return 'missing';
  end if;

  perform pg_advisory_xact_lock(hashtext('pvn_billing_customer'), hashtext(p_customer));

  select c.user_id into v_owner
    from public.stripe_customers c
   where c.stripe_customer_id = p_customer;

  if found and v_owner <> p_user then
    return 'mismatch';
  end if;

  if found then
    return 'linked';
  end if;

  insert into public.stripe_customers (user_id, stripe_customer_id, livemode)
  values (p_user, p_customer, false)
  on conflict (user_id) do nothing;

  select c.user_id into v_owner
    from public.stripe_customers c
   where c.stripe_customer_id = p_customer;

  if v_owner is distinct from p_user then
    return 'mismatch';
  end if;
  return 'linked';
end;
$$;

revoke all on function private.link_stripe_customer(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Apply one verified Stripe command. Idempotent. Does not invent period dates.
-- 2900 euro cents is the only amount that opens a period (Kleinunternehmer
-- final price, no tax on top). Keep in sync with SUBSCRIPTION_PRICE_CENTS.
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
  v_expected_price text;
  v_reason text;
  v_amount integer;
  v_currency text;
  v_start timestamptz;
  v_end timestamptz;
  v_event_created bigint;
  v_period_id uuid;
  v_other uuid;
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

    -- Status only. Never creates, shortens, or deletes a paid period.
    return jsonb_build_object('outcome', 'processed', 'action', 'sync_subscription');
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
    -- A failed payment does not open a period and does not remove one.
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
  v_expected_price := nullif(trim(coalesce(p_payload->>'expected_price_id', '')), '');
  v_reason := nullif(trim(coalesce(p_payload->>'billing_reason', '')), '');
  v_currency := lower(nullif(trim(coalesce(p_payload->>'currency', '')), ''));
  v_amount := (p_payload->>'amount_paid')::integer;
  v_start := nullif(p_payload->>'period_start', '')::timestamptz;
  v_end := nullif(p_payload->>'period_end', '')::timestamptz;

  if v_invoice is null or v_sub is null
     or v_price is null or v_expected_price is null or v_price <> v_expected_price
     or v_currency is distinct from 'eur'
     or v_amount is distinct from 2900
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

  -- A second still-open subscription must not open another paid period.
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
    v_user, 'pvnavigator_monthly', v_start, v_end, 50, 'stripe', v_invoice
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

  -- Stub so the account can show the subscription before its status event.
  -- A newer status snapshot (higher event.created) is left untouched.
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
    'period_id', v_period_id
  );
end;
$$;

revoke all on function public.apply_stripe_billing_event(text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.apply_stripe_billing_event(text, text, boolean, jsonb) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Checkout reservation. One open session per user; an active period or an
-- open Stripe subscription is sent to management instead of a second purchase.
-- ---------------------------------------------------------------------------

create or replace function public.reserve_stripe_checkout(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer text;
  v_url text;
  v_expires timestamptz;
  v_claim timestamptz;
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    return jsonb_build_object('action', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(hashtext('pvn_checkout'), hashtext(p_user::text));

  select c.stripe_customer_id into v_customer
    from public.stripe_customers c
   where c.user_id = p_user;

  if exists (
    select 1
      from public.subscription_periods sp
     where sp.user_id = p_user
       and sp.period_start <= now()
       and now() < sp.period_end
  ) or exists (
    select 1
      from public.stripe_subscriptions s
     where s.user_id = p_user
       and s.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused')
  ) then
    return jsonb_build_object('action', 'manage', 'customer_id', v_customer);
  end if;

  select claim.session_url, claim.session_expires_at, claim.claim_until
    into v_url, v_expires, v_claim
    from public.stripe_checkout_claims claim
   where claim.user_id = p_user;

  if v_url is not null and v_expires is not null and v_expires > now() + interval '5 minutes' then
    return jsonb_build_object('action', 'reuse', 'url', v_url, 'customer_id', v_customer);
  end if;

  if v_claim is not null and v_claim > now() then
    return jsonb_build_object('action', 'busy');
  end if;

  insert into public.stripe_checkout_claims (user_id, claim_until)
  values (p_user, now() + interval '30 seconds')
  on conflict (user_id) do update
    set claim_until = excluded.claim_until;

  return jsonb_build_object('action', 'create', 'customer_id', v_customer);
end;
$$;

revoke all on function public.reserve_stripe_checkout(uuid) from public, anon, authenticated;
grant execute on function public.reserve_stripe_checkout(uuid) to postgres, service_role;

create or replace function public.store_stripe_checkout_session(
  p_user uuid,
  p_session_id text,
  p_url text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.stripe_checkout_claims (user_id, claim_until, session_id, session_url, session_expires_at)
  values (p_user, null, p_session_id, p_url, p_expires_at)
  on conflict (user_id) do update
    set claim_until = null,
        session_id = excluded.session_id,
        session_url = excluded.session_url,
        session_expires_at = excluded.session_expires_at;
end;
$$;

revoke all on function public.store_stripe_checkout_session(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.store_stripe_checkout_session(uuid, text, text, timestamptz) to postgres, service_role;

create or replace function public.release_stripe_checkout_claim(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stripe_checkout_claims
     set claim_until = null
   where user_id = p_user;
end;
$$;

revoke all on function public.release_stripe_checkout_claim(uuid) from public, anon, authenticated;
grant execute on function public.release_stripe_checkout_claim(uuid) to postgres, service_role;

create or replace function public.link_stripe_customer(p_user uuid, p_customer_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text;
begin
  v_link := private.link_stripe_customer(p_user, p_customer_id);
  return jsonb_build_object('result', v_link);
end;
$$;

revoke all on function public.link_stripe_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.link_stripe_customer(uuid, text) to postgres, service_role;
