-- PVNAVIGATOR_ is free for every registered account.
--
-- Replaces only the access decision. Tables, rows, grants, RLS and the
-- calculation insert lockdown stay as they are. Existing users, profiles,
-- calculations, pinned addresses, subscription periods and invoices are not
-- updated or deleted.
--
-- record_completed_calculation() still inserts the calculation, which is the
-- usage record for addresses and runs. The new reason does not pin a single
-- free address and does not consume a subscription quota. Authentication and
-- a non-empty address key are still required. calculation_runs is unchanged.

create or replace function private.decide_calculation_access(
  p_user uuid,
  p_address_key text
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_user is null then
    return jsonb_build_object(
      'allowed', false, 'tier', null, 'reason', 'unauthenticated',
      'subscription', null, 'free_address_label', null
    );
  end if;

  if p_address_key is null or char_length(trim(p_address_key)) = 0 then
    return jsonb_build_object(
      'allowed', false, 'tier', null, 'reason', 'invalid_address',
      'subscription', null, 'free_address_label', null
    );
  end if;

  return jsonb_build_object(
    'allowed', true, 'tier', 'free', 'reason', 'open_access',
    'subscription', null, 'free_address_label', null
  );
end;
$$;

revoke all on function private.decide_calculation_access(uuid, text) from public, anon, authenticated;
grant execute on function private.decide_calculation_access(uuid, text) to postgres, service_role;

comment on function private.decide_calculation_access(uuid, text) is
  'Allows every authenticated account to calculate any address. Does not read or write quotas, subscriptions, or pinned addresses.';
