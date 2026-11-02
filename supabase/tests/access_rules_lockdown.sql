-- Local check for the calculation INSERT lockdown.
-- One transaction, always rolled back. Requires the revoke to already be applied.
-- Covers direct INSERT refusal, RPC save, recalculation, free and paid quotas,
-- RLS reads, and the remaining UPDATE grant.

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_free uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_starter uuid := gen_random_uuid();
  v_abo uuid := gen_random_uuid();
  v_pro uuid := gen_random_uuid();
  v_legacy uuid;
  v_id uuid;
  v_result jsonb;
  v_count integer;
  v_tier text;
  v_name text;
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
      (v_free, 'lockdown-free@example.com'),
      (v_other, 'lockdown-other@example.com'),
      (v_starter, 'lockdown-starter@example.com'),
      (v_abo, 'lockdown-abo@example.com'),
      (v_pro, 'lockdown-pro@example.com')
  ) as users(id, email);

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), id, id::text, 'email',
         jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
         now(), now(), now()
  from (
    values
      (v_free, 'lockdown-free@example.com'),
      (v_other, 'lockdown-other@example.com'),
      (v_starter, 'lockdown-starter@example.com'),
      (v_abo, 'lockdown-abo@example.com'),
      (v_pro, 'lockdown-pro@example.com')
  ) as users(id, email);

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version
  )
  values (
    v_free, 'speicher_grenze', 'Bestand', '{}'::jsonb, '{}'::jsonb,
    'speicher-grenze-input/v1', 'speicher-grenze-result/v2'
  )
  returning id into v_legacy;

  insert into public.subscription_periods (
    user_id, plan_key, period_start, period_end, address_limit, source
  )
  values
    (v_starter, 'pvnavigator_starter', now() - interval '1 minute', now() + interval '30 days', 2, 'test'),
    (v_abo, 'pvnavigator_abo', now() - interval '1 minute', now() + interval '30 days', 50, 'test'),
    (v_pro, 'pvnavigator_pro', now() - interval '1 minute', now() + interval '30 days', 200, 'test');

  if has_column_privilege('authenticated', 'public.calculations', 'user_id', 'INSERT') then
    raise exception 'authenticated can still insert calculations';
  end if;
  if not has_table_privilege('authenticated', 'public.calculations', 'SELECT') then
    raise exception 'authenticated lost SELECT on calculations';
  end if;
  if not has_table_privilege('authenticated', 'public.calculations', 'DELETE') then
    raise exception 'reviewed lockdown unexpectedly removed DELETE';
  end if;
  if not has_column_privilege('authenticated', 'public.calculations', 'name', 'UPDATE') then
    raise exception 'authenticated lost the name UPDATE grant';
  end if;
  if has_column_privilege('authenticated', 'public.calculations', 'access_tier', 'UPDATE') then
    raise exception 'authenticated can update access_tier';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_free::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_free, 'role', 'authenticated')::text,
    true
  );

  begin
    insert into public.calculations (
      user_id, product_key, name, input, result_snapshot,
      input_schema_version, result_schema_version
    )
    values (
      v_free, 'speicher_grenze', 'Direkt', '{}'::jsonb, '{}'::jsonb,
      'speicher-grenze-input/v1', 'speicher-grenze-result/v2'
    );
    raise exception 'direct insert was allowed';
  exception
    when insufficient_privilege then
      null;
  end;

  select count(*) into v_count from public.calculations where id = v_legacy;
  if v_count <> 1 then
    raise exception 'owner cannot read an existing calculation';
  end if;

  v_result := public.record_completed_calculation(
    'lockdown-free-a',
    'Freie Adresse',
    jsonb_build_object(
      'product_key', 'speicher_grenze',
      'name', 'Erste freie Berechnung',
      'input', jsonb_build_object('street', 'Testweg'),
      'result_snapshot', jsonb_build_object('ok', true),
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2',
      'battery_model_version', 'test',
      'summary_address', 'Freie Adresse',
      'summary_pv_kwp', 8,
      'summary_consumption_kwh', 4200
    )
  );
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'free_claim_pending' then
    raise exception 'first free save was not recorded: %', v_result;
  end if;
  v_id := (v_result->>'calculation_id')::uuid;

  v_result := public.record_completed_calculation(
    'lockdown-free-a',
    'Freie Adresse',
    jsonb_build_object(
      'product_key', 'speicher_grenze',
      'name', 'Erneute Berechnung',
      'input', '{}'::jsonb,
      'result_snapshot', jsonb_build_object('ok', true),
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2',
      'summary_pv_kwp', 8,
      'summary_consumption_kwh', 4200
    )
  );
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'free_address' then
    raise exception 'recalculation of the free address was refused: %', v_result;
  end if;
  select count(*) into v_count from public.free_addresses where user_id = v_free;
  if v_count <> 1 then
    raise exception 'free address was pinned more than once: %', v_count;
  end if;

  begin
    perform public.record_completed_calculation(
      'lockdown-free-b',
      'Andere Adresse',
      jsonb_build_object(
        'product_key', 'speicher_grenze',
        'name', 'Zweite Adresse',
        'input', '{}'::jsonb,
        'result_snapshot', '{}'::jsonb,
        'input_schema_version', 'speicher-grenze-input/v1',
        'result_schema_version', 'speicher-grenze-result/v2'
      )
    );
    raise exception 'second free address was allowed';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%PVN_ACCESS_DENIED:free_address_mismatch%' then
        raise exception 'unexpected free refusal: %', sqlerrm;
      end if;
  end;

  update public.calculations set name = 'Umbenannt' where id = v_id;
  select name, access_tier into v_name, v_tier from public.calculations where id = v_id;
  if v_name <> 'Umbenannt' or v_tier <> 'free' then
    raise exception 'owned update did not keep the stored tier: % / %', v_name, v_tier;
  end if;

  begin
    update public.calculations set access_tier = 'paid' where id = v_id;
    raise exception 'access tier update was allowed';
  exception
    when insufficient_privilege then
      null;
  end;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  select count(*) into v_count from public.calculations where id = v_id or id = v_legacy;
  if v_count <> 0 then
    raise exception 'another account can read the calculations';
  end if;

  perform set_config('request.jwt.claim.sub', v_starter::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_starter, 'role', 'authenticated')::text,
    true
  );
  v_result := public.record_completed_calculation(
    'lockdown-starter-a', 'Starter A',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'Starter A',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  if v_result->>'access_tier' <> 'paid' or v_result->>'reason' <> 'subscription_new_address' then
    raise exception 'STARTER address was not counted: %', v_result;
  end if;
  perform public.record_completed_calculation(
    'lockdown-starter-b', 'Starter B',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'Starter B',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  v_result := public.record_completed_calculation(
    'lockdown-starter-a', 'Starter A',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'Starter A erneut',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  if v_result->>'reason' <> 'subscription_known_address' then
    raise exception 'known STARTER address was counted again: %', v_result;
  end if;
  -- The paid quota is full, and this account has not pinned a free address yet.
  -- That one free address is still available; only the address after it is refused.
  v_result := public.record_completed_calculation(
    'lockdown-starter-c', 'Starter C',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'Starter C',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'free_claim_pending' then
    raise exception 'address after the STARTER quota did not use the free claim: %', v_result;
  end if;
  select count(*) into v_count
    from public.subscription_period_addresses spa
    join public.subscription_periods sp on sp.id = spa.period_id
   where sp.user_id = v_starter and sp.plan_key = 'pvnavigator_starter';
  if v_count <> 2 then
    raise exception 'STARTER quota count is %', v_count;
  end if;
  select count(*) into v_count from public.free_addresses where user_id = v_starter;
  if v_count <> 1 then
    raise exception 'STARTER free claim count is %', v_count;
  end if;
  begin
    perform public.record_completed_calculation(
      'lockdown-starter-d', 'Starter D',
      jsonb_build_object(
        'product_key', 'speicher_grenze', 'name', 'Starter D',
        'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
        'input_schema_version', 'speicher-grenze-input/v1',
        'result_schema_version', 'speicher-grenze-result/v2'
      )
    );
    raise exception 'address beyond STARTER quota and the free claim was allowed';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%PVN_ACCESS_DENIED:subscription_limit_reached%' then
        raise exception 'unexpected STARTER refusal: %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_abo::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_abo, 'role', 'authenticated')::text,
    true
  );
  v_result := public.record_completed_calculation(
    'lockdown-abo-a', 'ABO',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'ABO',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  if v_result->>'access_tier' <> 'paid' then
    raise exception 'ABO save was not paid: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_pro::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_pro, 'role', 'authenticated')::text,
    true
  );
  v_result := public.record_completed_calculation(
    'lockdown-pro-a', 'PRO',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'PRO',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  if v_result->>'access_tier' <> 'paid' then
    raise exception 'PRO save was not paid: %', v_result;
  end if;
end $$;

rollback;
