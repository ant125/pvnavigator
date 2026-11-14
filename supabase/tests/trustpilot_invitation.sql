-- Local check for the Trustpilot invitation stamps
-- (20261114200000_trustpilot_invitation.sql).
-- One transaction, always rolled back. Existing rows stay in place.

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_deleted uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_calc uuid;
  v_before text;
  v_after text;
  v_shown timestamptz;
  v_clicked timestamptz;
  v_first timestamptz;
  v_count integer;
  v_shown_count integer;
  v_clicked_count integer;
  v_dash jsonb;
begin
  if not has_column_privilege('authenticated', 'public.profiles', 'trustpilot_shown_at', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'trustpilot_clicked_at', 'UPDATE') then
    raise exception 'authenticated cannot update its Trustpilot stamps';
  end if;
  if has_column_privilege('anon', 'public.profiles', 'trustpilot_clicked_at', 'UPDATE')
     or has_column_privilege('anon', 'public.profiles', 'trustpilot_shown_at', 'UPDATE') then
    raise exception 'anon can update a Trustpilot stamp';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE') then
    raise exception 'authenticated can update the profile id';
  end if;
  if not has_function_privilege('authenticated', 'private.guard_trustpilot_stamps()', 'EXECUTE') then
    raise exception 'authenticated cannot run the stamp guard';
  end if;
  if has_function_privilege('anon', 'private.guard_trustpilot_stamps()', 'EXECUTE')
     or has_function_privilege('service_role', 'private.guard_trustpilot_stamps()', 'EXECUTE') then
    raise exception 'a closed role can run the stamp guard';
  end if;

  select count(*) into v_count
    from pg_policy
   where polrelid = 'public.calculations'::regclass;
  if v_count <> 4 then
    raise exception 'calculation policies changed: %', v_count;
  end if;

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
      (v_a, 'trustpilot-a@example.com'),
      (v_b, 'trustpilot-b@example.com'),
      (v_c, 'trustpilot-c@example.com'),
      (v_deleted, 'trustpilot-deleted@example.com'),
      (v_admin, 'trustpilot-admin@example.com')
  ) as users(id, email);

  if exists (
    select 1
      from public.profiles
     where id in (v_a, v_b, v_c, v_deleted, v_admin)
       and (trustpilot_shown_at is not null or trustpilot_clicked_at is not null)
  ) then
    raise exception 'a new account started with a Trustpilot stamp';
  end if;

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version
  ) values (
    v_a, 'speicher_grenze', 'Bestehend', '{"keep":true}'::jsonb, '{"keep":true}'::jsonb,
    'speicher-grenze-input/v1', 'speicher-grenze-result/v2'
  ) returning id into v_calc;
  select md5(x::text) into v_before from public.calculations x where id = v_calc;

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_a, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  update public.profiles
     set trustpilot_shown_at = timestamptz '2000-01-01'
   where id = v_a;
  select trustpilot_shown_at, trustpilot_clicked_at
    into v_first, v_clicked
    from public.profiles
   where id = v_a;
  if v_first is null or v_first < now() - interval '5 minutes' or v_clicked is not null then
    raise exception 'the first display did not keep the database time';
  end if;

  update public.profiles
     set trustpilot_shown_at = timestamptz '2099-01-01'
   where id = v_a;
  select trustpilot_shown_at into v_shown from public.profiles where id = v_a;
  if v_shown is distinct from v_first then
    raise exception 'a later display moved the first timestamp';
  end if;

  update public.profiles
     set trustpilot_clicked_at = timestamptz '2001-01-01'
   where id = v_b;
  if found then
    raise exception 'an account stamped another profile';
  end if;

  update public.profiles
     set trustpilot_clicked_at = timestamptz '2001-01-01'
   where id = v_a;
  select trustpilot_shown_at, trustpilot_clicked_at
    into v_shown, v_clicked
    from public.profiles
   where id = v_a;
  if v_shown is distinct from v_first
     or v_clicked is null
     or v_clicked < now() - interval '5 minutes' then
    raise exception 'the click did not keep the first display and its own time';
  end if;

  update public.profiles
     set trustpilot_shown_at = null,
         trustpilot_clicked_at = null
   where id = v_a;
  select trustpilot_shown_at, trustpilot_clicked_at
    into v_shown, v_clicked
    from public.profiles
   where id = v_a;
  if v_shown is distinct from v_first or v_clicked is null then
    raise exception 'a stamp was cleared';
  end if;

  update public.profiles
     set account_kind = 'privat',
         given_name = 'Ada',
         family_name = 'Lovelace'
   where id = v_a;
  select trustpilot_clicked_at into v_clicked from public.profiles where id = v_a;
  if v_clicked is null then
    raise exception 'saving the account type cleared the click';
  end if;

  execute 'reset role';
  select md5(x::text) into v_after from public.calculations x where id = v_calc;
  if v_before is distinct from v_after then
    raise exception 'a Trustpilot stamp changed a calculation';
  end if;

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version
  ) values (
    v_a, 'rendite_guide', 'Später', '{"keep":true}'::jsonb, '{"keep":true}'::jsonb,
    'speicher-grenze-input/v1', 'speicher-grenze-result/v2'
  );
  select trustpilot_clicked_at into v_clicked from public.profiles where id = v_a;
  if v_clicked is null then
    raise exception 'a new calculation cleared the click';
  end if;

  perform set_config('request.jwt.claim.sub', v_c::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_c, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  update public.profiles
     set account_kind = 'unternehmen',
         given_name = 'Grace',
         family_name = 'Hopper',
         company_name = 'Analytical Engines GmbH',
         trustpilot_clicked_at = timestamptz '1999-01-01'
   where id = v_c;
  execute 'reset role';
  select trustpilot_shown_at, trustpilot_clicked_at
    into v_shown, v_clicked
    from public.profiles
   where id = v_c;
  if v_shown is null or v_clicked is null or v_shown < now() - interval '5 minutes' then
    raise exception 'a company click did not record both stamps';
  end if;

  update public.profiles
     set trustpilot_shown_at = now(),
         trustpilot_clicked_at = now()
   where id = v_deleted;
  update auth.users
     set deleted_at = now()
   where id = v_deleted;

  insert into private.admin_users (user_id, note)
  values (v_admin, 'trustpilot test');

  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_a, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    perform public.admin_dashboard();
    raise exception 'an ordinary account read the Trustpilot counts';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'admin_required' then
        raise exception 'unexpected dashboard refusal: %', sqlerrm;
      end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  v_dash := public.admin_dashboard();
  execute 'reset role';

  select count(*) into v_shown_count
    from public.profiles p
    join auth.users u on u.id = p.id and u.deleted_at is null
   where p.trustpilot_shown_at is not null;
  select count(*) into v_clicked_count
    from public.profiles p
    join auth.users u on u.id = p.id and u.deleted_at is null
   where p.trustpilot_clicked_at is not null;

  if (v_dash->>'trustpilot_shown')::integer is distinct from v_shown_count
     or (v_dash->>'trustpilot_clicked')::integer is distinct from v_clicked_count then
    raise exception 'dashboard counts do not match the account stamps';
  end if;
  if v_clicked_count < 2 or v_shown_count < v_clicked_count then
    raise exception 'the test accounts were not counted: shown % clicked %', v_shown_count, v_clicked_count;
  end if;
  if exists (
    select 1
      from auth.users
     where id = v_deleted
       and deleted_at is null
  ) then
    raise exception 'the deleted account was not marked deleted';
  end if;
end $$;

rollback;
