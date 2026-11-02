-- Close the direct INSERT path on public.calculations.
--
-- New rows are created only by public.record_completed_calculation(), which
-- runs as the function owner and decides the access tier itself. SELECT,
-- the existing UPDATE column grant, and DELETE stay as they are. The older
-- file supabase/post-deploy/20261012200100_access_rules_lockdown.sql is the
-- same statement for the local seed and must not be copied into migrations/
-- under its original version.

revoke insert on table public.calculations from authenticated;
