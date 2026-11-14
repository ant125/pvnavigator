-- Private feedback for a PVNAVIGATOR_ account.
--
-- Adds feedback_threads and feedback_messages, their RLS, and the functions
-- that create a thread and carry the conversation. A request belongs to the
-- PVNAVIGATOR_ account and names speicher_grenze or allgemein. A row remembers
-- the chosen calculation id and the three version strings when that calculation
-- belongs to the same account and product. It does not copy the profile, the
-- e-mail, or the calculation input and result.
--
-- Writes go through security definer functions. auth.uid() is the only owner
-- those functions accept. Administrators reach other accounts only after
-- private.assert_admin(), the same gate as the existing administration reads.
--
-- This migration does not change calculations, profiles, PDF, Stripe,
-- subscriptions, Trustpilot, or any policy on those tables.

-- ---------------------------------------------------------------------------
-- Threads and messages
-- ---------------------------------------------------------------------------

create table public.feedback_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_key text not null,
  category text not null,
  subject text not null,
  status text not null default 'neu',
  calculation_id uuid references public.calculations (id) on delete set null,
  battery_model_version text,
  input_schema_version text,
  result_schema_version text,
  user_read_at timestamptz,
  admin_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_threads_product_known
    check (product_key in ('speicher_grenze', 'allgemein')),
  constraint feedback_threads_category_known
    check (category in ('fehler', 'verbesserung')),
  constraint feedback_threads_status_known
    check (status in ('neu', 'in_bearbeitung', 'beantwortet', 'erledigt')),
  constraint feedback_threads_subject_shape
    check (
      char_length(subject) between 1 and 120
      and subject = regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g')
      and subject !~ '[[:cntrl:]]'
    ),
  constraint feedback_threads_battery_model_version_shape
    check (
      battery_model_version is null
      or (
        char_length(battery_model_version) between 1 and 80
        and battery_model_version !~ '[[:cntrl:]]'
      )
    ),
  constraint feedback_threads_input_schema_version_shape
    check (
      input_schema_version is null
      or (
        char_length(input_schema_version) between 1 and 80
        and input_schema_version !~ '[[:cntrl:]]'
      )
    ),
  constraint feedback_threads_result_schema_version_shape
    check (
      result_schema_version is null
      or (
        char_length(result_schema_version) between 1 and 80
        and result_schema_version !~ '[[:cntrl:]]'
      )
    )
);

comment on table public.feedback_threads is
  'One support request for a PVNAVIGATOR_ account, shared by every product. Personal data and calculation contents stay in their own tables.';

comment on column public.feedback_threads.product_key is
  'speicher_grenze or allgemein. wirtschaftlichkeit is reserved for RENDITEGUIDE and is rejected until that product is added here and in create_feedback_thread.';

comment on column public.feedback_threads.user_id is
  'Account that opened the request. Set from auth.uid() inside create_feedback_thread.';

comment on column public.feedback_threads.calculation_id is
  'Optional calculation the account explicitly attached. Null when that calculation is later deleted. The snapshot itself is not copied.';

comment on column public.feedback_threads.battery_model_version is
  'battery_model_version of the attached calculation at the moment the request was opened.';

comment on column public.feedback_threads.user_read_at is
  'When the account last opened the request. An administrator message newer than this is an unread reply.';

comment on column public.feedback_threads.admin_read_at is
  'When an administrator last opened the request. A user message newer than this is unread for administration. Administrator messages do not move this stamp.';

create table public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.feedback_threads (id) on delete cascade,
  body text not null,
  author_user_id uuid not null,
  author_role text not null,
  created_at timestamptz not null default now(),
  constraint feedback_messages_role_known
    check (author_role in ('user', 'admin')),
  constraint feedback_messages_body_shape
    check (
      char_length(body) between 1 and 4000
      and body = regexp_replace(body, '^[[:space:]]+|[[:space:]]+$', '', 'g')
      and translate(body, chr(10) || chr(13) || chr(9), '') !~ '[[:cntrl:]]'
    )
);

