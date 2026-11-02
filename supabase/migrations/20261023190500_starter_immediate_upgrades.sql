-- Immediate upgrades: STARTER to ABO, STARTER to PRO, and the existing ABO to PRO.
-- Each one pays the full new monthly price. The older period row is not rewritten.
-- A later-starting period is the only usable quota. No proration and no refund.
-- Downgrades stay a cancellation at period end plus a new booking.
-- Existing subscription_periods rows are not updated.

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
  v_plan_key text;
  v_limit integer;
  v_scheduled_plan text;
  v_scheduled_at timestamptz;
  v_replaces text;
  v_upgrade boolean := false;
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
            when public.stripe_invoices.status in ('paid', 'void') then public.stripe_invoices.status
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
  v_replaces := nullif(trim(coalesce(p_payload->>'replaces_subscription_id', '')), '');

  if jsonb_typeof(p_payload->'allowed_prices') = 'array' and v_currency = 'eur' then
    select item.plan_key, item.address_limit
      into v_plan_key, v_limit
      from jsonb_to_recordset(p_payload->'allowed_prices')
        as item(price_id text, amount integer, currency text, plan_key text, address_limit integer)
     where nullif(trim(item.price_id), '') = v_price
       and item.amount = v_amount
       and lower(nullif(trim(item.currency), '')) = 'eur'
       and (
         (item.plan_key = 'pvnavigator_starter' and item.amount = 900 and item.address_limit = 10)
         or
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

  -- The named subscription may stay open until the higher-plan invoice is stored.
  -- STARTER may move to ABO or PRO. ABO may move to PRO. The older period row
  -- stays unchanged. Any other open subscription still blocks a second period.
  if v_reason = 'subscription_create'
     and v_replaces is not null
     and v_replaces <> v_sub
     and exists (
       select 1
         from public.stripe_subscriptions s
        where s.stripe_subscription_id = v_replaces
          and s.user_id = v_user
     )
     and not exists (
       select 1
         from public.stripe_subscriptions s
        where s.user_id = v_user
          and s.stripe_subscription_id <> v_sub
          and s.stripe_subscription_id <> v_replaces
          and s.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused')
     )
     and (
       (
         v_plan_key = 'pvnavigator_pro'
         and exists (
           select 1
             from public.subscription_periods sp
            where sp.user_id = v_user
              and sp.plan_key in ('pvnavigator_starter', 'pvnavigator_abo')
              and sp.period_start <= now()
              and now() < sp.period_end
         )
         and not exists (
           select 1
             from public.subscription_periods sp
            where sp.user_id = v_user
              and sp.plan_key = 'pvnavigator_pro'
              and sp.period_start <= now()
              and now() < sp.period_end
         )
       )
       or (
         v_plan_key = 'pvnavigator_abo'
         and exists (
           select 1
             from public.subscription_periods sp
            where sp.user_id = v_user
              and sp.plan_key = 'pvnavigator_starter'
              and sp.period_start <= now()
              and now() < sp.period_end
         )
         and not exists (
           select 1
             from public.subscription_periods sp
            where sp.user_id = v_user
              and sp.plan_key in ('pvnavigator_abo', 'pvnavigator_pro')
              and sp.period_start <= now()
              and now() < sp.period_end
         )
       )
     )
  then
    v_upgrade := true;
  end if;

  if exists (
    select 1
      from public.stripe_subscriptions s
     where s.user_id = v_user
       and s.stripe_subscription_id <> v_sub
       and s.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused')
       and (not v_upgrade or s.stripe_subscription_id <> v_replaces)
       and not exists (
         select 1
           from public.stripe_invoices i
          where i.user_id = v_user
            and i.status = 'paid'
            and i.replaces_subscription_id = s.stripe_subscription_id
            and i.replacement_finished_at is null
       )
  ) then
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
    subscription_period_id, replaces_subscription_id, livemode
  )
  values (
    v_invoice, v_user, v_sub, v_customer,
    'paid', v_reason, v_amount, v_currency, v_start, v_end,
    v_period_id, case when v_upgrade then v_replaces else null end, false
  )
  on conflict (stripe_invoice_id) do update
    set status = 'paid',
        amount_paid = excluded.amount_paid,
        currency = excluded.currency,
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        subscription_period_id = coalesce(public.stripe_invoices.subscription_period_id, excluded.subscription_period_id),
        replaces_subscription_id = coalesce(public.stripe_invoices.replaces_subscription_id, excluded.replaces_subscription_id);

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
    'address_limit', v_limit,
    'replaces_subscription_id', case when v_upgrade then v_replaces else null end
  );
