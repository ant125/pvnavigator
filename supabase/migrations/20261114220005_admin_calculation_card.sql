-- Extra stored figures on the administrator calculation card.
--
-- Replaces public.admin_user_card only. It still refuses every caller who is
-- not an administrator, still writes admin_user_viewed, and still returns one
-- page of scalar fields. The calculation id is included so a later read-only
-- report page can be addressed. The full input and result snapshot stay in
-- the table.
--
-- No table, row, grant, RLS policy, trigger, dashboard, list, PDF, billing
-- or calculation-engine function is changed. Missing presentation values and
-- missing heat-pump or EV flags stay null; they are not derived.

create or replace function private.admin_json_boolean(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'boolean' then (p_value #>> '{}')::boolean
    else null
  end;
$$;

revoke all on function private.admin_json_boolean(jsonb)
  from public, anon, authenticated, service_role;

comment on function private.admin_json_boolean(jsonb) is
  'A stored JSON boolean, or null when the value is missing or not a boolean.';

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
      c.id,
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
      private.admin_json_number(
        c.result_snapshot #> '{presentation,recommendedPlanningSize}'
      ) as planning_kwh,
      private.admin_json_boolean(c.input -> 'heatPumpEnabled') as heat_pump,
      private.admin_json_boolean(c.input #> '{ev,enabled}') as ev,
      left(nullif(btrim(c.battery_model_version), ''), 80) as battery_model_version,
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
          'id', id,
          'created_at', created_at,
          'address', address,
          'pv_kwp', pv_kwp,
          'consumption_kwh', consumption_kwh,
          'pv_yield_kwh', pv_yield_kwh,
          'speichergrenze_kwh', speichergrenze_kwh,
          'planning_kwh', planning_kwh,
          'heat_pump', heat_pump,
          'ev', ev,
          'battery_model_version', battery_model_version
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
  'One page of an account''s saved calculations for an administrator. Returns stored scalars and the calculation id, never the snapshot. A missing presentation or flag stays null. Writes admin_user_viewed with the page number only.';
