-- Local-only checks for immediate STARTER → ABO and STARTER → PRO.
-- One transaction: a failure rolls every row back. Success deletes the users it created.
-- Does not call Stripe and does not touch seeded or clock users.

do $$
declare
  v_starter uuid := gen_random_uuid();
  v_direct uuid := gen_random_uuid();
  v_cancel uuid := gen_random_uuid();
  v_abo uuid := gen_random_uuid();
  v_pro uuid := gen_random_uuid();
  v_foreign uuid := gen_random_uuid();
  v_prices jsonb := jsonb_build_array(
    jsonb_build_object('price_id', 'price_starter', 'amount', 900, 'currency', 'eur', 'plan_key', 'pvnavigator_starter', 'address_limit', 10),
    jsonb_build_object('price_id', 'price_abo', 'amount', 2900, 'currency', 'eur', 'plan_key', 'pvnavigator_abo', 'address_limit', 50),
    jsonb_build_object('price_id', 'price_pro', 'amount', 5900, 'currency', 'eur', 'plan_key', 'pvnavigator_pro', 'address_limit', 200)
  );
  v_old_start timestamptz := now() - interval '10 days';
  v_old_end timestamptz := now() + interval '40 days';
  v_new_start timestamptz := now() - interval '1 minute';
  v_new_end timestamptz := now() + interval '20 days';
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_access jsonb;
  v_count integer;
  v_period uuid;
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
      (v_starter, 'starter-up-main@example.com'),
      (v_direct, 'starter-up-direct@example.com'),
      (v_cancel, 'starter-up-cancel@example.com'),
      (v_abo, 'starter-up-abo@example.com'),
      (v_pro, 'starter-up-pro@example.com'),
      (v_foreign, 'starter-up-foreign@example.com')
  ) as users(id, email);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         now(), now(), now()
  from (
    values
      (v_starter, 'starter-up-main@example.com'),
      (v_direct, 'starter-up-direct@example.com'),
      (v_cancel, 'starter-up-cancel@example.com'),
      (v_abo, 'starter-up-abo@example.com'),
      (v_pro, 'starter-up-pro@example.com'),
      (v_foreign, 'starter-up-foreign@example.com')
  ) as users(id, email);

  v_result := public.apply_stripe_billing_event(
    'evt_stup_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_starter, 'customer_id', 'cus_stup_starter',
      'subscription_id', 'sub_stup_starter', 'invoice_id', 'in_stup_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  if v_result->>'plan_key' <> 'pvnavigator_starter' or v_result->>'address_limit' <> '10' then
    raise exception 'STARTER payment was not granted: %', v_result;
  end if;
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_stup_starter';
  select sp.id into v_period
    from public.subscription_periods sp where sp.external_ref = 'in_stup_starter';
  insert into public.subscription_period_addresses (period_id, user_id, address_key, address_label)
  values (v_period, v_starter, 'alte-adresse', 'Alte Adresse');

  if public.reserve_stripe_upgrade_checkout(v_starter, 'starter')->>'action' <> 'ineligible' then
    raise exception 'STARTER to STARTER was allowed';
  end if;
  v_result := public.reserve_stripe_upgrade_checkout(v_starter, 'abo');
  if v_result->>'action' <> 'create'
     or v_result->>'plan' <> 'abo'
     or v_result->>'replaces_subscription_id' <> 'sub_stup_starter'
  then
    raise exception 'STARTER to ABO was not reserved: %', v_result;
  end if;
  if public.reserve_stripe_upgrade_checkout(v_starter, 'pro')->>'action' <> 'busy' then
    raise exception 'a second upgrade checkout was not blocked';
  end if;
  perform public.release_stripe_checkout_claim(v_starter);
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_stup_starter';
  if v_after is distinct from v_before then
    raise exception 'reserving checkout changed the STARTER period';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_stup_fail', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_starter, 'customer_id', 'cus_stup_starter',
      'subscription_id', 'sub_stup_abo', 'invoice_id', 'in_stup_failed',
      'billing_reason', 'subscription_create'
    )
  );
  if v_result->>'action' <> 'invoice_failed' then
    raise exception 'failed upgrade was not recorded: %', v_result;
  end if;
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_stup_starter') <> 'active' then
    raise exception 'failed upgrade changed the STARTER subscription';
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_starter) <> 1 then
    raise exception 'failed upgrade opened a period';
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_stup_wrong_amount', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_starter, 'customer_id', 'cus_stup_starter',
      'subscription_id', 'sub_stup_abo', 'invoice_id', 'in_stup_wrong',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_new_start, 'period_end', v_new_end,
      'replaces_subscription_id', 'sub_stup_starter'
    )
  );
  if v_result->>'reason' <> 'not_our_price' then
    raise exception 'an underpaid ABO upgrade was granted: %', v_result;
  end if;

  v_result := public.apply_stripe_billing_event(
    'evt_stup_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_starter, 'customer_id', 'cus_stup_starter',
      'subscription_id', 'sub_stup_abo', 'invoice_id', 'in_stup_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_new_start, 'period_end', v_new_end,
      'replaces_subscription_id', 'sub_stup_starter'
    )
  );
  if v_result->>'plan_key' <> 'pvnavigator_abo'
     or v_result->>'address_limit' <> '50'
     or v_result->>'replaces_subscription_id' <> 'sub_stup_starter'
  then
    raise exception 'STARTER to ABO was not granted: %', v_result;
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_stup_starter';
  if v_after is distinct from v_before then
    raise exception 'ABO payment rewrote the STARTER period';
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_starter and plan_key = 'pvnavigator_abo') <> 1 then
    raise exception 'ABO upgrade did not create exactly one period';
  end if;
  v_access := private.decide_calculation_access(v_starter, 'neue-adresse');
  if v_access->>'allowed' <> 'true'
     or (v_access->'subscription'->>'address_limit')::integer <> 50
     or (v_access->'subscription'->>'used_addresses')::integer <> 0
  then
    raise exception 'old STARTER quota stayed usable: %', v_access;
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_stup_abo', 'invoice.paid', false, '{}'::jsonb
  );
  if v_result->>'outcome' <> 'duplicate' then
    raise exception 'repeated ABO event was not a duplicate: %', v_result;
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_stup_abo_again', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_starter, 'customer_id', 'cus_stup_starter',
      'subscription_id', 'sub_stup_abo', 'invoice_id', 'in_stup_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_new_start, 'period_end', v_new_end,
      'replaces_subscription_id', 'sub_stup_starter'
    )
  );
  if (select count(*) from public.subscription_periods where user_id = v_starter and plan_key = 'pvnavigator_abo') <> 1 then
    raise exception 'replaying the ABO invoice created another period';
  end if;

  perform public.release_stripe_checkout_claim(v_starter);
  if public.reserve_stripe_upgrade_checkout(v_starter, 'pro')->>'action' <> 'pending' then
    raise exception 'a second upgrade was allowed while the STARTER subscription was still open';
  end if;
  perform public.apply_stripe_billing_event(
    'evt_stup_starter_ended', 'customer.subscription.deleted', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_starter, 'customer_id', 'cus_stup_starter',
      'subscription_id', 'sub_stup_starter', 'status', 'canceled', 'event_created', 30,
      'cancel_at_period_end', false
    )
  );
  if public.reserve_stripe_upgrade_checkout(v_starter, 'abo')->>'action' <> 'ineligible' then
    raise exception 'ABO to ABO was allowed';
  end if;
  perform public.release_stripe_checkout_claim(v_starter);
  v_result := public.reserve_stripe_upgrade_checkout(v_starter);
  if v_result->>'action' <> 'create' or v_result->>'plan' <> 'pro' then
    raise exception 'ABO to PRO was not reserved: %', v_result;
  end if;
  perform public.release_stripe_checkout_claim(v_starter);

  -- Direct STARTER → PRO, full 59 EUR, 200 new addresses.
  perform public.apply_stripe_billing_event(
    'evt_stup_direct_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_direct, 'customer_id', 'cus_stup_direct',
      'subscription_id', 'sub_stup_direct_starter', 'invoice_id', 'in_stup_direct_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  v_result := public.reserve_stripe_upgrade_checkout(v_direct, 'pro');
  if v_result->>'action' <> 'create' or v_result->>'replaces_subscription_id' <> 'sub_stup_direct_starter' then
    raise exception 'STARTER to PRO was not reserved: %', v_result;
  end if;
  perform public.release_stripe_checkout_claim(v_direct);
  v_result := public.apply_stripe_billing_event(
    'evt_stup_direct_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_direct, 'customer_id', 'cus_stup_direct',
      'subscription_id', 'sub_stup_direct_pro', 'invoice_id', 'in_stup_direct_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_new_start, 'period_end', v_new_end,
      'replaces_subscription_id', 'sub_stup_direct_starter'
    )
  );
  if v_result->>'plan_key' <> 'pvnavigator_pro' or v_result->>'address_limit' <> '200' then
    raise exception 'STARTER to PRO was not granted: %', v_result;
  end if;
  v_access := private.decide_calculation_access(v_direct, 'pro-adresse');
  if (v_access->'subscription'->>'address_limit')::integer <> 200
     or (v_access->'subscription'->>'used_addresses')::integer <> 0
  then
    raise exception 'STARTER quota remained after PRO: %', v_access;
  end if;
  if (select address_limit from public.subscription_periods where external_ref = 'in_stup_direct_starter') <> 10 then
    raise exception 'the old STARTER limit was rewritten';
  end if;

  -- Canceled STARTER with a still-valid period can switch.
  perform public.apply_stripe_billing_event(
    'evt_stup_cancel_pay', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_cancel, 'customer_id', 'cus_stup_cancel',
      'subscription_id', 'sub_stup_cancel', 'invoice_id', 'in_stup_cancel',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_stup_cancel_status', 'customer.subscription.deleted', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_cancel, 'customer_id', 'cus_stup_cancel',
      'subscription_id', 'sub_stup_cancel', 'status', 'canceled', 'event_created', 20,
      'cancel_at_period_end', false
    )
  );
  v_result := public.reserve_stripe_upgrade_checkout(v_cancel, 'abo');
  if v_result->>'action' <> 'create' or v_result->>'replaces_subscription_id' <> 'sub_stup_cancel' then
    raise exception 'canceled STARTER was not eligible: %', v_result;
  end if;
  perform public.release_stripe_checkout_claim(v_cancel);

  -- ABO cannot move to STARTER or to another ABO. PRO cannot move at all.
  perform public.apply_stripe_billing_event(
    'evt_stup_abo_user', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_abo, 'customer_id', 'cus_stup_abo_user',
      'subscription_id', 'sub_stup_abo_user', 'invoice_id', 'in_stup_abo_user',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  if public.reserve_stripe_upgrade_checkout(v_abo, 'abo')->>'action' <> 'ineligible' then
    raise exception 'an ABO user was allowed to buy ABO again';
  end if;
  if public.reserve_stripe_upgrade_checkout(v_abo, 'starter')->>'action' <> 'ineligible' then
    raise exception 'a downgrade to STARTER was allowed';
  end if;
  perform public.apply_stripe_billing_event(
    'evt_stup_pro_user', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_pro, 'customer_id', 'cus_stup_pro_user',
      'subscription_id', 'sub_stup_pro_user', 'invoice_id', 'in_stup_pro_user',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  if public.reserve_stripe_upgrade_checkout(v_pro, 'pro')->>'action' <> 'ineligible'
     or public.reserve_stripe_upgrade_checkout(v_pro, 'abo')->>'action' <> 'ineligible'
  then
    raise exception 'a PRO user was offered an immediate change';
  end if;

  perform public.apply_stripe_billing_event(
    'evt_stup_foreign_sub', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_foreign, 'customer_id', 'cus_stup_foreign',
      'subscription_id', 'sub_stup_foreign', 'status', 'active', 'event_created', 5,
      'cancel_at_period_end', false
    )
  );
  v_result := public.apply_stripe_billing_event(
    'evt_stup_foreign_pay', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_direct, 'customer_id', 'cus_stup_direct',
      'subscription_id', 'sub_stup_foreign_new', 'invoice_id', 'in_stup_foreign',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_new_start + interval '1 day', 'period_end', v_new_end + interval '1 day',
      'replaces_subscription_id', 'sub_stup_foreign'
    )
  );
  if v_result->>'reason' <> 'second_subscription' then
    raise exception 'a foreign subscription was accepted: %', v_result;
  end if;
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_stup_foreign') <> 'active' then
    raise exception 'the foreign subscription was changed';
  end if;
  select count(*) into v_count from public.subscription_periods where external_ref = 'in_stup_foreign';
  if v_count <> 0 then
    raise exception 'a foreign replacement opened a period';
  end if;

  delete from public.stripe_events where stripe_event_id like 'evt_stup_%';
  delete from auth.identities
   where user_id in (v_starter, v_direct, v_cancel, v_abo, v_pro, v_foreign);
  delete from auth.users
   where id in (v_starter, v_direct, v_cancel, v_abo, v_pro, v_foreign);
end;
$$;
