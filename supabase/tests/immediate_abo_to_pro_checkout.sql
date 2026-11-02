-- Local-only checks for the immediate ABO → PRO checkout.
-- One transaction: a failure rolls every row back. Success deletes the users it created.
-- Does not call Stripe and does not touch seeded or clock users.

do $$
declare
  v_active uuid := gen_random_uuid();
  v_cancel uuid := gen_random_uuid();
  v_blocked uuid := gen_random_uuid();
  v_foreign uuid := gen_random_uuid();
  v_prices jsonb := jsonb_build_array(
    jsonb_build_object('price_id', 'price_abo', 'amount', 2900, 'currency', 'eur', 'plan_key', 'pvnavigator_abo', 'address_limit', 50),
    jsonb_build_object('price_id', 'price_pro', 'amount', 5900, 'currency', 'eur', 'plan_key', 'pvnavigator_pro', 'address_limit', 200)
  );
  v_abo_start timestamptz := now() - interval '10 days';
  v_abo_end timestamptz := now() + interval '40 days';
  v_pro_start timestamptz := now() - interval '1 minute';
  v_pro_end timestamptz := now() + interval '20 days';
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_invoice_before jsonb;
  v_finished timestamptz;
  v_access jsonb;
  v_count integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
    email, extensions.crypt('TestNutzer-2026!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  from (
    values
      (v_active, 'phase-a-active@example.com'),
      (v_cancel, 'phase-a-cancel@example.com'),
      (v_blocked, 'phase-a-blocked@example.com'),
      (v_foreign, 'phase-a-foreign@example.com')
  ) as users(id, email);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         now(), now(), now()
  from (
    values
      (v_active, 'phase-a-active@example.com'),
      (v_cancel, 'phase-a-cancel@example.com'),
      (v_blocked, 'phase-a-blocked@example.com'),
      (v_foreign, 'phase-a-foreign@example.com')
  ) as users(id, email);

  -- Active ABO, paid 29 EUR, one period of 50.
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_abo_create', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_abo', 'invoice_id', 'in_phasea_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end, 'replaces_subscription_id', null
    )
  );
  if v_result->>'outcome' <> 'processed' or v_result->>'address_limit' <> '50' then
    raise exception 'active ABO payment was not granted: %', v_result;
  end if;

  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp
   where sp.external_ref = 'in_phasea_abo';
  select to_jsonb(i.*) into v_invoice_before
    from public.stripe_invoices i
   where i.stripe_invoice_id = 'in_phasea_abo';

  -- Parallel upgrade checkouts: the second request waits, and nothing is changed.
  v_result := public.reserve_stripe_upgrade_checkout(v_active);
  if v_result->>'action' <> 'create' or v_result->>'replaces_subscription_id' <> 'sub_phasea_abo' then
    raise exception 'upgrade reserve did not name the ABO subscription: %', v_result;
  end if;
  if public.reserve_stripe_upgrade_checkout(v_active)->>'action' <> 'busy' then
    raise exception 'a second upgrade checkout was not blocked';
  end if;
  perform public.release_stripe_checkout_claim(v_active);
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_phasea_abo';
  if v_after is distinct from v_before then
    raise exception 'reserving checkout changed the ABO period';
  end if;

  -- Abandoned checkout and a failed payment leave the ABO period and subscription alone.
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_pay_fail', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_pro', 'invoice_id', 'in_phasea_failed',
      'billing_reason', 'subscription_create'
    )
  );
  if v_result->>'action' <> 'invoice_failed' then
    raise exception 'failed payment was not recorded: %', v_result;
  end if;
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_phasea_abo') <> 'active' then
    raise exception 'failed payment changed the ABO subscription';
  end if;
  select count(*) into v_count from public.subscription_periods where user_id = v_active;
  if v_count <> 1 then
    raise exception 'failed payment opened a period, count %', v_count;
  end if;

  -- Successful 59 EUR payment. Old period and old invoice stay byte-for-byte.
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_pro_create', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_pro', 'invoice_id', 'in_phasea_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_phasea_abo'
    )
  );
  if v_result->>'outcome' <> 'processed'
     or v_result->>'plan_key' <> 'pvnavigator_pro'
     or v_result->>'address_limit' <> '200'
     or v_result->>'replaces_subscription_id' <> 'sub_phasea_abo'
  then
    raise exception 'PRO payment was not granted: %', v_result;
  end if;

  select count(*) into v_count
    from public.subscription_periods
   where user_id = v_active and plan_key = 'pvnavigator_pro' and address_limit = 200;
  if v_count <> 1 then
    raise exception 'expected one PRO period, found %', v_count;
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_phasea_abo';
  if v_after is distinct from v_before then
    raise exception 'PRO payment rewrote the ABO period';
  end if;
  select to_jsonb(i.*) into v_after
    from public.stripe_invoices i where i.stripe_invoice_id = 'in_phasea_abo';
  if v_after is distinct from v_invoice_before then
    raise exception 'PRO payment rewrote the ABO invoice';
  end if;
  if (
    select replaces_subscription_id is null or replacement_finished_at is not null
      from public.stripe_invoices where stripe_invoice_id = 'in_phasea_pro'
  ) then
    raise exception 'PRO invoice did not keep a pending replacement';
  end if;

  v_access := private.decide_calculation_access(v_active, 'marienplatz-1');
  if v_access->>'allowed' <> 'true'
     or (v_access->'subscription'->>'address_limit')::integer <> 200
  then
    raise exception 'PRO period did not win access: %', v_access;
  end if;

  -- Repeated invoice.paid, same event and a new delivery of the same invoice.
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_pro_create', 'invoice.paid', false, '{}'::jsonb
  );
  if v_result->>'outcome' <> 'duplicate' then
    raise exception 'repeated event was not a duplicate: %', v_result;
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_pro_create_again', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_pro', 'invoice_id', 'in_phasea_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_phasea_abo'
    )
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'invoice replay was rejected: %', v_result;
  end if;
  select count(*) into v_count
    from public.subscription_periods where user_id = v_active and plan_key = 'pvnavigator_pro';
  if v_count <> 1 then
    raise exception 'invoice replay created another PRO period, count %', v_count;
  end if;

  -- A newer PRO snapshot is not overwritten by an older event.
  perform public.apply_stripe_billing_event(
    'evt_phasea_pro_status_new', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_pro', 'status', 'active', 'event_created', 50,
      'cancel_at_period_end', false, 'price_id', 'price_pro'
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_phasea_pro_status_old', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_pro', 'status', 'canceled', 'event_created', 10,
      'cancel_at_period_end', false, 'price_id', 'price_pro'
    )
  );
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_phasea_pro') <> 'active' then
    raise exception 'an older event overwrote the PRO subscription';
  end if;

  -- A late ABO webhook does not add a period or change the PRO period.
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_phasea_pro';
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_abo_late', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_abo', 'invoice_id', 'in_phasea_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end
    )
  );
  if v_result->>'reason' <> 'second_subscription' then
    raise exception 'late ABO replay changed billing state: %', v_result;
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_abo_cycle_late', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_abo', 'invoice_id', 'in_phasea_abo_cycle',
      'billing_reason', 'subscription_cycle', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_pro_end, 'period_end', v_pro_end + interval '30 days'
    )
  );
  if v_result->>'reason' <> 'second_subscription' then
    raise exception 'late ABO cycle was granted: %', v_result;
  end if;
  select count(*) into v_count from public.subscription_periods where user_id = v_active and plan_key = 'pvnavigator_abo';
  if v_count <> 1 then
    raise exception 'late ABO webhook added a period, count %', v_count;
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_phasea_pro';
  if v_after is distinct from v_before then
    raise exception 'late ABO webhook changed the PRO period';
  end if;

  -- Ending the old subscription can be retried. The second call changes nothing.
  if not exists (
    select 1 from public.list_pending_subscription_replacements() p
     where p.stripe_invoice_id = 'in_phasea_pro' and p.replaces_subscription_id = 'sub_phasea_abo'
  ) then
    raise exception 'pending replacement was not listed';
  end if;
  perform public.complete_subscription_replacement('in_phasea_pro');
  select replacement_finished_at into v_finished
    from public.stripe_invoices where stripe_invoice_id = 'in_phasea_pro';
  if v_finished is null then
    raise exception 'replacement was not marked finished';
  end if;
  perform public.complete_subscription_replacement('in_phasea_pro');
  if (select replacement_finished_at from public.stripe_invoices where stripe_invoice_id = 'in_phasea_pro') <> v_finished then
    raise exception 'repeating the completion changed the timestamp';
  end if;
  if exists (
    select 1 from public.list_pending_subscription_replacements() p
     where p.stripe_invoice_id = 'in_phasea_pro'
  ) then
    raise exception 'finished replacement is still pending';
  end if;

  -- Canceled ABO with a still-valid period can switch immediately.
  perform public.apply_stripe_billing_event(
    'evt_phasea_cancel_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_cancel, 'customer_id', 'cus_phasea_cancel',
      'subscription_id', 'sub_phasea_cancel_abo', 'invoice_id', 'in_phasea_cancel_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_phasea_cancel_status', 'customer.subscription.deleted', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_cancel, 'customer_id', 'cus_phasea_cancel',
      'subscription_id', 'sub_phasea_cancel_abo', 'status', 'canceled', 'event_created', 20,
      'cancel_at_period_end', false
    )
  );
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_phasea_cancel_abo';
  v_result := public.reserve_stripe_upgrade_checkout(v_cancel);
  if v_result->>'action' <> 'create' or v_result->>'replaces_subscription_id' <> 'sub_phasea_cancel_abo' then
    raise exception 'canceled ABO was not eligible: %', v_result;
  end if;
  perform public.release_stripe_checkout_claim(v_cancel);
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_cancel_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_cancel, 'customer_id', 'cus_phasea_cancel',
      'subscription_id', 'sub_phasea_cancel_pro', 'invoice_id', 'in_phasea_cancel_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_phasea_cancel_abo'
    )
  );
  if v_result->>'address_limit' <> '200' then
    raise exception 'canceled ABO did not switch to PRO: %', v_result;
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_phasea_cancel_abo';
  if v_after is distinct from v_before then
    raise exception 'switching a canceled ABO rewrote its period';
  end if;

  -- A second open subscription that is not the named ABO blocks the switch.
  perform public.apply_stripe_billing_event(
    'evt_phasea_blocked_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_blocked, 'customer_id', 'cus_phasea_blocked',
      'subscription_id', 'sub_phasea_blocked_abo', 'invoice_id', 'in_phasea_blocked_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_phasea_blocked_extra', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_blocked, 'customer_id', 'cus_phasea_blocked',
      'subscription_id', 'sub_phasea_blocked_extra', 'status', 'active', 'event_created', 5,
      'cancel_at_period_end', false
    )
  );
  if public.reserve_stripe_upgrade_checkout(v_blocked)->>'action' <> 'pending' then
    raise exception 'two open subscriptions were allowed to start checkout';
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_blocked_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_blocked, 'customer_id', 'cus_phasea_blocked',
      'subscription_id', 'sub_phasea_blocked_pro', 'invoice_id', 'in_phasea_blocked_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_phasea_blocked_abo'
    )
  );
  if v_result->>'reason' <> 'second_subscription' then
    raise exception 'an extra subscription did not block PRO: %', v_result;
  end if;
  select count(*) into v_count
    from public.subscription_periods where user_id = v_blocked and plan_key = 'pvnavigator_pro';
  if v_count <> 0 then
    raise exception 'a blocked switch still opened PRO';
  end if;

  -- A subscription owned by someone else is not an authorized replacement.
  perform public.apply_stripe_billing_event(
    'evt_phasea_foreign_sub', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_foreign, 'customer_id', 'cus_phasea_foreign',
      'subscription_id', 'sub_phasea_foreign', 'status', 'active', 'event_created', 5,
      'cancel_at_period_end', false
    )
  );
  v_result := public.apply_stripe_billing_event(
    'evt_phasea_foreign_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_active, 'customer_id', 'cus_phasea_active',
      'subscription_id', 'sub_phasea_foreign_pro', 'invoice_id', 'in_phasea_foreign_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start + interval '1 day', 'period_end', v_pro_end + interval '1 day',
      'replaces_subscription_id', 'sub_phasea_foreign'
    )
  );
  if v_result->>'reason' <> 'second_subscription' then
    raise exception 'a foreign subscription was accepted as the ABO to replace: %', v_result;
  end if;
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_phasea_foreign') <> 'active' then
    raise exception 'the foreign subscription was changed';
  end if;
  select count(*) into v_count
    from public.subscription_periods where external_ref = 'in_phasea_foreign_pro';
  if v_count <> 0 then
    raise exception 'a foreign replacement opened a PRO period';
  end if;

  delete from public.stripe_events where stripe_event_id like 'evt_phasea_%';
  delete from auth.identities
   where user_id in (v_active, v_cancel, v_blocked, v_foreign);
  delete from auth.users
   where id in (v_active, v_cancel, v_blocked, v_foreign);
end;
$$;
