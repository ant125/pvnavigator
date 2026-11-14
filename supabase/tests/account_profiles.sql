-- Local check for account profiles (20261114184500_account_profiles.sql).
-- One transaction, always rolled back. Does not keep users or calculations.

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_open uuid := gen_random_uuid();
  v_private uuid := gen_random_uuid();
  v_company uuid := gen_random_uuid();
  v_mail uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_bad uuid := gen_random_uuid();
  v_calc uuid;
  v_before text;
  v_after text;
  v_count integer;
  v_policies integer;
begin
  select count(*) into v_policies
    from pg_policy
   where polrelid = 'public.calculations'::regclass;
  if v_policies <> 4 then
    raise exception 'calculation policies changed before the profile check: %', v_policies;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_open, 'authenticated', 'authenticated',
    'profile-open@example.com', extensions.crypt('TestNutzer-2026!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('account_kind', 'admin', 'role', 'admin'),
    now(), now(), '', '', '', ''
  );
  raise exception 'a signup role claim was accepted';
exception
  when sqlstate '23514' then
    if sqlerrm <> 'profile_invalid' then
      raise exception 'unexpected signup rejection: %', sqlerrm;
    end if;
end $$;

do $$
declare
  v_open uuid := gen_random_uuid();
  v_private uuid := gen_random_uuid();
  v_company uuid := gen_random_uuid();
  v_mail uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_calc uuid;
  v_before text;
  v_after text;
  v_count integer;
  v_kind text;
  v_company_name text;
begin
  if exists (select 1 from auth.users where email = 'profile-open@example.com') then
    raise exception 'a rejected signup left an account';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
    email, extensions.crypt('TestNutzer-2026!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, meta, now(), now(),
    '', '', '', ''
  from (
    values
      (v_open, 'profile-open@example.com', '{}'::jsonb),
      (v_mail, 'firma@unternehmen.example', '{}'::jsonb),
      (
        v_private, 'profile-privat@example.com',
        jsonb_build_object(
          'account_kind', 'privat',
          'given_name', ' Ada ',
          'family_name', 'Lovelace',
          'company_name', 'Should be ignored',
          'role', 'admin'
        )
      ),
      (
        v_company, 'profile-firma@example.com',
        jsonb_build_object(
          'account_kind', 'unternehmen',
          'given_name', 'Grace',
          'family_name', 'Hopper',
          'company_name', ' Analytical Engines GmbH '
        )
      ),
      (v_other, 'profile-other@example.com', '{}'::jsonb)
  ) as users(id, email, meta);

  if exists (select 1 from private.admin_users where user_id in (v_open, v_private, v_company, v_mail)) then
    raise exception 'signup metadata granted the administrator role';
  end if;

  select account_kind, company_name into v_kind, v_company_name
    from public.profiles where id = v_private;
  if v_kind <> 'privat' or v_company_name is not null
     or (select given_name from public.profiles where id = v_private) <> 'Ada' then
    raise exception 'a private signup kept a company or skipped trimming';
  end if;

  select account_kind, company_name, given_name into v_kind, v_company_name, v_before
    from public.profiles where id = v_company;
  if v_kind <> 'unternehmen' or v_company_name <> 'Analytical Engines GmbH' or v_before <> 'Grace' then
    raise exception 'a company signup was not stored: % %', v_kind, v_company_name;
  end if;

  if exists (
    select 1 from public.profiles
     where id in (v_open, v_mail)
       and (account_kind is not null or given_name is not null or company_name is not null)
  ) then
    raise exception 'an empty signup or an e-mail address received an account type';
  end if;

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version
  ) values (
    v_open, 'speicher_grenze', 'Bestehend', '{"keep":true}'::jsonb, '{"keep":true}'::jsonb,
    'speicher-grenze-input/v1', 'speicher-grenze-result/v2'
  ) returning id into v_calc;
  select md5(x::text) into v_before from public.calculations x where id = v_calc;

  update public.profiles
     set account_kind = 'privat', given_name = 'Alan', family_name = 'Turing'
   where id = v_open;
  select md5(x::text) into v_after from public.calculations x where id = v_calc;
  if v_before is distinct from v_after then
    raise exception 'saving a profile changed a calculation';
  end if;
  select count(*) into v_count from public.calculations where user_id = v_open;
  if v_count <> 1 then
    raise exception 'the saved calculation disappeared';
  end if;

  perform set_config('request.jwt.claim.sub', v_open::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_open, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into v_count from public.calculations where user_id = v_open;
  if v_count <> 1 then
    raise exception 'the account lost its own calculation';
  end if;
  update public.profiles
     set account_kind = 'unternehmen',
         given_name = 'Alan',
         family_name = 'Turing',
         company_name = 'Bombe Ltd'
   where id = v_open;
  select company_name into v_company_name from public.profiles where id = v_open;
  if v_company_name <> 'Bombe Ltd' then
    raise exception 'the account could not edit its own profile';
  end if;

  update public.profiles
     set company_name = 'Fremd'
   where id = v_other;
  if found then
    raise exception 'an account edited another profile';
  end if;

  begin
    update public.profiles
       set account_kind = null, given_name = null, family_name = null, company_name = null
     where id = v_open;
    raise exception 'a saved profile was cleared';
  exception
    when sqlstate '23514' then
      if sqlerrm <> 'profile_required' then
        raise exception 'unexpected clear error: %', sqlerrm;
      end if;
  end;

  begin
    update public.profiles
       set account_kind = 'unternehmen', company_name = null
     where id = v_open;
    raise exception 'an Unternehmen without a Firmenname was stored';
  exception
    when sqlstate '23514' then
      null;
  end;
  execute 'reset role';

  select count(*) into v_count
    from pg_policy
   where polrelid = 'public.calculations'::regclass;
  if v_count <> 4 then
    raise exception 'calculation policies changed: %', v_count;
  end if;
end $$;

rollback;
