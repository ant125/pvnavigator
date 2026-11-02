-- Failed monthly renewal bookkeeping. One transaction: a failure rolls every row back.
-- Does not call Stripe. The void and cancel themselves are covered in failedRenewal.test.ts.

do $$
declare
  v_user uuid := gen_random_uuid();
  v_prices jsonb := jsonb_build_array(
    jsonb_build_object('price_id', 'price_abo', 'amount', 2900, 'currency', 'eur', 'plan_key', 'pvnavigator_abo', 'address_limit', 50),
    jsonb_build_object('price_id', 'price_pro', 'amount', 5900, 'currency', 'eur', 'plan_key', 'pvnavigator_pro', 'address_limit', 200)
  );
  v_start timestamptz := now() - interval '40 days';
  v_end timestamptz := now() - interval '10 days';
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_count integer;
  v_status text;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
    'failed-renewal@example.com', extensions.crypt('TestNutzer-2026!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_user, v_user::text, 'email',
    jsonb_build_object('sub', v_user::text, 'email', 'failed-renewal@example.com', 'email_verified', true),
    now(), now(), now()
  );

  v_result := public.apply_stripe_billing_event(
    'evt_renewal_paid', 'invoice.paid', false,
    jsonb_build_object(
      'action', 'invoice_paid', 'user_id', v_user, 'customer_id', 'cus_renewal',
      'subscription_id', 'sub_renewal', 'invoice_id', 'in_renewal_paid',
      'billing_reason', 'subscription_create', 'amount_paid', 2900, 'currency', 'eur',
      'price_id', 'price_abo', 'allowed_prices', v_prices,
      'period_start', v_start, 'period_end', v_end, 'replaces_subscription_id', null
    )
  );
  if v_result->>'outcome' <> 'processed' then
    raise exception 'paid month was not stored: %', v_result;
  end if;

  select to_jsonb(sp.*) into v_before
    from public.subscription_periods sp
   where sp.external_ref = 'in_renewal_paid';

  -- A failed monthly renewal records the invoice and does not open a period.
  v_result := public.apply_stripe_billing_event(
    'evt_renewal_fail', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_user, 'customer_id', 'cus_renewal',
      'subscription_id', 'sub_renewal', 'invoice_id', 'in_renewal_fail',
      'billing_reason', 'subscription_cycle'
    )
  );
  if v_result->>'action' <> 'invoice_failed' then
    raise exception 'failed renewal was not recorded: %', v_result;
  end if;
  if (select status from public.stripe_invoices where stripe_invoice_id = 'in_renewal_fail') <> 'payment_failed' then
    raise exception 'failed renewal invoice was not stored as payment_failed';
  end if;
  if (select billing_reason from public.stripe_invoices where stripe_invoice_id = 'in_renewal_fail') <> 'subscription_cycle' then
    raise exception 'failed renewal lost its billing reason';
  end if;
  if (select subscription_period_id from public.stripe_invoices where stripe_invoice_id = 'in_renewal_fail') is not null then
    raise exception 'failed renewal was linked to a period';
  end if;
  select count(*) into v_count from public.subscription_periods where user_id = v_user;
  if v_count <> 1 then
    raise exception 'failed renewal opened a period, count %', v_count;
  end if;
  select to_jsonb(sp.*) into v_after
    from public.subscription_periods sp
   where sp.external_ref = 'in_renewal_paid';
  if v_after is distinct from v_before then
    raise exception 'failed renewal changed the paid period';
  end if;

  -- A repeated failure must not reopen a paid invoice or its period.
  v_result := public.apply_stripe_billing_event(
    'evt_renewal_fail_paid', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_user, 'customer_id', 'cus_renewal',
      'subscription_id', 'sub_renewal', 'invoice_id', 'in_renewal_paid',
      'billing_reason', 'subscription_cycle'
    )
  );
  if (select status from public.stripe_invoices where stripe_invoice_id = 'in_renewal_paid') <> 'paid' then
    raise exception 'payment_failed reopened a paid invoice: %', v_result;
  end if;
  if (select subscription_period_id from public.stripe_invoices where stripe_invoice_id = 'in_renewal_paid') is null then
    raise exception 'payment_failed detached the paid period';
  end if;

  -- The follow-up marks a Stripe-paid invoice as paid before a period exists.
  -- A later payment_failed must leave that status in place.
  update public.stripe_invoices
     set status = 'paid'
   where stripe_invoice_id = 'in_renewal_fail'
     and subscription_period_id is null;
  v_result := public.apply_stripe_billing_event(
    'evt_renewal_fail_observed_paid', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_user, 'customer_id', 'cus_renewal',
      'subscription_id', 'sub_renewal', 'invoice_id', 'in_renewal_fail',
      'billing_reason', 'subscription_cycle'
    )
  );
  if (select status from public.stripe_invoices where stripe_invoice_id = 'in_renewal_fail') <> 'paid' then
    raise exception 'payment_failed reopened an observed paid invoice: %', v_result;
  end if;
  if (select subscription_period_id from public.stripe_invoices where stripe_invoice_id = 'in_renewal_fail') is not null then
    raise exception 'observing a paid invoice opened a period';
  end if;

  -- A repeated failure must not reopen a voided invoice.
  update public.stripe_invoices
     set status = 'void'
   where stripe_invoice_id = 'in_renewal_fail';
  v_result := public.apply_stripe_billing_event(
    'evt_renewal_fail_again', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_user, 'customer_id', 'cus_renewal',
      'subscription_id', 'sub_renewal', 'invoice_id', 'in_renewal_fail',
      'billing_reason', 'subscription_cycle'
    )
  );
  if (select status from public.stripe_invoices where stripe_invoice_id = 'in_renewal_fail') <> 'void' then
    raise exception 'payment_failed reopened a void invoice: %', v_result;
  end if;

  -- A failed first checkout still does not change the paid subscription.
  v_status := (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_renewal');
  v_result := public.apply_stripe_billing_event(
    'evt_renewal_checkout_fail', 'invoice.payment_failed', false,
    jsonb_build_object(
      'action', 'invoice_failed', 'user_id', v_user, 'customer_id', 'cus_renewal',
      'subscription_id', 'sub_checkout', 'invoice_id', 'in_checkout_fail',
      'billing_reason', 'subscription_create'
    )
  );
  if (select status from public.stripe_subscriptions where stripe_subscription_id = 'sub_renewal') is distinct from v_status then
    raise exception 'a failed checkout changed the paid subscription';
  end if;
  if (select count(*) from public.subscription_periods where external_ref = 'in_checkout_fail') <> 0 then
    raise exception 'a failed checkout opened a period';
  end if;

  -- Once the old subscription is canceled and its period has ended, checkout can start again.
  update public.stripe_subscriptions
     set status = 'canceled',
         cancel_at_period_end = false,
         status_event_created = floor(extract(epoch from now()))::bigint
   where stripe_subscription_id = 'sub_renewal';
  v_result := public.reserve_stripe_checkout(v_user);
  if v_result->>'action' <> 'create' then
    raise exception 'checkout stayed blocked after the renewal was closed: %', v_result;
  end if;

  delete from public.stripe_events where stripe_event_id like 'evt_renewal_%';
  delete from auth.identities where user_id = v_user;
  delete from auth.users where id = v_user;
end;
$$;
