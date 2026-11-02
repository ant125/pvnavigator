-- Local-only checks for a finished replacement whose subscription status
-- stayed open. One transaction: a failure rolls every row back.
-- Does not call Stripe and does not touch seeded or real accounts.

do $$
declare
  v_stale uuid := gen_random_uuid();
  v_open uuid := gen_random_uuid();
  v_chain uuid := gen_random_uuid();
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
  v_finished timestamptz;
  v_sync boolean;
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
      (v_stale, 'status-sync-stale@example.com'),
      (v_open, 'status-sync-open@example.com'),
      (v_chain, 'status-sync-chain@example.com')
  ) as users(id, email);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         now(), now(), now()
  from (
    values
      (v_stale, 'status-sync-stale@example.com'),
      (v_open, 'status-sync-open@example.com'),
      (v_chain, 'status-sync-chain@example.com')
  ) as users(id, email);

  -- Finished replacement, local status still active. The follow-up lists it
  -- for a status sync and does not treat it as a new cancellation.
  perform public.apply_stripe_billing_event(
    'evt_sync_stale_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_stale, 'customer_id', 'cus_sync_stale',
      'subscription_id', 'sub_sync_stale_starter', 'invoice_id', 'in_sync_stale_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_sync_stale_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_stale, 'customer_id', 'cus_sync_stale',
      'subscription_id', 'sub_sync_stale_abo', 'invoice_id', 'in_sync_stale_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end,
      'replaces_subscription_id', 'sub_sync_stale_starter'
    )
  );
  update public.stripe_invoices
     set replacement_finished_at = now() - interval '2 hours'
   where stripe_invoice_id = 'in_sync_stale_abo';
  insert into public.subscription_period_addresses (period_id, user_id, address_key, address_label)
  select sp.id, v_stale, 'alte-adresse', 'Alte Adresse'
    from public.subscription_periods sp
   where sp.external_ref = 'in_sync_stale_starter';
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_sync_stale_starter';
  select to_jsonb(i.*) into v_after
    from public.stripe_invoices i where i.stripe_invoice_id = 'in_sync_stale_abo';
  select p.status_sync_only into v_sync
    from public.list_pending_subscription_replacements() p
   where p.stripe_invoice_id = 'in_sync_stale_abo';
  if v_sync is not true then
    raise exception 'a finished replacement with an open local status was not listed for sync';
  end if;
  select replacement_finished_at into v_finished
    from public.stripe_invoices where stripe_invoice_id = 'in_sync_stale_abo';
  perform public.complete_subscription_replacement('in_sync_stale_abo');
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_sync_stale_starter') <> 'canceled' then
    raise exception 'the stale STARTER status stayed open';
  end if;
  if (select replacement_finished_at from public.stripe_invoices where stripe_invoice_id = 'in_sync_stale_abo') <> v_finished then
    raise exception 'status sync rewrote replacement_finished_at';
  end if;
  if (select to_jsonb(i.*) from public.stripe_invoices i where i.stripe_invoice_id = 'in_sync_stale_abo') is distinct from v_after then
    raise exception 'status sync rewrote the paid ABO invoice';
  end if;
  if (select to_jsonb(sp.*) from public.subscription_periods sp where sp.external_ref = 'in_sync_stale_starter') is distinct from v_before then
    raise exception 'status sync rewrote the STARTER period';
  end if;
  if (select count(*) from public.subscription_period_addresses spa
        join public.subscription_periods sp on sp.id = spa.period_id
       where sp.external_ref = 'in_sync_stale_starter') <> 1 then
    raise exception 'status sync changed the historical address use';
  end if;
  if exists (
    select 1 from public.list_pending_subscription_replacements() p
     where p.stripe_invoice_id = 'in_sync_stale_abo'
  ) then
    raise exception 'a synchronized replacement is still listed';
  end if;
  perform public.complete_subscription_replacement('in_sync_stale_abo');
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_sync_stale_starter') <> 'canceled'
     or (select replacement_finished_at from public.stripe_invoices where stripe_invoice_id = 'in_sync_stale_abo') <> v_finished
     or (select to_jsonb(sp.*) from public.subscription_periods sp where sp.external_ref = 'in_sync_stale_starter') is distinct from v_before
  then
    raise exception 'repeating the status sync changed stored billing data';
  end if;
  perform public.apply_stripe_billing_event(
    'evt_sync_stale_reopen', 'customer.subscription.updated', false,
    jsonb_build_object(
      'action', 'sync_subscription', 'user_id', v_stale, 'customer_id', 'cus_sync_stale',
      'subscription_id', 'sub_sync_stale_starter', 'status', 'active', 'event_created', 900,
      'cancel_at_period_end', false
    )
  );
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_sync_stale_starter') <> 'canceled' then
    raise exception 'a late active webhook reactivated the replaced subscription';
  end if;

  -- A cancellation that has not succeeded stays open and is not a status-only sync.
  perform public.apply_stripe_billing_event(
    'evt_sync_open_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_open, 'customer_id', 'cus_sync_open',
      'subscription_id', 'sub_sync_open_starter', 'invoice_id', 'in_sync_open_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_sync_open_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_open, 'customer_id', 'cus_sync_open',
      'subscription_id', 'sub_sync_open_abo', 'invoice_id', 'in_sync_open_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end,
      'replaces_subscription_id', 'sub_sync_open_starter'
    )
  );
  select p.status_sync_only into v_sync
    from public.list_pending_subscription_replacements() p
   where p.stripe_invoice_id = 'in_sync_open_abo';
  if v_sync is not false
     or (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_sync_open_starter') <> 'active'
     or (select replacement_finished_at from public.stripe_invoices where stripe_invoice_id = 'in_sync_open_abo') is not null
  then
    raise exception 'an unfinished replacement was treated as already canceled';
  end if;

  -- STARTER → ABO → PRO leaves only PRO open. Older periods keep their limits.
  perform public.apply_stripe_billing_event(
    'evt_sync_chain_starter', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_chain, 'customer_id', 'cus_sync_chain',
      'subscription_id', 'sub_sync_chain_starter', 'invoice_id', 'in_sync_chain_starter',
      'billing_reason', 'subscription_create', 'amount_paid', 900, 'currency', 'eur',
      'price_id', 'price_starter', 'allowed_prices', v_prices,
      'period_start', v_old_start, 'period_end', v_old_end
    )
  );
  perform public.apply_stripe_billing_event(
    'evt_sync_chain_abo', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_chain, 'customer_id', 'cus_sync_chain',
      'subscription_id', 'sub_sync_chain_abo', 'invoice_id', 'in_sync_chain_abo',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_abo_start, 'period_end', v_abo_end,
      'replaces_subscription_id', 'sub_sync_chain_starter'
    )
  );
  perform public.complete_subscription_replacement('in_sync_chain_abo');
  perform public.apply_stripe_billing_event(
    'evt_sync_chain_pro', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_chain, 'customer_id', 'cus_sync_chain',
      'subscription_id', 'sub_sync_chain_pro', 'invoice_id', 'in_sync_chain_pro',
      'billing_reason', 'subscription_create', 'amount_paid', 5900, 'currency', 'eur',
      'price_id', 'price_pro', 'allowed_prices', v_prices,
      'period_start', v_pro_start, 'period_end', v_pro_end,
      'replaces_subscription_id', 'sub_sync_chain_abo'
    )
  );
  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp where sp.external_ref = 'in_sync_chain_starter';
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp where sp.external_ref = 'in_sync_chain_abo';
  perform public.complete_subscription_replacement('in_sync_chain_pro');
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_sync_chain_starter') <> 'canceled'
     or (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_sync_chain_abo') <> 'canceled'
     or (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_sync_chain_pro') <> 'active'
  then
    raise exception 'STARTER to ABO to PRO did not leave only PRO open';
  end if;
  select count(*) into v_count
    from public.stripe_subscriptions
   where user_id = v_chain
     and status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused');
  if v_count <> 1 then
    raise exception 'more than PRO stayed open, count %', v_count;
  end if;
  if (select address_limit from public.subscription_periods where external_ref = 'in_sync_chain_starter') <> 10
     or (select address_limit from public.subscription_periods where external_ref = 'in_sync_chain_abo') <> 50
     or (select address_limit from public.subscription_periods where external_ref = 'in_sync_chain_pro') <> 200
     or (select to_jsonb(sp.*) from public.subscription_periods sp where sp.external_ref = 'in_sync_chain_starter') is distinct from v_before
     or (select to_jsonb(sp.*) from public.subscription_periods sp where sp.external_ref = 'in_sync_chain_abo') is distinct from v_after
  then
    raise exception 'completing the chain rewrote a historical period';
  end if;

  delete from public.stripe_events where stripe_event_id like 'evt_sync_%';
  delete from auth.identities where user_id in (v_stale, v_open, v_chain);
  delete from auth.users where id in (v_stale, v_open, v_chain);
end;
$$;
