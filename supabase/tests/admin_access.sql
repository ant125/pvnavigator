-- Local check for the administrator role (20261114114503_admin_roles.sql).
-- One transaction, always rolled back.
-- Covers: closed role and audit tables, is_admin() for visitors, ordinary users,
-- forged claims and administrators, unchanged own-row access for an
-- administrator, immediate revocation, the audit trail and account deletion.

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_user_calc uuid;
  v_result jsonb;
  v_count integer;
  v_role text;
  v_table text;
  v_privilege text;
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
      (v_admin, 'role-admin@example.com'),
      (v_user, 'role-user@example.com')
  ) as users(id, email);

  -- Static privileges: no Data API role may touch either table.
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    foreach v_table in array array['private.admin_users', 'private.admin_audit_log'] loop
      foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        if has_table_privilege(v_role, v_table, v_privilege) then
          raise exception '% has % on %', v_role, v_privilege, v_table;
        end if;
      end loop;
    end loop;
  end loop;

  if (select count(*) from pg_class
       where oid in ('private.admin_users'::regclass, 'private.admin_audit_log'::regclass)
         and relrowsecurity) <> 2 then
    raise exception 'RLS is not enabled on the admin tables';
  end if;
  if has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') then
    raise exception 'anon can execute is_admin()';
  end if;
  if not has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') then
    raise exception 'authenticated cannot execute is_admin()';
  end if;
  if has_function_privilege('authenticated', 'private.log_admin_role_change()', 'EXECUTE') then
    raise exception 'authenticated can execute the audit trigger function';
  end if;

  -- The role must not have been wired into any existing policy.
  select count(*) into v_count from pg_policies
   where coalesce(qual, '') ~* 'is_admin|admin_users'
      or coalesce(with_check, '') ~* 'is_admin|admin_users';
  if v_count <> 0 then
    raise exception 'an RLS policy refers to the administrator role';
  end if;

  -- A calculation of the ordinary user, to prove the administrator cannot read it.
  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version
  )
  values (
    v_user, 'speicher_grenze', 'Fremde Berechnung', '{}'::jsonb, '{}'::jsonb,
    'speicher-grenze-input/v1', 'speicher-grenze-result/v2'
  )
  returning id into v_user_calc;

  insert into private.admin_users (user_id, note) values (v_admin, 'test grant');

  -- Without any JWT the check answers false.
  if public.is_admin() then
    raise exception 'is_admin() is true without a signed-in user';
  end if;

  -- Visitor (anon): not allowed to call the function at all.
  execute 'set local role anon';
  begin
    perform public.is_admin();
    raise exception 'anon could call is_admin()';
  exception
    when insufficient_privilege then
      null;
  end;
  execute 'reset role';

  -- Ordinary user.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );

  if public.is_admin() then
    raise exception 'ordinary user is an administrator';
  end if;

  begin
    select count(*) into v_count from private.admin_users;
    raise exception 'ordinary user can read the role table';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    insert into private.admin_users (user_id) values (v_user);
    raise exception 'ordinary user granted itself the role';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    update private.admin_users set user_id = v_user where user_id = v_admin;
    raise exception 'ordinary user took over the role';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    delete from private.admin_users;
    raise exception 'ordinary user revoked the role';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    select count(*) into v_count from private.admin_audit_log;
    raise exception 'ordinary user can read the audit log';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    insert into private.admin_audit_log (action) values ('forged');
    raise exception 'ordinary user wrote to the audit log';
  exception
    when insufficient_privilege then
      null;
  end;

  -- Claims a user could try to influence do not grant the role: metadata,
  -- a custom role claim and the administrator's e-mail address.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_user, 'role', 'authenticated', 'email', 'role-admin@example.com',
      'is_admin', true,
      'app_metadata', jsonb_build_object('role', 'admin', 'is_admin', true),
      'user_metadata', jsonb_build_object('role', 'admin', 'is_admin', true)
    )::text,
    true
  );
  if public.is_admin() then
    raise exception 'forged claims granted the role';
  end if;

  -- An authenticated role without a subject is nobody.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  if public.is_admin() then
    raise exception 'a JWT without a subject is an administrator';
  end if;

  -- The ordinary user keeps working as before.
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );
  v_result := public.record_completed_calculation(
    'admin-test-user-a', 'Nutzeradresse',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'Nutzer',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2'
    )
  );
  if v_result->>'reason' <> 'open_access' then
    raise exception 'ordinary user could not save a calculation: %', v_result;
  end if;

  -- Administrator.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );

  if not public.is_admin() then
    raise exception 'administrator is not recognised';
  end if;

  -- Requirement: an administrator keeps every ordinary capability.
  v_result := public.check_calculation_access('admin-test-own-a');
  if (v_result->>'allowed')::boolean is not true then
    raise exception 'administrator may not calculate: %', v_result;
  end if;
  v_result := public.record_completed_calculation(
    'admin-test-own-a', 'Eigene Adresse',
    jsonb_build_object(
      'product_key', 'speicher_grenze', 'name', 'Eigene Berechnung',
      'input', '{}'::jsonb, 'result_snapshot', '{}'::jsonb,
      'input_schema_version', 'speicher-grenze-input/v1',
      'result_schema_version', 'speicher-grenze-result/v2',
      'summary_pv_kwp', 8, 'summary_consumption_kwh', 4200
    )
  );
  if v_result->>'access_tier' <> 'free' or v_result->>'reason' <> 'open_access' then
    raise exception 'administrator could not save a calculation: %', v_result;
  end if;
  select count(*) into v_count from public.calculations
   where id = (v_result->>'calculation_id')::uuid and user_id = v_admin;
  if v_count <> 1 then
    raise exception 'administrator cannot read the own calculation';
  end if;

  -- Requirement: existing RLS is unchanged. The role opens no foreign rows.
  select count(*) into v_count from public.calculations where user_id <> v_admin;
  if v_count <> 0 then
    raise exception 'administrator can read % foreign calculations through RLS', v_count;
  end if;
  select count(*) into v_count from public.calculations where id = v_user_calc;
  if v_count <> 0 then
    raise exception 'administrator can read a foreign calculation by id';
  end if;
  select count(*) into v_count from public.profiles;
  if v_count <> 1 then
    raise exception 'administrator sees % profiles instead of the own one', v_count;
  end if;
  update public.calculations set name = 'Übernommen' where id = v_user_calc;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'administrator changed a foreign calculation';
  end if;
  delete from public.calculations where id = v_user_calc;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'administrator deleted a foreign calculation';
  end if;

  -- The role and audit tables are closed to the administrator's session too.
  begin
    select count(*) into v_count from private.admin_users;
    raise exception 'administrator can read the role table directly';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    insert into private.admin_users (user_id) values (v_user);
    raise exception 'administrator granted the role to another account';
  exception
    when insufficient_privilege then
      null;
  end;

  -- Revocation takes effect for the very next check.
  execute 'reset role';
  if (select name from public.calculations where id = v_user_calc) <> 'Fremde Berechnung' then
    raise exception 'foreign calculation was changed';
  end if;
  delete from private.admin_users where user_id = v_admin;

  execute 'set local role authenticated';
  if public.is_admin() then
    raise exception 'revoked administrator is still recognised';
  end if;
  execute 'reset role';

  -- Audit trail: one grant and one revocation for this account.
  select count(*) into v_count from private.admin_audit_log
   where target_user_id = v_admin and action = 'admin_role_granted'
     and details->>'note' = 'test grant';
  if v_count <> 1 then
    raise exception 'grant was not recorded: %', v_count;
  end if;
  select count(*) into v_count from private.admin_audit_log
   where target_user_id = v_admin and action = 'admin_role_revoked';
  if v_count <> 1 then
    raise exception 'revocation was not recorded: %', v_count;
  end if;

  -- Deleting the account removes the role and keeps the trail.
  insert into private.admin_users (user_id) values (v_admin);
  delete from auth.users where id = v_admin;
  if exists (select 1 from private.admin_users where user_id = v_admin) then
    raise exception 'role row survived the account';
  end if;
  select count(*) into v_count from private.admin_audit_log where target_user_id = v_admin;
  if v_count <> 4 then
    raise exception 'audit trail after account deletion has % entries', v_count;
  end if;

  -- The role can only be given to an existing account.
  begin
    insert into private.admin_users (user_id) values (gen_random_uuid());
    raise exception 'role was granted to an unknown account';
  exception
    when foreign_key_violation then
      null;
  end;
end $$;

rollback;