end;
$$;

revoke all on function public.apply_stripe_billing_event(text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.apply_stripe_billing_event(text, text, boolean, jsonb) to postgres, service_role;

drop function if exists public.reserve_stripe_upgrade_checkout(uuid);

create or replace function public.reserve_stripe_upgrade_checkout(
  p_user uuid,
  p_plan text default 'pro'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer text;
  v_url text;
  v_session text;
  v_expires timestamptz;
  v_claim timestamptz;
  v_open integer;
  v_replaces text;
  v_period uuid;
  v_current text;
  v_plan text := nullif(trim(coalesce(p_plan, '')), '');
begin
  if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
    return jsonb_build_object('action', 'forbidden');
  end if;
  if v_plan is null then
    v_plan := 'pro';
  end if;
  if v_plan not in ('abo', 'pro') then
    return jsonb_build_object('action', 'ineligible');
  end if;

  perform pg_advisory_xact_lock(hashtext('pvn_checkout'), hashtext(p_user::text));

  select sp.id, sp.plan_key into v_period, v_current
    from public.subscription_periods sp
   where sp.user_id = p_user
     and sp.period_start <= now()
     and now() < sp.period_end
   order by sp.period_start desc, sp.period_end desc
   limit 1;

  if v_period is null or not (
    (v_current = 'pvnavigator_starter' and v_plan in ('abo', 'pro'))
    or (v_current = 'pvnavigator_abo' and v_plan = 'pro')
  ) then
    return jsonb_build_object('action', 'ineligible');
  end if;

  if exists (
    select 1
      from public.subscription_periods sp
     where sp.user_id = p_user
       and sp.period_start <= now()
       and now() < sp.period_end
       and (
         (v_plan = 'pro' and sp.plan_key = 'pvnavigator_pro')
         or (v_plan = 'abo' and sp.plan_key in ('pvnavigator_abo', 'pvnavigator_pro'))
       )
  ) then
    return jsonb_build_object('action', 'ineligible');
  end if;

  select count(*)::integer into v_open
    from public.stripe_subscriptions s
   where s.user_id = p_user
     and s.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused');

  if v_open > 1 then
    return jsonb_build_object('action', 'pending');
  end if;

  if v_open = 1 then
    select s.stripe_subscription_id into v_replaces
      from public.stripe_subscriptions s
     where s.user_id = p_user
       and s.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused')
     limit 1;
  else
    select s.stripe_subscription_id into v_replaces
      from public.stripe_subscriptions s
     where s.user_id = p_user
     order by s.updated_at desc
     limit 1;
  end if;

  select c.stripe_customer_id into v_customer
    from public.stripe_customers c
   where c.user_id = p_user;

  select claim.session_id, claim.session_url, claim.session_expires_at, claim.claim_until
    into v_session, v_url, v_expires, v_claim
    from public.stripe_checkout_claims claim
   where claim.user_id = p_user;

  if v_url is not null and v_expires is not null and v_expires > now() + interval '5 minutes' then
    return jsonb_build_object(
      'action', 'reuse',
      'url', v_url,
      'session_id', v_session,
      'customer_id', v_customer,
      'replaces_subscription_id', v_replaces,
      'period_id', v_period,
      'plan', v_plan
    );
  end if;

  if v_claim is not null and v_claim > now() then
    return jsonb_build_object('action', 'busy');
  end if;

  insert into public.stripe_checkout_claims (user_id, claim_until)
  values (p_user, now() + interval '30 seconds')
  on conflict (user_id) do update
    set claim_until = excluded.claim_until;

  return jsonb_build_object(
    'action', 'create',
    'customer_id', v_customer,
    'session_id', v_session,
    'replaces_subscription_id', v_replaces,
    'period_id', v_period,
    'plan', v_plan
  );
end;
$$;

revoke all on function public.reserve_stripe_upgrade_checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_stripe_upgrade_checkout(uuid, text) to postgres, service_role;
