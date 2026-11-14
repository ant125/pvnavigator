-- Local check for the administrator overview (20261114164100_admin_overview.sql).
-- One transaction, always rolled back. Existing rows stay in place; expectations
-- are measured as a delta around the rows this test inserts.

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_subject uuid := gen_random_uuid();
  v_old uuid := gen_random_uuid();
  v_mid uuid := gen_random_uuid();
  v_new uuid := gen_random_uuid();
  v_score uuid := gen_random_uuid();
  v_wild uuid := gen_random_uuid();
  v_role text;
  v_fn text;
  v_today date;
  v_today_start timestamptz;
  v_now timestamptz;
  v_old_at timestamptz;
  v_week_start date;
  v_week_delta integer := 0;
  v_month_delta integer := 0;
  v_stamp timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_expected jsonb;
  v_list jsonb;
  v_card jsonb;
  v_audit integer;
  v_count integer;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    foreach v_fn in array array[
      'public.admin_dashboard()',
      'public.admin_list_users(text, text, text, text, integer, integer)',
      'public.admin_user_card(uuid, integer, integer)',
      'private.assert_admin()',
      'private.admin_json_number(jsonb)'
    ] loop
      if v_role <> 'authenticated'
         and has_function_privilege(v_role, v_fn, 'EXECUTE') then
        raise exception '% can execute %', v_role, v_fn;
      end if;
      if v_role = 'authenticated'
         and v_fn like 'public.%'
         and not has_function_privilege(v_role, v_fn, 'EXECUTE') then
        raise exception 'authenticated cannot execute %', v_fn;
      end if;
      if v_role = 'authenticated'
         and v_fn like 'private.%'
         and has_function_privilege(v_role, v_fn, 'EXECUTE') then
        raise exception 'authenticated can execute %', v_fn;
      end if;
    end loop;
  end loop;

  if exists (
    select 1 from pg_policies
     where coalesce(qual, '') || coalesce(with_check, '')
           ~* 'admin_dashboard|admin_list_users|admin_user_card|is_admin|admin_users'
  ) then
    raise exception 'an RLS policy refers to the administrator functions';
  end if;

  -- Monday is the first day, and Berlin is not the session time zone.
  if extract(isodow from date '2026-11-16') <> 1
     or date_trunc('week', timestamp '2026-11-15 12:00')::date <> date '2026-11-09' then
    raise exception 'the database week does not start on Monday';
  end if;
  if (timestamptz '2026-11-15 23:30:00+00' at time zone 'Europe/Berlin')::date <> date '2026-11-16'
     or date_trunc('week', timestamptz '2026-11-15 23:30:00+00' at time zone 'Europe/Berlin')::date
        <> date '2026-11-16' then
    raise exception 'a Berlin Monday was assigned to the previous week';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
    email, extensions.crypt('TestNutzer-2026!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, created_at, created_at,
    '', '', '', ''
  from (
    values
      (v_admin, 'stage2-admin@example.com', timestamptz '2021-01-01'),
      (v_subject, 'stage2-firma@example.com', timestamptz '2020-01-01'),
      (v_old, 'stage2-page-old@example.com', timestamptz '2019-01-01'),
      (v_mid, 'stage2-page-mid@example.com', timestamptz '2022-01-01'),
      (v_new, 'stage2-page-new@example.com', timestamptz '2024-06-01'),
      (v_score, 'stage2_score@example.com', timestamptz '2023-01-01'),
      (v_wild, 'stage2Xscore@example.com', timestamptz '2023-02-01')
  ) as users(id, email, created_at);

  update public.profiles
     set display_name = 'Stage2 Firmenname GmbH'
   where id = v_subject;

  insert into private.admin_users (user_id, note) values (v_admin, 'overview test');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  v_before := public.admin_dashboard();
  execute 'reset role';

  v_now := now();
  v_old_at := v_now - interval '40 days';
  v_today := (v_now at time zone 'Europe/Berlin')::date;
  v_today_start := v_today::timestamp at time zone 'Europe/Berlin';
  v_week_start := v_today - (extract(isodow from v_today)::integer - 1);

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version,
    summary_address, summary_pv_kwp, summary_consumption_kwh, created_at
  ) values
    (
      v_subject, 'speicher_grenze', 'Jetzt', '{}'::jsonb,
      jsonb_build_object(
        'kernel', 'KERNEL_SHOULD_NOT_LEAK',
        'verifiedResult', jsonb_build_object(
          'energy', jsonb_build_object('year', jsonb_build_object('pvYieldKwhAnnual', 9500))
        ),
        'presentation', jsonb_build_object('recommendedTechnicalSize', 7.5)
      ),
      'speicher-grenze-input/v1', 'speicher-grenze-result/v2',
      'Bühne 1, 10115 Berlin', 9.5, 4200, v_now
    ),
    (
      v_subject, 'speicher_grenze', 'Tagesbeginn',
      jsonb_build_object('pvSystemKwP', 4, 'annualConsumptionKWh', 3000),
      jsonb_build_object(
        'verifiedResult', jsonb_build_object(
          'energy', jsonb_build_object('year', jsonb_build_object('pvYieldKwhAnnual', 'nope'))
        )
      ),
      'speicher-grenze-input/v1', 'speicher-grenze-result/v1',
      null, null, null, v_today_start
    ),
    (
      v_subject, 'speicher_grenze', 'Gerade noch gestern', '{}'::jsonb,
      jsonb_build_object(
        'verifiedResult', jsonb_build_object(
          'energy', jsonb_build_object('year', jsonb_build_object('pvYieldKwhAnnual', -5))
        )
      ),
      'speicher-grenze-input/v1', 'speicher-grenze-result/v2',
      null, null, null, v_today_start - interval '1 second'
    ),
    (
      v_subject, 'speicher_grenze', 'Alt', '{}'::jsonb, '{}'::jsonb,
      'speicher-grenze-input/v1', 'speicher-grenze-result/v2',
      null, null, null, v_old_at
    ),
    (
      v_new, 'speicher_grenze', 'Neu', '{}'::jsonb, '{}'::jsonb,
      'speicher-grenze-input/v1', 'speicher-grenze-result/v2',
      null, null, null, v_now
    );

  foreach v_stamp in array array[
    v_now, v_today_start, v_today_start - interval '1 second', v_old_at, v_now
  ] loop
    if (v_stamp at time zone 'Europe/Berlin')::date >= v_week_start
       and (v_stamp at time zone 'Europe/Berlin')::date < v_week_start + 7 then
      v_week_delta := v_week_delta + 1;
    end if;
    if extract(year from v_stamp at time zone 'Europe/Berlin') = extract(year from v_today)
       and extract(month from v_stamp at time zone 'Europe/Berlin') = extract(month from v_today) then
      v_month_delta := v_month_delta + 1;
    end if;
  end loop;

  if (v_today_start at time zone 'Europe/Berlin')::date <> v_today
     or ((v_today_start - interval '1 second') at time zone 'Europe/Berlin')::date <> v_today - 1 then
    raise exception 'the midnight boundary is not a Berlin date boundary';
  end if;

  execute 'set local role authenticated';
  v_after := public.admin_dashboard();

  if (v_after->>'users')::integer <> (v_before->>'users')::integer then
    raise exception 'user total changed while inserting calculations';
  end if;
  if (v_after->>'unternehmen')::integer <> 0 or (v_before->>'unternehmen')::integer <> 0 then
    raise exception 'Unternehmen was inferred without a stored account type';
  end if;
  if (v_after->>'calculations')::integer <> (v_before->>'calculations')::integer + 5 then
    raise exception 'calculation total missed inserted rows: %', v_after;
  end if;
  if (v_after->>'today')::integer <> (v_before->>'today')::integer + 3 then
    raise exception 'today did not follow the Berlin day: before % after %', v_before->>'today', v_after->>'today';
  end if;
  if (v_after->>'week')::integer <> (v_before->>'week')::integer + v_week_delta then
    raise exception 'week does not follow the Berlin Monday week';
  end if;
  if (v_after->>'month')::integer <> (v_before->>'month')::integer + v_month_delta then
    raise exception 'month does not follow the Berlin calendar month';
  end if;
  if jsonb_array_length(v_after->'series') <> 30 then
    raise exception 'the chart does not cover 30 days';
  end if;

  execute 'reset role';
  select coalesce(jsonb_agg(
    jsonb_build_object('day', series.day::date, 'count', coalesce(counts.n, 0))
    order by series.day
  ), '[]'::jsonb)
    into v_expected
  from generate_series((v_today - 29)::timestamp, v_today::timestamp, interval '1 day') as series(day)
  left join (
    select (c.created_at at time zone 'Europe/Berlin')::date as day, count(*)::integer as n
      from public.calculations c
      join auth.users u on u.id = c.user_id and u.deleted_at is null
     where (c.created_at at time zone 'Europe/Berlin')::date between v_today - 29 and v_today
     group by 1
  ) as counts on counts.day = series.day::date;

  if v_after->'series' <> v_expected then
    raise exception 'the chart does not include every Berlin day, including days without calculations';
  end if;
  execute 'set local role authenticated';

  v_list := public.admin_list_users('stage2-page-', 'alle', 'registrierung', 'asc', 1, 2);
  if (v_list->>'total')::integer <> 3 or jsonb_array_length(v_list->'users') <> 2 then
    raise exception 'registration page did not return the first two of three: %', v_list;
  end if;
  if (v_list->'users'->0->>'id')::uuid <> v_old
     or (v_list->'users'->1->>'id')::uuid <> v_mid then
    raise exception 'registration sort is not oldest first';
  end if;
  v_list := public.admin_list_users('stage2-page-', 'alle', 'registrierung', 'asc', 2, 2);
  if (v_list->>'total')::integer <> 3
     or jsonb_array_length(v_list->'users') <> 1
     or (v_list->'users'->0->>'id')::uuid <> v_new then
    raise exception 'the second page is not the remaining account';
  end if;
  v_list := public.admin_list_users('stage2-page-', 'nicht_angegeben', 'aktivitaet', 'desc', 1, 10);
  if (v_list->'users'->0->>'id')::uuid <> v_new
     or v_list->'users'->0->>'account_kind' <> 'nicht_angegeben' then
    raise exception 'activity sort or account type is wrong: %', v_list->'users';
  end if;
  if (public.admin_list_users('stage2-page-', 'privat', 'registrierung', 'desc', 1, 10)->>'total')::integer <> 0
     or (public.admin_list_users('stage2-page-', 'unternehmen', 'registrierung', 'desc', 1, 10)->>'total')::integer <> 0 then
    raise exception 'Privat or Unternehmen matched an account without a stored type';
  end if;
  v_list := public.admin_list_users('Stage2 Firmenname', 'alle', 'registrierung', 'desc', 1, 10);
  if (v_list->>'total')::integer <> 1
     or v_list->'users'->0->>'display_name' <> 'Stage2 Firmenname GmbH'
     or v_list->'users'->0->>'email' <> 'stage2-firma@example.com'
     or (v_list->'users'->0->>'calculation_count')::integer <> 4 then
    raise exception 'name search missed the stored name: %', v_list;
  end if;
  if (public.admin_list_users('%', 'alle', 'registrierung', 'desc', 1, 10)->>'total')::integer
     = (public.admin_list_users(null, 'alle', 'registrierung', 'desc', 1, 10)->>'total')::integer then
    raise exception 'a percent sign matched every account';
  end if;
  if (public.admin_list_users('stage2_score', 'alle', 'registrierung', 'desc', 1, 10)->>'total')::integer <> 1 then
    raise exception 'an underscore was treated as a wildcard';
  end if;
  v_list := public.admin_list_users('stage2-page-', 'alle', 'registrierung', 'desc', 50, 100);
  if (v_list->>'page_size')::integer <> 25 or (v_list->>'page')::integer <> 50 then
    raise exception 'page bounds were not limited';
  end if;

  execute 'reset role';
  select count(*) into v_audit
    from private.admin_audit_log
   where action = 'admin_user_viewed' and target_user_id = v_subject;
  execute 'set local role authenticated';

  v_card := public.admin_user_card(v_subject, 1, 2);
  if (v_card->'user'->>'calculation_count')::integer <> 4
     or jsonb_array_length(v_card->'calculations') <> 2 then
    raise exception 'the card page is not the two newest calculations: %', v_card;
  end if;
  if v_card->'calculations'->0->>'address' <> 'Bühne 1, 10115 Berlin'
     or (v_card->'calculations'->0->>'pv_kwp')::numeric <> 9.5
     or (v_card->'calculations'->0->>'consumption_kwh')::numeric <> 4200
     or (v_card->'calculations'->0->>'pv_yield_kwh')::numeric <> 9500
     or (v_card->'calculations'->0->>'speichergrenze_kwh')::numeric <> 7.5 then
    raise exception 'stored calculation figures were not returned: %', v_card->'calculations'->0;
  end if;
  if (v_card->'calculations'->1->>'pv_kwp')::numeric <> 4
     or (v_card->'calculations'->1->>'consumption_kwh')::numeric <> 3000
     or v_card->'calculations'->1->>'pv_yield_kwh' is not null
     or v_card->'calculations'->1->>'speichergrenze_kwh' is not null then
    raise exception 'missing stored figures were invented: %', v_card->'calculations'->1;
  end if;
  if v_card::text ~* 'KERNEL_SHOULD_NOT_LEAK|result_snapshot|encrypted_password|pvSystemKwP' then
    raise exception 'the card contains data the page does not show';
  end if;
  v_card := public.admin_user_card(v_subject, 2, 2);
  if (v_card->'calculations'->0->>'pv_yield_kwh') is not null
     or (v_card->'calculations'->1->>'pv_yield_kwh') is not null then
    raise exception 'a negative or text yield was returned as a number';
  end if;
  execute 'reset role';
  select count(*) into v_count
    from private.admin_audit_log
   where action = 'admin_user_viewed'
     and target_user_id = v_subject
     and actor_user_id = v_admin
     and details = jsonb_build_object('page', 1);
  execute 'set local role authenticated';
  if v_count <> v_audit + 1 then
    raise exception 'opening the card was not audited';
  end if;

  begin
    perform public.admin_user_card(gen_random_uuid(), 1, 10);
    raise exception 'a missing account returned a card';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'admin_subject_not_found' then
        raise exception 'unexpected missing-account error: %', sqlerrm;
      end if;
  end;
  execute 'reset role';
  select count(*) into v_count
    from private.admin_audit_log
   where action = 'admin_user_viewed' and actor_user_id = v_admin;
  execute 'set local role authenticated';
  if v_count <> v_audit + 2 then
    raise exception 'a missing account was audited';
  end if;

  select count(*) into v_count from public.calculations where user_id = v_subject;
  if v_count <> 0 then
    raise exception 'the administrator can read foreign calculations through RLS';
  end if;

  perform set_config('request.jwt.claim.sub', v_subject::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_subject, 'role', 'authenticated', 'email', 'stage2-admin@example.com')::text,
    true
  );
  execute 'reset role';
  select count(*) into v_audit from private.admin_audit_log where action = 'admin_user_viewed';
  execute 'set local role authenticated';
  foreach v_fn in array array[
    'select public.admin_dashboard()',
    'select public.admin_list_users(null, ''alle'', ''registrierung'', ''desc'', 1, 20)',
    'select public.admin_user_card(''' || v_admin || ''', 1, 10)'
  ] loop
    begin
      execute v_fn;
      raise exception 'an ordinary account read administrative data';
    exception
      when sqlstate '42501' then
        if sqlerrm <> 'admin_required' then
          raise exception 'unexpected denial: %', sqlerrm;
        end if;
    end;
  end loop;
  execute 'reset role';
  select count(*) into v_count from private.admin_audit_log where action = 'admin_user_viewed';
  if v_count <> v_audit then
    raise exception 'a refused read was audited as a view';
  end if;
  execute 'reset role';

  execute 'set local role anon';
  begin
    perform public.admin_dashboard();
    raise exception 'anon read the dashboard';
  exception
    when insufficient_privilege then
      null;
  end;
  execute 'reset role';

  execute 'set local role service_role';
  begin
    perform public.admin_list_users();
    raise exception 'service_role listed accounts';
  exception
    when insufficient_privilege then
      null;
  end;
  execute 'reset role';
end $$;

rollback;
