-- PVNAVIGATOR_ access rules, step 2: close the direct INSERT path.
--
-- Lives in supabase/post-deploy/ on purpose: `supabase db push` applies every
-- pending file in supabase/migrations/, and this one must NOT run before the
-- code that calls record_completed_calculation() is deployed. After that
-- deployment, move the file into supabase/migrations/ and push (or run it in
-- the SQL editor and record the version) — see supabase/README.md.
--
-- Code that still inserts into public.calculations directly fails with
-- "permission denied" from here on.
--
-- With this in place a browser cannot create a calculation row at all (step 1
-- already kept access_tier / address_key out of the column grant), so the
-- free-address / subscription accounting cannot be bypassed by saving rows
-- outside the RPC. Reads, the UPDATE column grant and DELETE stay as before.

revoke insert on table public.calculations from authenticated;
