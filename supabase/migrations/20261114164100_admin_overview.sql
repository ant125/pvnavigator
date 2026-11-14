-- Administrator dashboard, user list and user card for PVNAVIGATOR_.
--
-- Read-only for existing data. Adds functions and two indexes. It does not
-- change a table, row, grant, RLS policy, trigger or function of the
-- calculation, signup, PDF or billing paths, and it does not add an
-- administrator exception to any policy.
--
-- Every function refuses to run unless public.is_admin() is true for the
-- calling session. They are SECURITY DEFINER only so an administrator can
-- read account rows that own-row RLS correctly hides. The account type is
-- not stored yet: every account is reported as nicht_angegeben, and the
-- Unternehmen count is the number of stored Unternehmen accounts, which is
-- zero. Do not infer the type from the e-mail address.

-- ---------------------------------------------------------------------------
-- Helpers, not granted to the Data API
-- ---------------------------------------------------------------------------

create or replace function private.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_admin() from public, anon, authenticated, service_role;

comment on function private.assert_admin() is
  'Raises admin_required unless the calling session is an administrator.';

-- A stored JSON number, or null when the value is missing, not a number,
-- negative, or too large to be a sensible energy or capacity figure.
create or replace function private.admin_json_number(p_value jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'number' then null
    when (p_value #>> '{}')::numeric < 0 then null
    when abs((p_value #>> '{}')::numeric) >= 1000000000000 then null
    else (p_value #>> '{}')::numeric
  end;
$$;

revoke all on function private.admin_json_number(jsonb) from public, anon, authenticated, service_role;

-- Days, weeks and months are civil dates in Europe/Berlin. PostgreSQL weeks
-- start on Monday; the dashboard uses that, not the session TimeZone.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_week date;
  v_month date;
  v_start date;
  v_series jsonb;
begin
  perform private.assert_admin();

  v_today := (now() at time zone 'Europe/Berlin')::date;
  v_week := date_trunc('week', now() at time zone 'Europe/Berlin')::date;
  v_month := date_trunc('month', now() at time zone 'Europe/Berlin')::date;
  v_start := v_today - 29;

  select coalesce(jsonb_agg(
    jsonb_build_object('day', series.day::date, 'count', coalesce(counts.n, 0))
    order by series.day
  ), '[]'::jsonb)
    into v_series
  from generate_series(v_start::timestamp, v_today::timestamp, interval '1 day') as series(day)
  left join (
    select (c.created_at at time zone 'Europe/Berlin')::date as day,
           count(*)::integer as n
      from public.calculations c
      join auth.users u on u.id = c.user_id and u.deleted_at is null
     where (c.created_at at time zone 'Europe/Berlin')::date between v_start and v_today
     group by 1
  ) as counts on counts.day = series.day::date;

  return jsonb_build_object(
    'users', (
      select count(*)::integer from auth.users where deleted_at is null
    ),
    -- No account-type column exists yet, so no account is an Unternehmen.
    'unternehmen', 0,
    'calculations', (
      select count(*)::integer
        from public.calculations c
        join auth.users u on u.id = c.user_id and u.deleted_at is null
    ),
    'today', (
      select count(*)::integer
        from public.calculations c
        join auth.users u on u.id = c.user_id and u.deleted_at is null
       where (c.created_at at time zone 'Europe/Berlin')::date = v_today
    ),
    'week', (
      select count(*)::integer
        from public.calculations c
        join auth.users u on u.id = c.user_id and u.deleted_at is null
       where date_trunc('week', c.created_at at time zone 'Europe/Berlin')::date = v_week
    ),
    'month', (
      select count(*)::integer
        from public.calculations c
        join auth.users u on u.id = c.user_id and u.deleted_at is null
       where date_trunc('month', c.created_at at time zone 'Europe/Berlin')::date = v_month
    ),
    'series', v_series
  );
end;
$$;

revoke all on function public.admin_dashboard() from public, anon, service_role;
grant execute on function public.admin_dashboard() to authenticated;

comment on function public.admin_dashboard() is
  'Administrator totals and the last 30 Europe/Berlin days. Empty days are included. Account type is not stored yet, so unternehmen is 0.';

create or replace function public.admin_list_users(
  p_query text default null,
  p_kind text default 'alle',
  p_sort text default 'registrierung',
  p_direction text default 'desc',
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
  v_query text := left(btrim(coalesce(p_query, '')), 200);
  v_kind text := case
    when p_kind in ('privat', 'unternehmen', 'nicht_angegeben') then p_kind
    else 'alle'
  end;
  v_sort text := case when p_sort = 'aktivitaet' then 'aktivitaet' else 'registrierung' end;
  v_desc boolean := p_direction is distinct from 'asc';
  v_page integer := least(greatest(coalesce(p_page, 1), 1), 100000);
  v_size integer := least(greatest(coalesce(p_page_size, 20), 1), 25);
  v_pattern text := null;
  v_total integer;
  v_rows jsonb;
begin
  perform private.assert_admin();

  if v_query <> '' then
    v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with matched as (
    select
      u.id,
      left(nullif(btrim(p.display_name), ''), 200) as display_name,
      u.email,
      'nicht_angegeben'::text as account_kind,
      u.created_at as registered_at,
      count(c.id)::integer as calculation_count,
      max(c.created_at) as last_calculation_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.calculations c on c.user_id = u.id
    where u.deleted_at is null
      and (
        v_pattern is null
        or coalesce(p.display_name, '') ilike v_pattern escape '\'
        or coalesce(u.email, '') ilike v_pattern escape '\'
      )
      and case v_kind
        when 'alle' then true
        when 'nicht_angegeben' then true
        else false
      end
    group by u.id, p.display_name, u.email, u.created_at
  ),
  ranked as (
    select
      matched.*,
      row_number() over (
        order by
          case when v_sort = 'registrierung' and v_desc then registered_at end desc nulls last,
          case when v_sort = 'registrierung' and not v_desc then registered_at end asc nulls last,
          case when v_sort = 'aktivitaet' and v_desc then last_calculation_at end desc nulls last,
          case when v_sort = 'aktivitaet' and not v_desc then last_calculation_at end asc nulls first,
          id asc
      ) as ordinal,
      count(*) over ()::integer as total
    from matched
  )
  select
    coalesce((select max(total) from ranked), 0),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'display_name', display_name,
          'email', email,
          'account_kind', account_kind,
          'registered_at', registered_at,
          'calculation_count', calculation_count,
          'last_calculation_at', last_calculation_at
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
    'users', v_rows
  );
end;
$$;

revoke all on function public.admin_list_users(text, text, text, text, integer, integer)
  from public, anon, service_role;
grant execute on function public.admin_list_users(text, text, text, text, integer, integer)
  to authenticated;

comment on function public.admin_list_users(text, text, text, text, integer, integer) is
  'One page of accounts for an administrator. Search matches name and e-mail only. Every account is nicht_angegeben until the account type is stored.';

create or replace function public.admin_user_card(
  p_user_id uuid,
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_page integer := least(greatest(coalesce(p_page, 1), 1), 100000);
  v_size integer := least(greatest(coalesce(p_page_size, 10), 1), 25);
  v_user jsonb;
  v_total integer;
  v_rows jsonb;
begin
  perform private.assert_admin();

  if p_user_id is null then
    raise exception 'admin_subject_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'id', u.id,
    'display_name', left(nullif(btrim(p.display_name), ''), 200),
    'email', u.email,
    'account_kind', 'nicht_angegeben',
    'registered_at', u.created_at,
    'calculation_count', (
      select count(*)::integer from public.calculations c where c.user_id = u.id
    )
  )
    into v_user
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id
    and u.deleted_at is null;

  if v_user is null then
    raise exception 'admin_subject_not_found' using errcode = 'P0002';
  end if;

  insert into private.admin_audit_log (action, actor_user_id, target_user_id, db_role, details)
  values (
    'admin_user_viewed',
    auth.uid(),
    p_user_id,
    session_user,
    jsonb_build_object('page', v_page)
  );

  with ranked as (
    select
      c.created_at,
      left(nullif(btrim(c.summary_address), ''), 500) as address,
      coalesce(c.summary_pv_kwp, private.admin_json_number(c.input -> 'pvSystemKwP')) as pv_kwp,
      coalesce(
        c.summary_consumption_kwh,
        private.admin_json_number(c.input -> 'annualConsumptionKWh')
      ) as consumption_kwh,
      private.admin_json_number(
        c.result_snapshot #> '{verifiedResult,energy,year,pvYieldKwhAnnual}'
      ) as pv_yield_kwh,
      private.admin_json_number(
        c.result_snapshot #> '{presentation,recommendedTechnicalSize}'
      ) as speichergrenze_kwh,
      row_number() over (order by c.created_at desc, c.id desc) as ordinal,
      count(*) over ()::integer as total
    from public.calculations c
    where c.user_id = p_user_id
  )
  select
    coalesce((select max(total) from ranked), 0),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'created_at', created_at,
          'address', address,
          'pv_kwp', pv_kwp,
          'consumption_kwh', consumption_kwh,
          'pv_yield_kwh', pv_yield_kwh,
          'speichergrenze_kwh', speichergrenze_kwh
        )
        order by ordinal
      )
      from ranked
      where ordinal > (v_page - 1) * v_size
        and ordinal <= v_page * v_size
    ), '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object(
    'user', v_user || jsonb_build_object('calculation_count', v_total),
    'page', v_page,
    'page_size', v_size,
    'calculations', v_rows
  );
end;
$$;

revoke all on function public.admin_user_card(uuid, integer, integer)
  from public, anon, service_role;
grant execute on function public.admin_user_card(uuid, integer, integer)
  to authenticated;

comment on function public.admin_user_card(uuid, integer, integer) is
  'One page of an account''s saved calculations for an administrator, without the full snapshot. Writes admin_user_viewed to the audit log.';

-- Listing indexes. They do not change rows or policies.
create index calculations_created_at_idx
  on public.calculations (created_at);

create index calculations_user_created_at_idx
  on public.calculations (user_id, created_at desc);
