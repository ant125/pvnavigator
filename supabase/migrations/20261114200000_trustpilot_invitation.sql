-- Trustpilot invitation stamps on the account, for every PVNAVIGATOR_ product.
--
-- Adds two nullable timestamps to public.profiles. Existing profile rows,
-- calculations, PDFs and billing rows are not rewritten. The first value of
-- each stamp is kept. A later update cannot clear or replace it.
--
-- trustpilot_shown_at: the invitation was displayed once for this account.
-- trustpilot_clicked_at: the account opened the Trustpilot link.
-- Neither stamp means that a review was published.

alter table public.profiles
  add column trustpilot_shown_at timestamptz,
  add column trustpilot_clicked_at timestamptz;

comment on column public.profiles.trustpilot_shown_at is
  'First time this account was shown the Trustpilot invitation. Null means not shown. Not a published review.';

comment on column public.profiles.trustpilot_clicked_at is
  'First time this account opened the Trustpilot link. Null means not opened. Not a published review.';

-- Own-row UPDATE already exists. These two columns are the only new write surface.
grant update (trustpilot_shown_at, trustpilot_clicked_at)
  on table public.profiles to authenticated;

create or replace function private.guard_trustpilot_stamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.trustpilot_shown_at is not null then
    new.trustpilot_shown_at := old.trustpilot_shown_at;
  elsif new.trustpilot_shown_at is not null or new.trustpilot_clicked_at is not null then
    new.trustpilot_shown_at := now();
  end if;

  if old.trustpilot_clicked_at is not null then
    new.trustpilot_clicked_at := old.trustpilot_clicked_at;
  elsif new.trustpilot_clicked_at is not null then
    new.trustpilot_clicked_at := now();
  end if;

  if new.trustpilot_clicked_at is not null and new.trustpilot_shown_at is null then
    new.trustpilot_shown_at := new.trustpilot_clicked_at;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_trustpilot_stamps() from public, anon, service_role;
grant execute on function private.guard_trustpilot_stamps() to authenticated;

comment on function private.guard_trustpilot_stamps() is
  'Keeps the first Trustpilot shown and click timestamps. A later update cannot clear or replace them, and a click also records that the invitation was shown. It does not record a published review.';

create trigger guard_trustpilot_stamps
  before update on public.profiles
  for each row
  execute function private.guard_trustpilot_stamps();

-- Same administrator payload as before, plus two account counts.
-- Existing keys stay. Deleted accounts are excluded. A click is not a review.

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
    'series', v_series,
    'trustpilot_shown', (
      select count(*)::integer
        from public.profiles p
        join auth.users u on u.id = p.id and u.deleted_at is null
       where p.trustpilot_shown_at is not null
    ),
    'trustpilot_clicked', (
      select count(*)::integer
        from public.profiles p
        join auth.users u on u.id = p.id and u.deleted_at is null
       where p.trustpilot_clicked_at is not null
    )
  );
end;
$$;

revoke all on function public.admin_dashboard() from public, anon, service_role;
grant execute on function public.admin_dashboard() to authenticated;

comment on function public.admin_dashboard() is
  'Administrator totals and the last 30 Europe/Berlin days. Unternehmen counts only profiles stored as unternehmen. trustpilot_shown and trustpilot_clicked count accounts, excluding deleted accounts, and do not mean a review was published.';