comment on table public.feedback_messages is
  'Immutable messages of a feedback thread. author_user_id has no foreign key so deleting an administrator keeps the reply for the account.';

comment on column public.feedback_messages.author_user_id is
  'auth.uid() of the writer. Not a foreign key: the text must outlive an administrator account. The account''s own deletion removes the thread.';

comment on column public.feedback_messages.author_role is
  'user or admin. A session cannot choose the other role.';

create index feedback_threads_user_created_idx
  on public.feedback_threads (user_id, created_at desc);

create index feedback_threads_updated_idx
  on public.feedback_threads (updated_at desc, id desc);

create index feedback_threads_calculation_idx
  on public.feedback_threads (calculation_id);

create index feedback_messages_thread_role_created_idx
  on public.feedback_messages (thread_id, author_role, created_at);

-- ---------------------------------------------------------------------------
-- Text, unread, and immutability. Not granted through the Data API.
-- ---------------------------------------------------------------------------

create or replace function private.feedback_subject(p_subject text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_subject text := regexp_replace(p_subject, '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if v_subject is null
     or char_length(v_subject) < 1
     or char_length(v_subject) > 120
     or v_subject ~ '[[:cntrl:]]' then
    raise exception 'feedback_invalid' using errcode = '22023';
  end if;
  return v_subject;
end;
$$;

create or replace function private.feedback_body(p_body text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_body text := regexp_replace(p_body, '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if v_body is null
     or char_length(v_body) < 1
     or char_length(v_body) > 4000
     or translate(v_body, chr(10) || chr(13) || chr(9), '') ~ '[[:cntrl:]]' then
    raise exception 'feedback_invalid' using errcode = '22023';
  end if;
  return v_body;
end;
$$;

create or replace function private.feedback_version(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text := nullif(btrim(p_value), '');
begin
  if v_value is null or char_length(v_value) > 80 or v_value ~ '[[:cntrl:]]' then
    return null;
  end if;
  return v_value;
end;
$$;

create or replace function private.feedback_user_unread(
  p_thread_id uuid,
  p_read_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.feedback_messages m
     where m.thread_id = p_thread_id
       and m.author_role = 'admin'
       and m.created_at > coalesce(p_read_at, '-infinity'::timestamptz)
  );
$$;

create or replace function private.feedback_admin_unread(
  p_thread_id uuid,
  p_read_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.feedback_messages m
     where m.thread_id = p_thread_id
       and m.author_role = 'user'
       and m.created_at > coalesce(p_read_at, '-infinity'::timestamptz)
  );
$$;

create or replace function private.feedback_messages_json(p_thread_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'body', m.body,
        'author_role', m.author_role,
        'created_at', m.created_at
      )
      order by m.created_at, m.id
    ),
    '[]'::jsonb
  )
  from public.feedback_messages m
  where m.thread_id = p_thread_id;
$$;

revoke all on function private.feedback_subject(text) from public, anon, authenticated, service_role;
revoke all on function private.feedback_body(text) from public, anon, authenticated, service_role;
revoke all on function private.feedback_version(text) from public, anon, authenticated, service_role;
revoke all on function private.feedback_user_unread(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.feedback_admin_unread(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.feedback_messages_json(uuid) from public, anon, authenticated, service_role;

create or replace function private.guard_feedback_thread()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.product_key is distinct from old.product_key
     or new.category is distinct from old.category
     or new.subject is distinct from old.subject
     or new.battery_model_version is distinct from old.battery_model_version
     or new.input_schema_version is distinct from old.input_schema_version
     or new.result_schema_version is distinct from old.result_schema_version
     or new.created_at is distinct from old.created_at
     or (
       new.calculation_id is distinct from old.calculation_id
       and new.calculation_id is not null
     ) then
    raise exception 'feedback_immutable' using errcode = '42501';
  end if;

  if new.status is not distinct from old.status
     and new.calculation_id is not distinct from old.calculation_id
     and (
       new.user_read_at is distinct from old.user_read_at
       or new.admin_read_at is distinct from old.admin_read_at
     ) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function private.guard_feedback_thread() from public, anon, authenticated, service_role;

create trigger guard_feedback_thread
  before update on public.feedback_threads
  for each row
  execute function private.guard_feedback_thread();

create or replace function private.prevent_feedback_message_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'feedback_message_immutable' using errcode = '42501';
end;
$$;

revoke all on function private.prevent_feedback_message_update() from public, anon, authenticated, service_role;

create trigger prevent_feedback_message_update
  before update on public.feedback_messages
  for each row
  execute function private.prevent_feedback_message_update();

-- ---------------------------------------------------------------------------
-- Grants and RLS. Select is limited to the owning account.
-- admin_read_at and the writer id are not part of that select.
-- ---------------------------------------------------------------------------

revoke all on table public.feedback_threads from public, anon, authenticated, service_role;
revoke all on table public.feedback_messages from public, anon, authenticated, service_role;

grant select (
  id,
  user_id,
  product_key,
  category,
  subject,
  status,
  calculation_id,
  battery_model_version,
  input_schema_version,
  result_schema_version,
  user_read_at,
  created_at,
  updated_at
) on table public.feedback_threads to authenticated;

grant select (id, thread_id, body, author_role, created_at)
  on table public.feedback_messages to authenticated;

alter table public.feedback_threads enable row level security;
alter table public.feedback_messages enable row level security;
alter table public.feedback_threads force row level security;
alter table public.feedback_messages force row level security;

create policy feedback_threads_select_own
  on public.feedback_threads
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

create policy feedback_messages_select_own
  on public.feedback_messages
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
        from public.feedback_threads t
       where t.id = feedback_messages.thread_id
         and t.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Account functions. The browser never supplies user_id.
-- ---------------------------------------------------------------------------

create or replace function public.create_feedback_thread(
  p_product_key text,
  p_category text,
  p_subject text,
  p_body text,
  p_calculation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_product text;
  v_category text;
  v_subject text;
  v_body text;
  v_at timestamptz;
  v_recent integer;
  v_thread uuid;
  v_engine text;
  v_input_schema text;
  v_result_schema text;
begin
  if v_user is null then
    raise exception 'feedback_unauthenticated' using errcode = '42501';
  end if;

  v_product := case p_product_key
    when 'speicher_grenze' then 'speicher_grenze'
    when 'allgemein' then 'allgemein'
    else null
  end;
  v_category := case p_category
    when 'fehler' then 'fehler'
    when 'verbesserung' then 'verbesserung'
    else null
  end;
  if v_product is null or v_category is null then
    raise exception 'feedback_invalid' using errcode = '22023';
  end if;
  if v_product = 'allgemein' and p_calculation_id is not null then
    raise exception 'feedback_invalid' using errcode = '22023';
  end if;
  v_subject := private.feedback_subject(p_subject);
  v_body := private.feedback_body(p_body);

  if p_calculation_id is not null then
    select c.battery_model_version, c.input_schema_version, c.result_schema_version
      into v_engine, v_input_schema, v_result_schema
      from public.calculations c
     where c.id = p_calculation_id
       and c.user_id = v_user
       and c.product_key = v_product;
    if not found then
      raise exception 'feedback_calculation_not_found' using errcode = 'P0002';
    end if;
    v_engine := private.feedback_version(v_engine);
    v_input_schema := private.feedback_version(v_input_schema);
    v_result_schema := private.feedback_version(v_result_schema);
  end if;

  perform pg_advisory_xact_lock(hashtext('pvn_feedback_user'), hashtext(v_user::text));

  select count(*)::integer into v_recent
    from public.feedback_threads
   where user_id = v_user
     and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'feedback_rate_limited' using errcode = 'P0001';
  end if;

  v_at := clock_timestamp();
  insert into public.feedback_threads (
    user_id, product_key, category, subject, status,
    calculation_id, battery_model_version, input_schema_version, result_schema_version,
    user_read_at, created_at, updated_at
  ) values (
    v_user, v_product, v_category, v_subject, 'neu',
    p_calculation_id, v_engine, v_input_schema, v_result_schema,
    v_at, v_at, v_at
  )
  returning id into v_thread;

  insert into public.feedback_messages (thread_id, body, author_user_id, author_role, created_at)
  values (v_thread, v_body, v_user, 'user', v_at);

  return v_thread;
end;
$$;

comment on function public.create_feedback_thread(text, text, text, text, uuid) is
  'Opens a request for auth.uid(). product_key is speicher_grenze or allgemein. A calculation must belong to that account and product. allgemein accepts none. At most 5 new requests an hour.';

create or replace function public.post_feedback_message(
  p_thread_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_body text;
  v_status text;
  v_recent integer;
  v_message uuid;
begin
  if v_user is null then
    raise exception 'feedback_unauthenticated' using errcode = '42501';
  end if;
  v_body := private.feedback_body(p_body);

  perform pg_advisory_xact_lock(hashtext('pvn_feedback_user'), hashtext(v_user::text));

  select status into v_status
    from public.feedback_threads
   where id = p_thread_id
     and user_id = v_user
   for update;
  if not found then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_recent
    from public.feedback_messages m
    join public.feedback_threads t on t.id = m.thread_id
   where t.user_id = v_user
     and m.author_role = 'user'
     and m.created_at > t.created_at
     and m.created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'feedback_rate_limited' using errcode = 'P0001';
  end if;

  if v_status in ('beantwortet', 'erledigt') then
    v_status := 'neu';
  end if;

  insert into public.feedback_messages (thread_id, body, author_user_id, author_role, created_at)
  values (p_thread_id, v_body, v_user, 'user', clock_timestamp())
  returning id into v_message;

  update public.feedback_threads
     set status = v_status
   where id = p_thread_id;

  return v_message;
end;
$$;

comment on function public.post_feedback_message(uuid, text) is
  'Adds a user message to an own thread. At most 20 such follow-ups an hour. beantwortet and erledigt return to neu.';

create or replace function public.mark_feedback_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'feedback_unauthenticated' using errcode = '42501';
  end if;

  update public.feedback_threads
     set user_read_at = clock_timestamp()
   where id = p_thread_id
     and user_id = v_user;
  if not found then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.mark_feedback_read(uuid) is
  'Marks the account''s own thread read. Does not change updated_at or status.';

create or replace function public.feedback_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'feedback_unauthenticated' using errcode = '42501';
  end if;

  select count(*)::integer into v_count
    from public.feedback_threads t
   where t.user_id = v_user
     and private.feedback_user_unread(t.id, t.user_read_at);
  return v_count;
end;
$$;

comment on function public.feedback_unread_count() is
  'How many of the account''s threads have an administrator reply newer than user_read_at.';

create or replace function public.list_feedback_threads()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user is null then
    raise exception 'feedback_unauthenticated' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    item order by updated_at desc, id desc
  ), '[]'::jsonb)
    into v_rows
  from (
    select
      jsonb_build_object(
        'id', t.id,
        'product_key', t.product_key,
        'category', t.category,
        'subject', t.subject,
        'status', t.status,
        'calculation_id', t.calculation_id,
        'created_at', t.created_at,
        'updated_at', t.updated_at,
        'unread', private.feedback_user_unread(t.id, t.user_read_at)
      ) as item,
      t.updated_at,
      t.id
    from public.feedback_threads t
    where t.user_id = v_user
  ) listed;
  return v_rows;
end;
$$;

comment on function public.list_feedback_threads() is
  'The calling account''s threads, newest activity first, with an unread flag.';

create or replace function public.get_feedback_thread(p_thread_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.feedback_threads;
begin
  if v_user is null then
    raise exception 'feedback_unauthenticated' using errcode = '42501';
  end if;

  select * into v_row
    from public.feedback_threads t
   where t.id = p_thread_id
     and t.user_id = v_user;
  if not found then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'product_key', v_row.product_key,
    'category', v_row.category,
    'subject', v_row.subject,
    'status', v_row.status,
    'calculation_id', v_row.calculation_id,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'unread', private.feedback_user_unread(v_row.id, v_row.user_read_at),
    'messages', private.feedback_messages_json(v_row.id)
  );
end;
$$;

comment on function public.get_feedback_thread(uuid) is
  'One own thread and its messages in chronological order. Missing and foreign ids are the same error.';

-- ---------------------------------------------------------------------------
-- Administration. Same role check as the existing admin reads.
-- ---------------------------------------------------------------------------

create or replace function public.admin_feedback_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.assert_admin();

  select count(*)::integer into v_count
    from public.feedback_threads t
   where private.feedback_admin_unread(t.id, t.admin_read_at);
  return v_count;
end;
$$;

comment on function public.admin_feedback_unread_count() is
  'Threads with a user message newer than admin_read_at, including status in_bearbeitung. Administrator replies do not count.';

create or replace function public.admin_list_feedback(
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := least(greatest(coalesce(p_page, 1), 1), 100000);
  v_size integer := least(greatest(coalesce(p_page_size, 20), 1), 25);
  v_total integer;
  v_rows jsonb;
begin
  perform private.assert_admin();

  with ranked as (
    select
      t.id,
      t.user_id,
      u.email,
      case
        when p.account_kind = 'privat' then left(btrim(p.given_name || ' ' || p.family_name), 200)
        when p.account_kind = 'unternehmen' then left(btrim(p.company_name), 200)
        else null
      end as display_name,
      case p.account_kind
        when 'privat' then 'privat'
        when 'unternehmen' then 'unternehmen'
        else 'nicht_angegeben'
      end as account_kind,
      t.product_key,
      t.category,
      t.subject,
      t.status,
      t.calculation_id,
      t.created_at,
      t.updated_at,
      private.feedback_admin_unread(t.id, t.admin_read_at) as unread,
      row_number() over (order by t.updated_at desc, t.id desc) as ordinal,
      count(*) over ()::integer as total
    from public.feedback_threads t
    join auth.users u on u.id = t.user_id and u.deleted_at is null
    left join public.profiles p on p.id = t.user_id
  )
  select
    coalesce((select max(total) from ranked), 0),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'user_id', user_id,
          'email', email,
          'display_name', display_name,
          'account_kind', account_kind,
          'product_key', product_key,
          'category', category,
          'subject', subject,
          'status', status,
          'calculation_id', calculation_id,
          'created_at', created_at,
          'updated_at', updated_at,
          'unread', unread
        )
        order by ordinal
      )
      from ranked
      where ordinal > (v_page - 1) * v_size
        and ordinal <= v_page * v_size
    ), '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'page_size', v_size,
    'threads', v_rows
  );
end;
$$;

comment on function public.admin_list_feedback(integer, integer) is
  'One page of feedback threads for an administrator. E-mail and name are read from Auth and profiles, not stored on the thread.';

create or replace function public.admin_get_feedback(p_thread_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_thread jsonb;
begin
  perform private.assert_admin();

  select jsonb_build_object(
    'id', t.id,
    'user_id', t.user_id,
    'email', u.email,
    'display_name', case
      when p.account_kind = 'privat' then left(btrim(p.given_name || ' ' || p.family_name), 200)
      when p.account_kind = 'unternehmen' then left(btrim(p.company_name), 200)
      else null
    end,
    'account_kind', case p.account_kind
      when 'privat' then 'privat'
      when 'unternehmen' then 'unternehmen'
      else 'nicht_angegeben'
    end,
    'product_key', t.product_key,
    'category', t.category,
    'subject', t.subject,
    'status', t.status,
    'calculation_id', t.calculation_id,
    'battery_model_version', t.battery_model_version,
    'input_schema_version', t.input_schema_version,
    'result_schema_version', t.result_schema_version,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'unread', private.feedback_admin_unread(t.id, t.admin_read_at),
    'messages', private.feedback_messages_json(t.id)
  )
    into v_thread
  from public.feedback_threads t
  join auth.users u on u.id = t.user_id and u.deleted_at is null
  left join public.profiles p on p.id = t.user_id
  where t.id = p_thread_id;

  if v_thread is null then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;
  return v_thread;
end;
$$;

comment on function public.admin_get_feedback(uuid) is
  'One thread for an administrator: author, versions, calculation id, and messages. The calculation snapshot is not included.';

create or replace function public.admin_post_feedback_message(
  p_thread_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_body text;
  v_status text;
  v_message uuid;
begin
  perform private.assert_admin();
  if v_admin is null then
    raise exception 'feedback_unauthenticated' using errcode = '42501';
  end if;
  v_body := private.feedback_body(p_body);

  select status into v_status
    from public.feedback_threads
   where id = p_thread_id
   for update;
  if not found then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;

  if v_status in ('neu', 'in_bearbeitung', 'erledigt') then
    v_status := 'beantwortet';
  end if;

  insert into public.feedback_messages (thread_id, body, author_user_id, author_role, created_at)
  values (p_thread_id, v_body, v_admin, 'admin', clock_timestamp())
  returning id into v_message;

  update public.feedback_threads
     set status = v_status
   where id = p_thread_id;

  return v_message;
end;
$$;

comment on function public.admin_post_feedback_message(uuid, text) is
  'Administrator reply. Not counted against the account''s hourly limits. neu, in_bearbeitung, and erledigt become beantwortet. Does not mark the thread read.';

create or replace function public.admin_set_feedback_status(
  p_thread_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if p_status is null
     or p_status not in ('neu', 'in_bearbeitung', 'beantwortet', 'erledigt') then
    raise exception 'feedback_invalid' using errcode = '22023';
  end if;

  update public.feedback_threads
     set status = p_status
   where id = p_thread_id;
  if not found then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_set_feedback_status(uuid, text) is
  'Sets the thread status. Only an administrator can call it.';

create or replace function public.admin_mark_feedback_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();

  update public.feedback_threads
     set admin_read_at = clock_timestamp()
   where id = p_thread_id;
  if not found then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_mark_feedback_read(uuid) is
  'Marks one thread read for administration. The administrator''s own replies do not do this.';

revoke all on function public.create_feedback_thread(text, text, text, text, uuid) from public, anon, service_role;
revoke all on function public.post_feedback_message(uuid, text) from public, anon, service_role;
revoke all on function public.mark_feedback_read(uuid) from public, anon, service_role;
revoke all on function public.feedback_unread_count() from public, anon, service_role;
revoke all on function public.list_feedback_threads() from public, anon, service_role;
revoke all on function public.get_feedback_thread(uuid) from public, anon, service_role;
revoke all on function public.admin_feedback_unread_count() from public, anon, service_role;
revoke all on function public.admin_list_feedback(integer, integer) from public, anon, service_role;
revoke all on function public.admin_get_feedback(uuid) from public, anon, service_role;
revoke all on function public.admin_post_feedback_message(uuid, text) from public, anon, service_role;
revoke all on function public.admin_set_feedback_status(uuid, text) from public, anon, service_role;
revoke all on function public.admin_mark_feedback_read(uuid) from public, anon, service_role;

grant execute on function public.create_feedback_thread(text, text, text, text, uuid) to authenticated;
grant execute on function public.post_feedback_message(uuid, text) to authenticated;
grant execute on function public.mark_feedback_read(uuid) to authenticated;
grant execute on function public.feedback_unread_count() to authenticated;
grant execute on function public.list_feedback_threads() to authenticated;
grant execute on function public.get_feedback_thread(uuid) to authenticated;
grant execute on function public.admin_feedback_unread_count() to authenticated;
grant execute on function public.admin_list_feedback(integer, integer) to authenticated;
grant execute on function public.admin_get_feedback(uuid) to authenticated;
grant execute on function public.admin_post_feedback_message(uuid, text) to authenticated;
grant execute on function public.admin_set_feedback_status(uuid, text) to authenticated;
grant execute on function public.admin_mark_feedback_read(uuid) to authenticated;
