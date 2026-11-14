-- Local check for feedback threads (20261114222858_feedback_threads.sql).
-- One transaction, always rolled back.
-- Covers: closed writes, own-row reads, two accounts, an administrator,
-- statuses, both unread stamps, hourly limits, and unchanged older policies.

\set ON_ERROR_STOP on
begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_limited uuid := gen_random_uuid();
  v_calc uuid;
  v_foreign uuid;
  v_mismatch uuid;
  v_thread uuid;
  v_limited_thread uuid;
  v_message uuid;
  v_json jsonb;
  v_count integer;
  v_text text;
  v_calc_id uuid;
  v_version text;
  v_updated timestamptz;
  v_hash text;
  v_i integer;
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
      (v_owner, 'feedback-owner@example.com'),
      (v_other, 'feedback-other@example.com'),
      (v_admin, 'feedback-admin@example.com'),
      (v_limited, 'feedback-limited@example.com')
  ) as users(id, email);

  update public.profiles
     set account_kind = 'privat', given_name = 'Geheim', family_name = 'Name'
   where id = v_owner;

  insert into private.admin_users (user_id, note) values (v_admin, 'feedback test');

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version, battery_model_version
  ) values (
    v_owner, 'speicher_grenze', 'Eigen',
    '{"note":"secret_marker"}'::jsonb, '{"note":"secret_marker"}'::jsonb,
    'speicher-grenze-input/v1', 'speicher-grenze-result/v2', '1.1.0'
  )
  returning id into v_calc;

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version, battery_model_version
  ) values (
    v_other, 'speicher_grenze', 'Fremd',
    '{"note":"secret_marker"}'::jsonb, '{"note":"secret_marker"}'::jsonb,
    'speicher-grenze-input/v1', 'speicher-grenze-result/v2', '9.9.9'
  )
  returning id into v_foreign;

  insert into public.calculations (
    user_id, product_key, name, input, result_snapshot,
    input_schema_version, result_schema_version, battery_model_version
  ) values (
    v_owner, 'wirtschaftlichkeit', 'Andere Produktlinie',
    '{"note":"secret_marker"}'::jsonb, '{"note":"secret_marker"}'::jsonb,
    'rendite-input/v1', 'rendite-result/v1', '2.0.0'
  )
  returning id into v_mismatch;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name in ('feedback_threads', 'feedback_messages')
       and column_name in ('input', 'result_snapshot', 'email', 'given_name', 'display_name')
  ) then
    raise exception 'feedback tables have a column for profile or calculation content';
  end if;

  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.feedback_threads'::regclass) then
    raise exception 'thread RLS is not forced';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.feedback_messages'::regclass) then
    raise exception 'message RLS is not forced';
  end if;

  if has_table_privilege('anon', 'public.feedback_threads', 'SELECT')
     or has_table_privilege('authenticated', 'public.feedback_threads', 'INSERT')
     or has_table_privilege('authenticated', 'public.feedback_threads', 'UPDATE')
     or has_table_privilege('authenticated', 'public.feedback_threads', 'DELETE')
     or has_table_privilege('service_role', 'public.feedback_threads', 'SELECT')
     or has_column_privilege('authenticated', 'public.feedback_threads', 'admin_read_at', 'SELECT')
     or has_column_privilege('authenticated', 'public.feedback_messages', 'author_user_id', 'SELECT') then
    raise exception 'feedback grants are wider than own-row select';
  end if;

  if has_function_privilege('anon', 'public.create_feedback_thread(text,text,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_get_feedback(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.create_feedback_thread(text,text,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.feedback_body(text)', 'EXECUTE')
     or has_function_privilege('public', 'public.post_feedback_message(uuid,text)', 'EXECUTE') then
    raise exception 'feedback functions are executable by the wrong role';
  end if;
  if not has_function_privilege('authenticated', 'public.create_feedback_thread(text,text,text,text,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_post_feedback_message(uuid,text)', 'EXECUTE') then
    raise exception 'authenticated cannot execute the feedback functions';
  end if;

  execute 'set local role anon';
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', 'Thema', 'Text', null);
    raise exception 'anon created a thread';
  exception
    when insufficient_privilege then null;
  end;
  begin
    execute 'select count(*) from public.feedback_threads';
    raise exception 'anon read threads';
  exception
    when insufficient_privilege then null;
  end;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  begin
    perform public.feedback_unread_count();
    raise exception 'a session without a subject was accepted';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'feedback_unauthenticated' then
        raise exception 'unexpected anonymous error: %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  if public.feedback_unread_count() <> 0 then
    raise exception 'a new account already has unread replies';
  end if;

  begin
    perform public.create_feedback_thread('speicher_grenze', 'sonst', 'Thema', 'Text', null);
    raise exception 'unknown category was accepted';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'feedback_invalid' then
        raise exception 'unexpected category error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', repeat('a', 121), 'Text', null);
    raise exception 'subject of 121 characters was accepted';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'feedback_invalid' then
        raise exception 'unexpected subject error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', E'Zeile\nZwei', 'Text', null);
    raise exception 'a subject with a newline was accepted';
  exception
    when invalid_parameter_value then null;
  end;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', '   ', 'Text', null);
    raise exception 'a blank subject was accepted';
  exception
    when invalid_parameter_value then null;
  end;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', 'Thema', repeat('a', 4001), null);
    raise exception 'a message of 4001 characters was accepted';
  exception
    when invalid_parameter_value then null;
  end;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', 'Thema', 'Hinweis' || chr(1), null);
    raise exception 'a control character was accepted';
  exception
    when invalid_parameter_value then null;
  end;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', 'Thema', 'Text', v_foreign);
    raise exception 'a foreign calculation was attached';
  exception
    when no_data_found then
      if sqlerrm <> 'feedback_calculation_not_found' then
        raise exception 'unexpected calculation error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.create_feedback_thread('wirtschaftlichkeit', 'fehler', 'Thema', 'Text', null);
    raise exception 'RENDITEGUIDE was accepted before it is available';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'feedback_invalid' then
        raise exception 'unexpected product error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.create_feedback_thread('pvshadow', 'fehler', 'Thema', 'Text', null);
    raise exception 'an unknown product was accepted';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'feedback_invalid' then
        raise exception 'unexpected product error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.create_feedback_thread('allgemein', 'verbesserung', 'Idee', 'Text', v_calc);
    raise exception 'Allgemeine Idee accepted a calculation';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'feedback_invalid' then
        raise exception 'unexpected allgemein calculation error: %', sqlerrm;
      end if;
  end;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', 'Thema', 'Text', v_mismatch);
    raise exception 'a calculation from another product was attached';
  exception
    when no_data_found then
      if sqlerrm <> 'feedback_calculation_not_found' then
        raise exception 'unexpected product mismatch: %', sqlerrm;
      end if;
  end;
  if (select count(*) from public.feedback_threads) <> 0 then
    raise exception 'a rejected request left a row';
  end if;

  v_thread := public.create_feedback_thread(
    'speicher_grenze',
    'fehler',
    '  Thema  ',
    E'  Erste Zeile\nZweite Zeile  ',
    v_calc
  );
  if public.feedback_unread_count() <> 0 then
    raise exception 'the opening message counts as an unread reply';
  end if;

  perform pg_sleep(0.02);
  v_message := public.post_feedback_message(v_thread, repeat('ä', 4000));
  v_json := public.get_feedback_thread(v_thread);
  if v_json->>'status' <> 'neu'
     or v_json->>'subject' <> 'Thema'
     or v_json->>'product_key' <> 'speicher_grenze'
     or (v_json->>'calculation_id')::uuid <> v_calc
     or (v_json->>'unread')::boolean
     or jsonb_array_length(v_json->'messages') <> 2
     or v_json->'messages'->0->>'author_role' <> 'user'
     or v_json->'messages'->0->>'body' <> E'Erste Zeile\nZweite Zeile'
     or v_json->'messages'->1->>'body' <> repeat('ä', 4000)
     or v_json::text like '%author_user_id%'
     or v_json::text like '%secret_marker%'
     or v_json::text like '%feedback-owner@example.com%' then
    raise exception 'own thread payload is wrong: %', v_json;
  end if;

  execute 'reset role';
  select t::text into v_text from public.feedback_threads t where t.id = v_thread;
  if v_text like '%secret_marker%'
     or v_text like '%feedback-owner@example.com%'
     or v_text like '%Geheim%'
     or v_text not like '%1.1.0%'
     or v_text not like '%speicher-grenze-input/v1%'
     or v_text not like '%speicher-grenze-result/v2%' then
    raise exception 'thread stored the wrong fields: %', v_text;
  end if;
  if (select user_id from public.feedback_threads where id = v_thread) <> v_owner
     or (select admin_read_at from public.feedback_threads where id = v_thread) is not null
     or (select user_read_at from public.feedback_threads where id = v_thread) is null then
    raise exception 'owner or read stamps were not set from the session';
  end if;
  if exists (
    select 1
      from public.feedback_messages m
      join public.feedback_threads t on t.id = m.thread_id
     where t.id = v_thread
       and m.created_at > t.created_at
       and m.id <> v_message
  ) then
    raise exception 'the opening message counts as a follow-up';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  if (select count(*) from public.feedback_threads) <> 1
     or (select count(*) from public.feedback_messages) <> 2 then
    raise exception 'the owner cannot read the own conversation';
  end if;
  begin
    execute 'select admin_read_at from public.feedback_threads';
    raise exception 'the owner read admin_read_at';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.feedback_threads (user_id, product_key, category, subject, status)
    values (v_owner, 'speicher_grenze', 'fehler', 'Direkt', 'erledigt');
    raise exception 'the owner inserted a thread directly';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.feedback_threads set status = 'erledigt' where id = v_thread;
    raise exception 'the owner changed the status directly';
  exception
    when insufficient_privilege then null;
  end;
  begin
    update public.feedback_messages set body = 'Geändert' where thread_id = v_thread;
    raise exception 'the owner edited a message';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.admin_set_feedback_status(v_thread, 'erledigt');
    raise exception 'the owner closed the thread';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'admin_required' then
        raise exception 'unexpected status error: %', sqlerrm;
      end if;
  end;
  if (select status from public.feedback_threads where id = v_thread) <> 'neu' then
    raise exception 'the status changed without an administrator';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  if (select count(*) from public.feedback_threads) <> 0
     or (select count(*) from public.feedback_messages) <> 0
     or public.feedback_unread_count() <> 0 then
    raise exception 'another account can see the conversation';
  end if;
  begin
    perform public.get_feedback_thread(v_thread);
    raise exception 'another account opened the thread';
  exception
    when no_data_found then
      if sqlerrm <> 'feedback_not_found' then
        raise exception 'unexpected foreign read: %', sqlerrm;
      end if;
  end;
  begin
    perform public.post_feedback_message(v_thread, 'Fremde Antwort');
    raise exception 'another account wrote into the thread';
  exception
    when no_data_found then
      if sqlerrm <> 'feedback_not_found' then
        raise exception 'unexpected foreign write: %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  if (select count(*) from public.feedback_threads) <> 0
     or (select count(*) from public.feedback_messages) <> 0 then
    raise exception 'an administrator can read a foreign thread through RLS';
  end if;
  if public.admin_feedback_unread_count() <> 1 then
    raise exception 'the new request is not waiting for an administrator';
  end if;
  v_json := public.admin_get_feedback(v_thread);
  if v_json->>'email' <> 'feedback-owner@example.com'
     or v_json->>'display_name' <> 'Geheim Name'
     or v_json->>'account_kind' <> 'privat'
     or (v_json->>'calculation_id')::uuid <> v_calc
     or v_json->>'battery_model_version' <> '1.1.0'
     or v_json->>'input_schema_version' <> 'speicher-grenze-input/v1'
     or v_json->>'result_schema_version' <> 'speicher-grenze-result/v2'
     or (v_json->>'unread')::boolean is not true
     or v_json::text like '%secret_marker%'
     or v_json::text like '%author_user_id%'
     or v_json ? 'input'
     or v_json ? 'result_snapshot' then
    raise exception 'administrator payload is wrong: %', v_json;
  end if;

  perform pg_sleep(0.02);
  perform public.admin_post_feedback_message(v_thread, 'Wir prüfen das.');
  v_json := public.admin_get_feedback(v_thread);
  if v_json->>'status' <> 'beantwortet'
     or public.admin_feedback_unread_count() <> 1
     or (v_json->>'unread')::boolean is not true
     or v_json->'messages'->2->>'author_role' <> 'admin' then
    raise exception 'administrator reply did not stay unread for administration: %', v_json;
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  if public.feedback_unread_count() <> 1
     or (public.get_feedback_thread(v_thread)->>'unread')::boolean is not true then
    raise exception 'the account did not see the administrator reply';
  end if;
  select updated_at into v_updated from public.feedback_threads where id = v_thread;
  perform pg_sleep(0.02);
  perform public.mark_feedback_read(v_thread);
  if public.feedback_unread_count() <> 0
     or (select updated_at from public.feedback_threads where id = v_thread) is distinct from v_updated then
    raise exception 'reading the reply did not clear only the unread flag';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  perform pg_sleep(0.02);
  perform public.admin_mark_feedback_read(v_thread);
  if public.admin_feedback_unread_count() <> 0 then
    raise exception 'administrator read did not clear the new request';
  end if;
  perform pg_sleep(0.02);
  perform public.admin_post_feedback_message(v_thread, 'Noch ein Hinweis.');
  if public.admin_feedback_unread_count() <> 0
     or (public.admin_get_feedback(v_thread)->>'unread')::boolean then
    raise exception 'the administrator''s own reply counts as unread';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  if public.feedback_unread_count() <> 1 then
    raise exception 'the second administrator reply is not unread';
  end if;
  perform public.mark_feedback_read(v_thread);

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  perform public.admin_set_feedback_status(v_thread, 'in_bearbeitung');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  perform pg_sleep(0.02);
  perform public.post_feedback_message(v_thread, 'Weiter in Bearbeitung');
  if (select status from public.feedback_threads where id = v_thread) <> 'in_bearbeitung'
     or public.feedback_unread_count() <> 0 then
    raise exception 'a reply during in_bearbeitung changed the wrong state';
  end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  if public.admin_feedback_unread_count() <> 1
     or (public.admin_get_feedback(v_thread)->>'status') <> 'in_bearbeitung'
     or (public.admin_get_feedback(v_thread)->>'unread')::boolean is not true then
    raise exception 'in_bearbeitung hides a new user message';
  end if;
  perform public.admin_mark_feedback_read(v_thread);

  perform public.admin_set_feedback_status(v_thread, 'beantwortet');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  select updated_at into v_updated from public.feedback_threads where id = v_thread;
  perform pg_sleep(0.02);
  perform public.post_feedback_message(v_thread, 'Noch offen');
  if (select status from public.feedback_threads where id = v_thread) <> 'neu'
     or (select updated_at from public.feedback_threads where id = v_thread) is not distinct from v_updated then
    raise exception 'a reply to beantwortet did not return the thread to neu';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  perform public.admin_mark_feedback_read(v_thread);
  perform public.admin_set_feedback_status(v_thread, 'erledigt');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  perform pg_sleep(0.02);
  perform public.post_feedback_message(v_thread, 'Doch nicht erledigt');
  if (select status from public.feedback_threads where id = v_thread) <> 'neu' then
    raise exception 'a reply to erledigt did not return the thread to neu';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  perform public.admin_mark_feedback_read(v_thread);
  perform public.admin_set_feedback_status(v_thread, 'erledigt');
  perform pg_sleep(0.02);
  perform public.admin_post_feedback_message(v_thread, 'Damit ist es geschlossen.');
  if (public.admin_get_feedback(v_thread)->>'status') <> 'beantwortet'
     or public.admin_feedback_unread_count() <> 0 then
    raise exception 'an administrator reply to a closed thread did not reopen it as beantwortet';
  end if;
  begin
    perform public.admin_set_feedback_status(v_thread, 'geschlossen');
    raise exception 'an unknown status was stored';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'feedback_invalid' then
        raise exception 'unexpected status error: %', sqlerrm;
      end if;
  end;
  if public.admin_feedback_unread_count() <> 0 then
    raise exception 'administrator counter did not return to zero';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  perform public.mark_feedback_read(v_thread);
  if public.feedback_unread_count() <> 0 then
    raise exception 'the account still has an unread reply';
  end if;

  execute 'reset role';
  delete from public.calculations where id = v_calc;
  select calculation_id, battery_model_version into v_calc_id, v_version
    from public.feedback_threads where id = v_thread;
  if v_calc_id is not null or v_version <> '1.1.0' then
    raise exception 'deleting the calculation removed the version or kept the id';
  end if;
  if exists (select 1 from public.calculations where id = v_calc) then
    raise exception 'the calculation row could not be deleted';
  end if;

  begin
    update public.feedback_messages set body = 'Geändert' where thread_id = v_thread;
    raise exception 'a message was edited by the table owner';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'feedback_message_immutable' then
        raise exception 'unexpected message guard: %', sqlerrm;
      end if;
  end;
  begin
    update public.feedback_threads set subject = 'Anderes Thema' where id = v_thread;
    raise exception 'the subject was rewritten';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'feedback_immutable' then
        raise exception 'unexpected thread guard: %', sqlerrm;
      end if;
  end;
  begin
    update public.feedback_threads set calculation_id = v_foreign where id = v_thread;
    raise exception 'the calculation link was moved';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'feedback_immutable' then
        raise exception 'unexpected calculation guard: %', sqlerrm;
      end if;
  end;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_limited::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_limited, 'role', 'authenticated')::text,
    true
  );
  for v_i in 1..5 loop
    v_limited_thread := public.create_feedback_thread(
      'allgemein',
      'verbesserung',
      case when v_i = 5 then repeat('ä', 120) else 'Hinweis ' || v_i end,
      'Bitte prüfen',
      null
    );
  end loop;
  if (select char_length(subject) from public.feedback_threads where id = v_limited_thread) <> 120
     or (select product_key from public.feedback_threads where id = v_limited_thread) <> 'allgemein'
     or (select calculation_id from public.feedback_threads where id = v_limited_thread) is not null then
    raise exception 'an Allgemeine Idee request was not stored without a calculation';
  end if;
  begin
    perform public.create_feedback_thread('speicher_grenze', 'fehler', 'Zu viel', 'Text', null);
    raise exception 'the sixth request in an hour was accepted';
  exception
    when raise_exception then
      if sqlerrm <> 'feedback_rate_limited' then
        raise exception 'unexpected request limit: %', sqlerrm;
      end if;
  end;
  for v_i in 1..20 loop
    perform public.post_feedback_message(v_limited_thread, 'Nachtrag ' || v_i);
  end loop;
  begin
    perform public.post_feedback_message(v_limited_thread, 'Einer zu viel');
    raise exception 'the 21st user message in an hour was accepted';
  exception
    when raise_exception then
      if sqlerrm <> 'feedback_rate_limited' then
        raise exception 'unexpected message limit: %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );
  if public.admin_feedback_unread_count() <> 5 then
    raise exception 'administrator unread count is % instead of 5', public.admin_feedback_unread_count();
  end if;
  perform pg_sleep(0.02);
  perform public.admin_post_feedback_message(v_limited_thread, 'Antwort ohne Limit');
  perform public.admin_post_feedback_message(v_limited_thread, 'Zweite Antwort ohne Limit');
  if public.admin_feedback_unread_count() <> 5 then
    raise exception 'administrator replies changed the unread count';
  end if;
  v_json := public.admin_list_feedback(1, 20);
  if (v_json->>'total')::integer <> 6
     or jsonb_array_length(v_json->'threads') <> 6 then
    raise exception 'administrator list is wrong: %', v_json;
  end if;

  perform set_config('request.jwt.claim.sub', v_limited::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_limited, 'role', 'authenticated')::text,
    true
  );
  if public.feedback_unread_count() <> 1 then
    raise exception 'the limited account did not see the administrator reply';
  end if;
  begin
    perform public.post_feedback_message(v_limited_thread, 'Immer noch zu viel');
    raise exception 'an administrator reply reset the user limit';
  exception
    when raise_exception then
      if sqlerrm <> 'feedback_rate_limited' then
        raise exception 'unexpected limit after reply: %', sqlerrm;
      end if;
  end;
  perform public.mark_feedback_read(v_limited_thread);
  if public.feedback_unread_count() <> 0 then
    raise exception 'the limited account still shows an unread reply';
  end if;

  execute 'reset role';
  select id into v_message
    from public.feedback_messages
   where thread_id = v_limited_thread and author_role = 'admin'
   order by created_at desc
   limit 1;
  delete from auth.users where id = v_admin;
  if not exists (
    select 1 from public.feedback_messages
     where id = v_message and author_role = 'admin'
  ) then
    raise exception 'deleting the administrator removed the reply';
  end if;
  delete from auth.users where id = v_owner;
  if exists (select 1 from public.feedback_threads where user_id = v_owner) then
    raise exception 'the account deletion left feedback behind';
  end if;
  if not exists (select 1 from public.calculations where user_id = v_other and id = v_foreign) then
    raise exception 'the foreign calculation disappeared';
  end if;

  select md5(string_agg(policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by policyname))
    into v_hash
  from pg_policies
  where schemaname = 'public' and tablename = 'calculations';
  if v_hash is distinct from 'f5358a58dff25773692f9fd77a40d8b5' then
    raise exception 'calculations policies changed: %', v_hash;
  end if;
  select md5(string_agg(policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by policyname))
    into v_hash
  from pg_policies
  where schemaname = 'public' and tablename = 'profiles';
  if v_hash is distinct from 'cb3734949ee0b2f5c91dd5aaa27ace62' then
    raise exception 'profiles policies changed: %', v_hash;
  end if;
  select md5(string_agg(policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by policyname))
    into v_hash
  from pg_policies
  where schemaname = 'public' and tablename = 'stripe_customers';
  if v_hash is distinct from 'e8a156124917b26436f4f63d3939f198' then
    raise exception 'stripe customer policies changed: %', v_hash;
  end if;
  select md5(string_agg(policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), '|' order by policyname))
    into v_hash
  from pg_policies
  where schemaname = 'public' and tablename = 'stripe_subscriptions';
  if v_hash is distinct from 'eaae5717b8f4fa1f224c28962a9912c4' then
    raise exception 'stripe subscription policies changed: %', v_hash;
  end if;
  if has_column_privilege('authenticated', 'public.calculations', 'user_id', 'UPDATE') then
    raise exception 'calculations.user_id became updatable';
  end if;
end $$;

rollback;
