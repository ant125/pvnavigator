-- STARTER invoice grant. Requires supabase/migrations/20261020191245_starter_paid_period.sql
-- on the local database. Does not call Stripe and does not change existing rows.
-- One transaction: a failure rolls every row back. Success deletes the users it created.

do $$
declare
  v_starter uuid := gen_random_uuid();
  v_abo uuid := gen_random_uuid();
  v_pro uuid := gen_random_uuid();
  v_prices jsonb := jsonb_build_array(
    jsonb_build_object('price_id', 'price_starter', 'amount', 900, 'currency', 'eur', 'plan_key', 'pvnavigator_starter', 'address_limit', 10),
    jsonb_build_object('price_id', 'price_abo', 'amount', 2900, 'currency', 'eur', 'plan_key', 'pvnavigator_abo', 'address_limit', 50),
    jsonb_build_object('price_id', 'price_pro', 'amount', 5900, 'currency', 'eur', 'plan_key', 'pvnavigator_pro', 'address_limit', 200)
  );
  v_start timestamptz := now() - interval '1 minute';
  v_end timestamptz := now() + interval '30 days';
  v_result jsonb;
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
      (v_starter, 'starter-period@example.com'),
      (v_abo, 'starter-abo-control@example.com'),
      (v_pro, 'starter-pro-control@example.com')
  ) as users(id, email);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         now(), now(), now()
  from (
    values
      (v_starter, 'starter-period@example.com'),
      (v_abo, 'starter-abo-control@example.com'),
      (v_pro, 'starter-pro-control@example.com')
  ) as users(id, email);

  v_result := public.apply_stripe_billing_event(
    'evt_starter_unknown', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_starter, 'customer_id', 'cus_starter',
      'subscription_id', 'sub_starter', 'invoice_id', 'in_starter_unknown',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_custom', 'allowed_prices',
      jsonb_build_array(jsonb_build_object(
        'price_id', 'price_custom', 'amount', 900, 'currency', 'eur',
        'plan_key', 'pvnavigator_custom', 'address_limit', 10
      )),
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'ignored' or v_result->>'reason' <> 'not_our_price' then
    raise exception 'unknown plan was granted: %', v_result;
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_starter_wrong_amount', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_starter, 'customer_id', 'cus_starter',
      'subscription_id', 'sub_starter', 'invoice_id', 'in_starter_wrong_amount',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'ignored' or v_result->>'reason' <> 'not_our_price' then
    raise exception 'STARTER was granted at the ABO amount: %', v_result;
  end if;

  select count(*) into v_count from public.subscription_periods where user_id = v_starter;
  if v_count <> 0 then
    raise exception 'a rejected invoice opened a STARTER period';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_starter_create', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_starter, 'customer_id', 'cus_starter',
      'subscription_id', 'sub_starter', 'invoice_id', 'in_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'processed'
     or v_result->>'plan_key' <> 'pvnavigator_starter'
     or v_result->>'address_limit' <> '10' then
    raise exception 'STARTER payment was not granted: %', v_result;
  end if;

  select count(*) into v_count
    from public.subscription_periods
   where user_id = v_starter and plan_key = 'pvnavigator_starter' and address_limit = 10;
  if v_count <> 1 then
    raise exception 'STARTER period was not stored with 10 addresses';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_starter_failed', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_starter, 'customer_id', 'cus_starter',
      'subscription_id', 'sub_starter', 'invoice_id', 'in_starter_failed',
      'billing_reason', 'subscription_cycle'
    )
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'failed STARTER renewal was not recorded: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where external_ref = 'in_starter_failed') <> 0 then
    raise exception 'a failed STARTER renewal opened a period';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_starter_schedule', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_plan_change', 'user_id', v_starter, 'customer_id', 'cus_starter',
      'subscription_id', 'sub_starter', 'scheduled_plan_key', 'pvnavigator_starter',
      'scheduled_effective_at', v_end, 'event_created', floor(extract(epoch from now()))::bigint
    )
  );
  if v_result->>'outcome' <> 'ignored' or v_result->>'reason' <> 'plan_change_shape' then
    raise exception 'STARTER was accepted as a period-end switch: %', v_result;
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_starter_abo_control', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_abo, 'customer_id', 'cus_starter_abo',
      'subscription_id', 'sub_starter_abo', 'invoice_id', 'in_starter_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'processed'
     or v_result->>'plan_key' <> 'pvnavigator_abo'
     or v_result->>'address_limit' <> '50' then
    raise exception 'ABO payment changed: %', v_result;
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_starter_pro_control', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_pro, 'customer_id', 'cus_starter_pro',
      'subscription_id', 'sub_starter_pro', 'invoice_id', 'in_starter_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end
    )
  );
  if v_result->>'outcome' <> 'processed'
     or v_result->>'plan_key' <> 'pvnavigator_pro'
     or v_result->>'address_limit' <> '200' then
    raise exception 'PRO payment changed: %', v_result;
  end if;

  delete from public.stripe_events where stripe_event_id like 'evt_starter_%';
  delete from auth.identities where user_id in (v_starter, v_abo, v_pro);
  delete from auth.users where id in (v_starter, v_abo, v_pro);
end;
$$;
