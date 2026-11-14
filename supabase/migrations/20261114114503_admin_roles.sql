-- Administrator role for PVNAVIGATOR_.
--
-- Adds two tables in the private schema and one public function. Nothing that
-- exists is changed: no table, row, grant, RLS policy, trigger or function of
-- the calculation, signup, PDF or billing paths is touched.
--
-- An administrator is an ordinary account with one extra row in
-- private.admin_users. The row is keyed by auth.users.id, never by e-mail.
-- The account keeps its own calculations and the same own-row RLS access as
-- every other account; this migration grants it no additional table access.
-- Later administrative reads go through separate functions that call
-- public.is_admin() themselves.
--
-- This migration creates no administrator. Granting the role is a separate,
-- explicitly approved statement per environment (see supabase/README.md).

-- ---------------------------------------------------------------------------
-- Role table
-- ---------------------------------------------------------------------------

create table private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text,
  constraint admin_users_note_length
    check (note is null or char_length(note) <= 500)
);

comment on table private.admin_users is
  'Accounts with the administrator role. One row per auth.users.id. Written only with SQL by the database owner; not reachable through the Data API.';

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
-- No foreign keys: an entry must outlive the account it refers to.

create table private.admin_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  action text not null,
  actor_user_id uuid,
  target_user_id uuid,
  db_role text not null default session_user,
  details jsonb not null default '{}'::jsonb,
  constraint admin_audit_log_action_nonempty
    check (char_length(trim(action)) > 0)
);

comment on table private.admin_audit_log is
  'Append-only trail of administrative events. actor_user_id is auth.uid() of the acting account, null for SQL run directly by a database role.';

create index admin_audit_log_occurred_at_idx
  on private.admin_audit_log (occurred_at desc);

-- The private schema is not exposed through the Data API. RLS without policies
-- and the explicit revokes keep both tables closed even if that ever changes.
alter table private.admin_users enable row level security;
alter table private.admin_audit_log enable row level security;

revoke all on table private.admin_users from public, anon, authenticated, service_role;
revoke all on table private.admin_audit_log from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record every grant, change and revocation of the role
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the entry is also written when the row disappears through
-- the cascade from auth.users (account deletion by supabase_auth_admin).

create or replace function private.log_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into private.admin_audit_log (action, actor_user_id, target_user_id, db_role)
    values ('admin_role_revoked', auth.uid(), old.user_id, session_user);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    insert into private.admin_audit_log (action, actor_user_id, target_user_id, db_role, details)
    values (
      'admin_role_changed', auth.uid(), new.user_id, session_user,
      jsonb_build_object('previous_user_id', old.user_id, 'note', new.note)
    );
    return new;
  end if;

  insert into private.admin_audit_log (action, actor_user_id, target_user_id, db_role, details)
  values (
    'admin_role_granted', auth.uid(), new.user_id, session_user,
    jsonb_build_object('note', new.note)
  );
  return new;
end;
$$;

revoke all on function private.log_admin_role_change() from public, anon, authenticated;

create trigger log_admin_role_change
  after insert or update or delete on private.admin_users
  for each row
  execute function private.log_admin_role_change();

-- ---------------------------------------------------------------------------
-- Role check
-- ---------------------------------------------------------------------------
-- The only way application code learns the role. It answers for the caller's
-- own auth.uid() and takes no argument, so it cannot be asked about another
-- account. Without a signed-in user it returns false.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.admin_users
     where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

comment on function public.is_admin() is
  'True when the calling account (auth.uid()) has a row in private.admin_users. Read only.';
