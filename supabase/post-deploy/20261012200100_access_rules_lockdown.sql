-- PVNAVIGATOR_ access rules, step 2: close the direct INSERT path.
--
-- Lives in supabase/post-deploy/ so the local seed reaches the final state.
-- Its version is older than migrations already applied in production, so this
-- file must stay here. The production statement is
-- supabase/migrations/20261102202308_access_rules_lockdown.sql.
--
-- Code that still inserts into public.calculations directly fails with
-- "permission denied" from here on.
--
-- With this in place a browser cannot create a calculation row at all (step 1
-- already kept access_tier / address_key out of the column grant), so the
-- free-address / subscription accounting cannot be bypassed by saving rows
-- outside the RPC. Reads, the UPDATE column grant and DELETE stay as before.

revoke insert on table public.calculations from authenticated;
