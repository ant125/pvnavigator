-- Account type and name for PVNAVIGATOR_ profiles.
--
-- Existing rows stay incomplete: every new column is null, and no calculation
-- row, grant or RLS policy is changed. A person chooses Privatperson or
-- Unternehmen and fills the required names. The type is never taken from the
-- e-mail address.
--
-- Signup metadata is copied only for the new account, and only for these four
-- keys. It is not an authorization source: the trigger cannot grant the
-- administrator role, and a later edit of raw_user_meta_data does not rewrite
-- the profile.

alter table public.profiles
  add column account_kind text,
  add column given_name text,
  add column family_name text,
  add column company_name text;

alter table public.profiles
  add constraint profiles_account_kind_known
    check (account_kind is null or account_kind in ('privat', 'unternehmen')),
  add constraint profiles_given_name_shape
    check (
      given_name is null
      or (
        given_name = btrim(given_name)
        and char_length(given_name) between 1 and 80
        and given_name !~ '[[:cntrl:]]'
      )
    ),
  add constraint profiles_family_name_shape
    check (
      family_name is null
      or (
        family_name = btrim(family_name)
        and char_length(family_name) between 1 and 80
        and family_name !~ '[[:cntrl:]]'
      )
    ),
  add constraint profiles_company_name_shape
    check (
      company_name is null
      or (
        company_name = btrim(company_name)
        and char_length(company_name) between 1 and 160
        and company_name !~ '[[:cntrl:]]'
      )
    ),
  add constraint profiles_account_shape
    check (
      (
        account_kind is null
        and given_name is null
        and family_name is null
        and company_name is null
      )
      or (
        account_kind = 'privat'
        and given_name is not null
        and family_name is not null
        and company_name is null
      )
      or (
        account_kind = 'unternehmen'
        and given_name is not null
        and family_name is not null
        and company_name is not null
      )
    );

comment on column public.profiles.account_kind is
  'privat or unternehmen. Null means the account has not chosen a type.';
comment on column public.profiles.given_name is
  'Vorname, or the Ansprechpartner Vorname of an Unternehmen.';
comment on column public.profiles.family_name is
  'Nachname, or the Ansprechpartner Nachname of an Unternehmen.';
comment on column public.profiles.company_name is
  'Firmenname. Only an Unternehmen has one.';

-- Own-row UPDATE already exists. These columns are the only new write surface.
grant update (account_kind, given_name, family_name, company_name)
  on table public.profiles to authenticated;

create or replace function private.guard_profile_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  new.given_name := nullif(btrim(new.given_name), '');
  new.family_name := nullif(btrim(new.family_name), '');
  new.company_name := nullif(btrim(new.company_name), '');
  if new.account_kind is not null then
    new.account_kind := nullif(btrim(new.account_kind), '');
  end if;
  if new.account_kind = 'privat' then
    new.company_name := null;
  end if;
  if old.account_kind is not null and new.account_kind is null then
    raise exception 'profile_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_profile_edit() from public, anon, service_role;
grant execute on function private.guard_profile_edit() to authenticated;

comment on function private.guard_profile_edit() is
  'Trims a profile edit and refuses to clear a saved account type. It does not read other rows.';

create trigger guard_profile_edit
  before update on public.profiles
  for each row
  execute function private.guard_profile_edit();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_kind text := nullif(btrim(v_meta->>'account_kind'), '');
  v_given text := nullif(btrim(v_meta->>'given_name'), '');
  v_family text := nullif(btrim(v_meta->>'family_name'), '');
  v_company text := nullif(btrim(v_meta->>'company_name'), '');
begin
  if v_kind is null and v_given is null and v_family is null and v_company is null then
    insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;
    return new;
  end if;

  if v_kind is distinct from 'privat' and v_kind is distinct from 'unternehmen' then
    raise exception 'profile_invalid' using errcode = '23514';
  end if;
  if v_given is null or v_family is null
     or char_length(v_given) > 80 or char_length(v_family) > 80
     or v_given ~ '[[:cntrl:]]' or v_family ~ '[[:cntrl:]]' then
    raise exception 'profile_invalid' using errcode = '23514';
  end if;
  if v_kind = 'privat' then
    v_company := null;
  elsif v_company is null or char_length(v_company) > 160 or v_company ~ '[[:cntrl:]]' then
    raise exception 'profile_invalid' using errcode = '23514';
  end if;

  insert into public.profiles (id, account_kind, given_name, family_name, company_name)
  values (new.id, v_kind, v_given, v_family, v_company)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function private.handle_new_user() to supabase_auth_admin;

comment on function private.handle_new_user() is
  'Creates the new account profile from four signup keys. Empty metadata stays incomplete. Other metadata, including any role claim, is ignored.';

-- The administrator overview now reads the stored type. Calculations stay aggregated as before.

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
    'unternehmen', (
      select count(*)::integer
        from auth.users u
        join public.profiles p on p.id = u.id
       where u.deleted_at is null
         and p.account_kind = 'unternehmen'
    ),
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
  'Administrator totals and the last 30 Europe/Berlin days. Unternehmen counts only profiles stored as unternehmen.';

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
      case
        when p.account_kind = 'privat' then left(btrim(p.given_name || ' ' || p.family_name), 200)
        when p.account_kind = 'unternehmen' then left(btrim(p.company_name), 200)
        else null
      end as display_name,
      u.email,
      case p.account_kind
        when 'privat' then 'privat'
        when 'unternehmen' then 'unternehmen'
        else 'nicht_angegeben'
      end as account_kind,
      u.created_at as registered_at,
      count(c.id)::integer as calculation_count,
      max(c.created_at) as last_calculation_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.calculations c on c.user_id = u.id
    where u.deleted_at is null
      and (
        v_pattern is null
        or coalesce(p.given_name, '') ilike v_pattern escape '\'
        or coalesce(p.family_name, '') ilike v_pattern escape '\'
        or coalesce(btrim(coalesce(p.given_name, '') || ' ' || coalesce(p.family_name, '')), '') ilike v_pattern escape '\'
        or coalesce(p.company_name, '') ilike v_pattern escape '\'
        or coalesce(u.email, '') ilike v_pattern escape '\'
      )
      and case v_kind
        when 'privat' then p.account_kind = 'privat'
        when 'unternehmen' then p.account_kind = 'unternehmen'
        when 'nicht_angegeben' then p.account_kind is null
        else true
      end
    group by u.id, p.account_kind, p.given_name, p.family_name, p.company_name, u.email, u.created_at
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
  'One page of accounts for an administrator. The name is the private name or the Firmenname. Search matches those names and the e-mail, never the address pattern.';

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
    'display_name', case
      when p.account_kind = 'privat' then left(btrim(p.given_name || ' ' || p.family_name), 200)
      when p.account_kind = 'unternehmen' then left(btrim(p.company_name), 200)
      else null
    end,
    'contact_name', case
      when p.account_kind = 'unternehmen' then left(btrim(p.given_name || ' ' || p.family_name), 200)
      else null
    end,
    'email', u.email,
    'account_kind', case p.account_kind
      when 'privat' then 'privat'
      when 'unternehmen' then 'unternehmen'
      else 'nicht_angegeben'
    end,
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
  'One page of an account''s saved calculations for an administrator. The name is the stored profile label. Writes admin_user_viewed with the page number only.';
