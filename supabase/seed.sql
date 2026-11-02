-- Local test data. Loaded by `supabase db reset` / `supabase start` on the LOCAL
-- stack only (config.toml › [db.seed]). Never run against a hosted project.
--
-- Users (password for both: TestNutzer-2026!)
--   test@example.com  – free access, no address pinned yet
--   abo@example.com   – active PVNAVIGATOR_ test period, address_limit 2
--                       (small on purpose so the limit can be reached quickly)

create or replace function pg_temp.seed_user(p_email text, p_password text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );
  return v_id;
end;
$$;

do $$
declare
  v_free uuid;
  v_abo uuid;
begin
  v_free := pg_temp.seed_user('test@example.com', 'TestNutzer-2026!');
  v_abo := pg_temp.seed_user('abo@example.com', 'TestNutzer-2026!');

  insert into public.subscription_periods
    (user_id, period_start, period_end, address_limit, source, external_ref)
  values
    (v_abo, now() - interval '1 day', now() + interval '29 days', 2, 'test', 'local-seed');
end;
$$;
