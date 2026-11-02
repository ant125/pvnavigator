-- Local-only checks for a finished immediate upgrade.
-- A confirmed replacement does not stay open, and a paid Checkout Session is
-- not reused. One transaction: a failure rolls every row back.
-- Does not call Stripe and does not touch seeded or real accounts.

do $$
declare
  v_chain uuid := gen_random_uuid();
  v_direct uuid := gen_random_uuid();
  v_blocked uuid := gen_random_uuid();
  v_prices jsonb := jsonb_build_array(
    jsonb_build_object('price_id', 'price_starter', 'amount', 900, 'currency', 'eur', 'plan_key', 'pvnavigator_starter', 'address_limit', 10),
    jsonb_build_object('price_id', 'price_abo', 'amount', 2900, 'currency', 'eur', 'plan_key', 'pvnavigator_abo', 'address_limit', 50),
    jsonb_build_object('price_id', 'price_pro', 'amount', 5900, 'currency', 'eur', 'plan_key', 'pvnavigator_pro', 'address_limit', 200)
  );
  v_old_start timestamptz := now() - interval '10 days';
  v_old_end timestamptz := now() + interval '40 days';
  v_abo_start timestamptz := now() - interval '1 minute';
  v_abo_end timestamptz := now() + interval '20 days';
  v_pro_start timestamptz := now() - interval '30 seconds';
  v_pro_end timestamptz := now() + interval '25 days';
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_access jsonb;
  v_count integer;
  v_finished timestamptz;
  v_claim timestamptz;
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
      (v_chain, 'finished-up-chain@example.com'),
      (v_direct, 'finished-up-direct@example.com'),
      (v_blocked, 'finished-up-blocked@example.com')
  ) as users(id, email);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         now(), now(), now()
  from (
    values
      (v_chain, 'finished-up-chain@example.com'),
      (v_direct, 'finished-up-direct@example.com'),
      (v_blocked, 'finished-up-blocked@example.com')
  ) as users(id, email);

  -- STARTER → ABO. The paid invoice does not cancel STARTER by itself.
  perform public.apply_stripe_billing_event(
    'evt_fin_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_chain, 'customer_id', 'cus_fin_chain',
      'subscription_id', 'sub_fin_starter', 'invoice_id', 'in_fin_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  v_result := public.reserve_stripe_upgrade_checkout(v_chain, 'abo');
  if v_result->>'action' <> 'create' or v_result->>'replaces_subscription_id' <> 'sub_fin_starter' then
    raise exception 'STARTER to ABO was not reserved: %', v_result;
  end if;
  perform public.release_stripe_checkout_claim(v_chain);
  v_result := public.apply_stripe_billing_event(
    'evt_fin_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_chain, 'customer_id', 'cus_fin_chain',
      'subscription_id', 'sub_fin_abo', 'invoice_id', 'in_fin_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end,
      'replaces_subscription_id', 'sub_fin_starter'
    )
  );
  if v_result->>'plan_key' <> 'pvnavigator_abo' or v_result->>'address_limit' <> '50' then
    raise exception 'STARTER to ABO was not granted: %', v_result;
  end if;
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_starter') <> 'active' then
    raise exception 'the ABO invoice canceled STARTER before the replacement finished';
  end if;
  perform public.release_stripe_checkout_claim(v_chain);
  if public.reserve_stripe_upgrade_checkout(v_chain, 'pro')->>'action' <> 'pending' then
    raise exception 'ABO to PRO was allowed while STARTER was still open';
  end if;

  -- The old finisher stored the confirmation without changing the local status.
  update public.stripe_invoices
     set replacement_finished_at = now() - interval '2 hours'
   where stripe_invoice_id = 'in_fin_abo';
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_starter') <> 'active' then
    raise exception 'recording the confirmation changed the subscription';
  end if;
  perform public.release_stripe_checkout_claim(v_chain);
  v_result := public.reserve_stripe_upgrade_checkout(v_chain, 'pro');
  if v_result->>'action' <> 'create'
     or v_result->>'replaces_subscription_id' <> 'sub_fin_abo'
  then
    raise exception 'a finished STARTER replacement still blocked ABO to PRO: %', v_result;
  end if;
  perform public.release_stripe_checkout_claim(v_chain);

  select replacement_finished_at into v_finished
    from public.stripe_invoices where stripe_invoice_id = 'in_fin_abo';
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_fin_starter';
  perform public.complete_subscription_replacement('in_fin_abo');
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_starter') <> 'canceled' then
    raise exception 'completing the replacement left STARTER open';
  end if;
  if (select replacement_finished_at from public.stripe_invoices where stripe_invoice_id = 'in_fin_abo') <> v_finished then
    raise exception 'completing an already finished replacement rewrote the timestamp';
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_fin_starter';
  if v_after is distinct from v_before then
    raise exception 'completing the replacement rewrote the STARTER period';
  end if;
  perform public.complete_subscription_replacement('in_fin_abo');
  if (select replacement_finished_at from public.stripe_invoices where stripe_invoice_id = 'in_fin_abo') <> v_finished
     or (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_starter') <> 'canceled'
  then
    raise exception 'repeating the completion changed the finished replacement';
  end if;

  -- A later open snapshot must not reactivate the replaced subscription.
  perform public.apply_stripe_billing_event(
    'evt_fin_starter_reopen', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_chain, 'customer_id', 'cus_fin_chain',
      'subscription_id', 'sub_fin_starter', 'status', 'active', 'event_created', 500,
      'cancel_at_period_end', false
    )
  );
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_starter') <> 'canceled' then
    raise exception 'a late webhook reactivated the replaced STARTER subscription';
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_fin_abo', 'invoice.paid', false, '{}'::jsonb
  );
  if v_result->>'outcome' <> 'duplicate' then
    raise exception 'repeated ABO event was not a duplicate: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_chain and plan_key = 'pvnavigator_abo') <> 1 then
    raise exception 'replaying the ABO invoice created another period';
  end if;

  -- The paid ABO session stays reusable until that exact session is closed.
  perform public.store_stripe_checkout_session(
    v_chain, 'cs_fin_abo', 'https://checkout.stripe.com/c/pay/cs_fin_abo', now() + interval '20 hours'
  );
  v_result := public.reserve_stripe_upgrade_checkout(v_chain, 'pro');
  if v_result->>'action' <> 'reuse' or v_result->>'session_id' <> 'cs_fin_abo' then
    raise exception 'the stored ABO session was not offered for inspection: %', v_result;
  end if;
  perform public.release_stripe_checkout_claim(v_chain);
  if (select session_id from public.stripe_checkout_claims where user_id = v_chain) <> 'cs_fin_abo' then
    raise exception 'releasing the 30-second lock deleted the checkout session';
  end if;
  perform public.close_completed_stripe_checkout_session(v_chain, 'cs_fin_other');
  if (select session_id from public.stripe_checkout_claims where user_id = v_chain) <> 'cs_fin_abo' then
    raise exception 'closing a different session deleted the ABO session';
  end if;
  perform public.close_completed_stripe_checkout_session(v_chain, 'cs_fin_abo');
  if exists (
    select 1 from public.stripe_checkout_claims
     where user_id = v_chain
       and (session_id is not null or session_url is not null or session_expires_at is not null)
  ) then
    raise exception 'the completed ABO session stayed on the claim';
  end if;
  v_result := public.reserve_stripe_upgrade_checkout(v_chain, 'pro');
  if v_result->>'action' <> 'create'
     or v_result->>'replaces_subscription_id' <> 'sub_fin_abo'
     or v_result->>'session_id' is not null
  then
    raise exception 'ABO to PRO did not start a new checkout: %', v_result;
  end if;
  select claim_until into v_claim from public.stripe_checkout_claims where user_id = v_chain;
  if v_claim is null or v_claim <= now() then
    raise exception 'the new checkout did not keep the 30-second reservation';
  end if;
  if public.reserve_stripe_upgrade_checkout(v_chain, 'pro')->>'action' <> 'busy' then
    raise exception 'a second checkout was not blocked for 30 seconds';
  end if;
  perform public.release_stripe_checkout_claim(v_chain);

  -- A newer open session survives closing the old paid session.
  perform public.store_stripe_checkout_session(
    v_chain, 'cs_fin_open', 'https://checkout.stripe.com/c/pay/cs_fin_open', now() + interval '20 hours'
  );
  perform public.close_completed_stripe_checkout_session(v_chain, 'cs_fin_abo');
  v_result := public.reserve_stripe_upgrade_checkout(v_chain, 'pro');
  if v_result->>'action' <> 'reuse' or v_result->>'session_id' <> 'cs_fin_open' then
    raise exception 'an open session was removed with the old paid session: %', v_result;
  end if;
  perform public.close_completed_stripe_checkout_session(v_chain, 'cs_fin_open');

  -- ABO → PRO grants 200 addresses and does not rewrite the older periods.
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_fin_abo';
  v_result := public.apply_stripe_billing_event(
    'evt_fin_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_chain, 'customer_id', 'cus_fin_chain',
      'subscription_id', 'sub_fin_pro', 'invoice_id', 'in_fin_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_fin_abo'
    )
  );
  if v_result->>'outcome' <> 'processed'
     or v_result->>'plan_key' <> 'pvnavigator_pro'
     or v_result->>'address_limit' <> '200'
     or v_result->>'replaces_subscription_id' <> 'sub_fin_abo'
  then
    raise exception 'ABO to PRO was not granted: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_chain and plan_key = 'pvnavigator_pro') <> 1 then
    raise exception 'ABO to PRO did not create exactly one PRO period';
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_fin_abo';
  if v_after is distinct from v_before then
    raise exception 'the PRO invoice rewrote the ABO period';
  end if;
  if (select address_limit from public.subscription_periods where external_ref = 'in_fin_starter') <> 10 then
    raise exception 'the STARTER limit was rewritten';
  end if;
  v_access := private.decide_calculation_access(v_chain, 'neue-adresse');
  if (v_access->'subscription'->>'address_limit')::integer <> 200 then
    raise exception 'PRO did not become the usable quota: %', v_access;
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_fin_pro_again', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_chain, 'customer_id', 'cus_fin_chain',
      'subscription_id', 'sub_fin_pro', 'invoice_id', 'in_fin_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_fin_abo'
    )
  );
  select count(*) into v_count
    from public.subscription_periods where user_id = v_chain and plan_key = 'pvnavigator_pro';
  if v_count <> 1 then
    raise exception 'replaying the PRO invoice created another period, count %', v_count;
  end if;
  perform public.complete_subscription_replacement('in_fin_pro');
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_abo') <> 'canceled' then
    raise exception 'completing PRO left ABO open';
  end if;
  perform public.apply_stripe_billing_event(
    'evt_fin_abo_reopen', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_chain, 'customer_id', 'cus_fin_chain',
      'subscription_id', 'sub_fin_abo', 'status', 'active', 'event_created', 800,
      'cancel_at_period_end', false
    )
  );
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_abo') <> 'canceled' then
    raise exception 'a late webhook reactivated the replaced ABO subscription';
  end if;

  -- STARTER → PRO closes STARTER only when the replacement is completed.
  perform public.apply_stripe_billing_event(
    'evt_fin_direct_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_direct, 'customer_id', 'cus_fin_direct',
      'subscription_id', 'sub_fin_direct_starter', 'invoice_id', 'in_fin_direct_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_fin_direct_starter';
  v_result := public.apply_stripe_billing_event(
    'evt_fin_direct_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_direct, 'customer_id', 'cus_fin_direct',
      'subscription_id', 'sub_fin_direct_pro', 'invoice_id', 'in_fin_direct_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_fin_direct_starter'
    )
  );
  if v_result->>'plan_key' <> 'pvnavigator_pro' or v_result->>'address_limit' <> '200' then
    raise exception 'STARTER to PRO was not granted: %', v_result;
  end if;
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_direct_starter') <> 'active' then
    raise exception 'STARTER was canceled before the replacement finished';
  end if;
  perform public.complete_subscription_replacement('in_fin_direct_pro');
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_direct_starter') <> 'canceled' then
    raise exception 'STARTER to PRO left STARTER open';
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_fin_direct_starter';
  if v_after is distinct from v_before
     or (select address_limit from public.subscription_periods where external_ref = 'in_fin_direct_starter') <> 10
  then
    raise exception 'STARTER to PRO rewrote the old period';
  end if;
  v_access := private.decide_calculation_access(v_direct, 'pro-adresse');
  if (v_access->'subscription'->>'address_limit')::integer <> 200 then
    raise exception 'STARTER quota remained after PRO: %', v_access;
  end if;

  -- A cancel that has not succeeded still blocks. The old row stays open.
  perform public.apply_stripe_billing_event(
    'evt_fin_blocked_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_blocked, 'customer_id', 'cus_fin_blocked',
      'subscription_id', 'sub_fin_blocked_starter', 'invoice_id', 'in_fin_blocked_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_fin_blocked_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_blocked, 'customer_id', 'cus_fin_blocked',
      'subscription_id', 'sub_fin_blocked_abo', 'invoice_id', 'in_fin_blocked_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end,
      'replaces_subscription_id', 'sub_fin_blocked_starter'
    )
  );
  if (select replacement_finished_at from public.stripe_invoices where stripe_invoice_id = 'in_fin_blocked_abo') is not null
     or (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_blocked_starter') <> 'active'
  then
    raise exception 'an unfinished replacement was marked canceled';
  end if;
  perform public.release_stripe_checkout_claim(v_blocked);
  if public.reserve_stripe_upgrade_checkout(v_blocked, 'pro')->>'action' <> 'pending' then
    raise exception 'an unfinished replacement allowed the next checkout';
  end if;
  v_result := public.apply_stripe_billing_event(
    'evt_fin_blocked_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_blocked, 'customer_id', 'cus_fin_blocked',
      'subscription_id', 'sub_fin_blocked_pro', 'invoice_id', 'in_fin_blocked_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_fin_blocked_abo'
    )
  );
  if v_result->>'reason' <> 'second_subscription' then
    raise exception 'an unfinished replacement did not block PRO: %', v_result;
  end if;
  select count(*) into v_count
    from public.subscription_periods where external_ref = 'in_fin_blocked_pro';
  if v_count <> 0
     or (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_fin_blocked_starter') <> 'active'
  then
    raise exception 'a blocked PRO invoice changed the open subscriptions';
  end if;

  delete from public.stripe_events where stripe_event_id like 'evt_fin_%';
  delete from auth.identities where user_id in (v_chain, v_direct, v_blocked);
  delete from auth.users where id in (v_chain, v_direct, v_blocked);
end;
$$;
