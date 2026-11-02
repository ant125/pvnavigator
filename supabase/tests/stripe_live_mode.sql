-- Live and sandbox billing on one local database. Does not call Stripe.
-- A failure rolls the block back. Success removes only the rows it created.

do $$
declare
  v_live uuid := gen_random_uuid();
  v_test uuid := gen_random_uuid();
  v_prices jsonb := jsonb_build_array(
    jsonb_build_object('price_id', 'price_live_starter', 'amount', 900, 'currency', 'eur', 'plan_key', 'pvnavigator_starter', 'address_limit', 10),
    jsonb_build_object('price_id', 'price_live_abo', 'amount', 2900, 'currency', 'eur', 'plan_key', 'pvnavigator_abo', 'address_limit', 50),
    jsonb_build_object('price_id', 'price_live_pro', 'amount', 5900, 'currency', 'eur', 'plan_key', 'pvnavigator_pro', 'address_limit', 200)
  );
  v_start timestamptz := now() - interval '1 minute';
  v_end timestamptz := now() + interval '30 days';
  v_next timestamptz := v_end + interval '30 days';
  v_result jsonb;
  v_periods integer;
  v_mode boolean;
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
      (v_live, 'live-mode@example.com'),
      (v_test, 'sandbox-mode@example.com')
  ) as users(id, email);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         now(), now(), now()
  from (
    values
      (v_live, 'live-mode@example.com'),
      (v_test, 'sandbox-mode@example.com')
  ) as users(id, email);

  v_result := public.apply_stripe_billing_event(
    'evt_live_link', 'checkout.session.completed', true,
    jsonb_build_object('action', 'link_customer', 'user_id', v_live, 'customer_id', 'cus_live')
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'live checkout link failed: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_live) <> 0 then
    raise exception 'checkout completion opened a paid period';
  end if;
  select livemode into v_mode from public.stripe_customers where stripe_customer_id = 'cus_live';
  if v_mode is not true then
    raise exception 'live customer was stored in the wrong mode';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_live_create', 'invoice.paid', true,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_live, 'customer_id', 'cus_live',
      'subscription_id', 'sub_live', 'invoice_id', 'in_live',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_live_starter', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'processed'
     or v_result->>'plan_key' <> 'pvnavigator_starter'
     or v_result->>'address_limit' <> '10' then
    raise exception 'live STARTER payment was not granted: %', v_result;
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_live_create', 'invoice.paid', true,
    jsonb_build_object('action', 'invoice_paid', 'user_id', v_live, 'customer_id', 'cus_live', 'invoice_id', 'in_live')
  );
  if v_result->>'outcome' <> 'duplicate' then
    raise exception 'repeated live event was applied again: %', v_result;
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_live_create_late', 'invoice.paid', true,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_live, 'customer_id', 'cus_live',
      'subscription_id', 'sub_live', 'invoice_id', 'in_live',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_live_starter', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'late live webhook was not accepted: %', v_result;
  end if;
  select count(*) into v_periods from public.subscription_periods where external_ref = 'in_live';
  if v_periods <> 1 then
    raise exception 'late live webhook opened another period';
  end if;
  select livemode into v_mode from public.stripe_invoices where stripe_invoice_id = 'in_live';
  if v_mode is not true then
    raise exception 'live invoice was stored in the wrong mode';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_live_failed', 'invoice.payment_failed', true,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_live, 'customer_id', 'cus_live',
      'subscription_id', 'sub_live', 'invoice_id', 'in_live_failed',
      'billing_reason', 'subscription_cycle'
    )
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'live payment failure was not recorded: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where external_ref = 'in_live_failed') <> 0 then
    raise exception 'a failed live renewal opened a period';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_live_renewal', 'invoice.paid', true,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_live, 'customer_id', 'cus_live',
      'subscription_id', 'sub_live', 'invoice_id', 'in_live_renewal',
      'billing_reason', 'subscription_cycle', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_live_starter', 'allowed_prices', v_prices,
      'period_start', v_end, 'period_end', v_next
    )
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'live renewal was not granted: %', v_result;
  end if;
  select count(*) into v_periods from public.subscription_periods where user_id = v_live;
  if v_periods <> 2 then
    raise exception 'live renewal did not add exactly one period, count %', v_periods;
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_live_cancel', 'customer.subscription.updated', true,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_live, 'customer_id', 'cus_live',
      'subscription_id', 'sub_live', 'status', 'active', 'cancel_at_period_end', true,
      'current_period_start', v_start, 'current_period_end', v_end,
      'price_id', 'price_live_starter', 'latest_invoice_id', 'in_live_renewal',
      'event_created', 10
    )
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'live cancellation was not stored: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_live) <> 2 then
    raise exception 'cancellation changed the paid periods';
  end if;
  if not exists (
    select 1 from public.stripe_subscriptions
     where stripe_subscription_id = 'sub_live' and cancel_at_period_end and livemode
  ) then
    raise exception 'live subscription was not marked to end with the period';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_live_mixed', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_live, 'customer_id', 'cus_live',
      'subscription_id', 'sub_live', 'invoice_id', 'in_live_mixed',
      'billing_reason', 'subscription_cycle', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_live_starter', 'allowed_prices', v_prices,
      'period_start', v_next, 'period_end', v_next + interval '30 days'
    )
  );
  if v_result->>'outcome' <> 'ignored' or v_result->>'reason' <> 'customer_mode' then
    raise exception 'sandbox event was applied to a live customer: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_live) <> 2 then
    raise exception 'a mixed-mode event changed the live periods';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_sandbox_create', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_test, 'customer_id', 'cus_sandbox',
      'subscription_id', 'sub_sandbox', 'invoice_id', 'in_sandbox',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_live_abo', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'processed'
     or v_result->>'plan_key' <> 'pvnavigator_abo'
     or v_result->>'address_limit' <> '50' then
    raise exception 'sandbox ABO payment was not granted: %', v_result;
  end if;
  select livemode into v_mode from public.stripe_customers where stripe_customer_id = 'cus_sandbox';
  if v_mode is not false then
    raise exception 'sandbox customer was stored as live';
  end if;

  delete from public.stripe_events where stripe_event_id like 'evt_live_%' or stripe_event_id like 'evt_sandbox_%';
  delete from auth.identities where user_id in (v_live, v_test);
  delete from auth.users where id in (v_live, v_test);
end;
$$;
