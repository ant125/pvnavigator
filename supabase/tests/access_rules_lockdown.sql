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

  insert into public.free_addresses (user_id, address_key, address_label, calculation_id)
  values (v_free, 'lockdown-existing-pin', 'Bestehende Adresse', v_legacy);

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

  begin
    perform public.record_completed_calculation(
      '   ',
      'Leer',
      jsonb_build_object(
        'product_key', 'speicher_grenze', 'name', 'Leer',
        'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
        'input_schema_version', 'speicher-grenze-input/v1',
        'result_schema_version', 'speicher-grenze-result/v2'
      )
    );
    raise exception 'blank address was allowed';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%PVN_ACCESS_DENIED:invalid_address%' then
        raise exception 'unexpected blank-address refusal: %', sqlerrm;
      end if;
  end;

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
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'open_access' then
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
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'open_access' then
    raise exception 'recalculation was refused: %', v_result;
  end if;

  v_result := public.record_completed_calculation(
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
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'open_access' then
    raise exception 'second free address was refused: %', v_result;
  end if;
  select count(*) into v_count from public.free_addresses where user_id = v_free;
  if v_count <> 1 then
    raise exception 'existing free address row changed: %', v_count;
  end if;
  if (select address_key from public.free_addresses where user_id = v_free) <> 'lockdown-existing-pin' then
    raise exception 'existing free address was rewritten';
  end if;
  select count(*) into v_count from public.calculations where user_id = v_free and id <> v_legacy;
  if v_count <> 3 then
    raise exception 'free account did not keep every new calculation: %', v_count;
  end if;

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
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'open_access' then
    raise exception 'STARTER address was not recorded as free: %', v_result;
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
    'lockdown-starter-c', 'Starter C',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'Starter C',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  if v_result->>'reason' <> 'open_access' then
    raise exception 'former STARTER account was still quota-limited: %', v_result;
  end if;
  select count(*) into v_count from public.calculations where user_id = v_starter;
  if v_count <> 3 then
    raise exception 'STARTER account did not keep every calculation: %', v_count;
  end if;
  select count(*) into v_count
    from public.subscription_period_addresses spa
    join public.subscription_periods sp on sp.id = spa.period_id
   where sp.user_id = v_starter;
  if v_count <> 0 then
    raise exception 'open access consumed a subscription quota: %', v_count;
  end if;
  if (select address_limit from public.subscription_periods where user_id = v_starter) <> 2 then
    raise exception 'existing STARTER period was rewritten';
  end if;

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
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'open_access' then
    raise exception 'ABO account was not recorded as free: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_abo) <> 1 then
    raise exception 'existing ABO period was removed';
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
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'open_access' then
    raise exception 'PRO account was not recorded as free: %', v_result;
  end if;
  if (select count(*) from public.subscription_periods where user_id = v_pro) <> 1 then
    raise exception 'existing PRO period was removed';
  end if;

  execute 'reset role';
  if (select count(*) from public.calculations where id = v_legacy) <> 1 then
    raise exception 'legacy calculation was removed';
  end if;
  if (select count(*) from auth.users where id in (v_free, v_other, v_starter, v_abo, v_pro)) <> 5 then
    raise exception 'test accounts were removed';
  end if;
end $$;

rollback;
