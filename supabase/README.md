# Supabase

Version-controlled schema for the existing PVNavigator Supabase project.

Convention:

- SQL migrations live in `migrations/`
- Do not create production tables only in the Dashboard
- Do not use Prisma

Apply migrations with the Supabase CLI (`supabase db push`) or the equivalent project migration API. The Data API must keep using the anon / publishable key in clients; never the service role.

Layout:

- `migrations/` – everything `supabase db push` may apply right now
- `post-deploy/` – SQL that must run only **after** a specific code deployment; never
  picked up by `db push` until it is moved into `migrations/`
- `config.toml`, `seed.sql` – local stack only (`supabase start`); see below. The repo is
  deliberately **not** linked to the hosted project (`supabase link` was not run), so a
  `db push` always has to state the project explicitly.

## Access rules (`migrations/20261012200000_access_rules.sql`, `post-deploy/20261012200100_access_rules_lockdown.sql`)

See `docs/ARCHITECTURE.md › Access rules`. Step 1 (`…200000`)

- adds `free_addresses`, `subscription_periods`, `subscription_period_addresses`
- adds `calculations.access_tier` / `address_key` (existing rows stay `null` = legacy)
- narrows the client `INSERT` grant on `calculations` to the pre-existing columns, so the
  code deployed before this step keeps saving (as legacy rows) but can never write a tier
- exposes two RPCs to `authenticated`: `check_calculation_access(text)` (read only) and
  `record_completed_calculation(text, text, jsonb)` (atomic under a per-user advisory lock)

Step 2 (`…200100`) revokes client `INSERT` on `calculations` entirely; from then on new rows
are created only by `record_completed_calculation()`.

Nothing in the browser can create a paid period. The functions use `auth.uid()`;
`set search_path = ''`, so the stubs in a local Postgres need `auth.uid()` and
`auth.users`.

### Production rollout order

The app code that calls the RPCs returns `503 Die Zugangsprüfung ist derzeit nicht
möglich …` (PostgREST `PGRST202`, function not in schema cache) until step 1 is applied,
and the code deployed before it fails to save once step 2 is applied. The two steps are
therefore kept in different directories so that no single command can run both:

1. **Step 1 – schema.** `supabase link --project-ref <prod-ref>` once, then
   `supabase db push --dry-run` (must list exactly `20261012200000_access_rules.sql`) and
   `supabase db push`. It applies only what is pending in `migrations/`; `post-deploy/` is
   not touched. Safe while the old code is live. Without the CLI: paste the file into the
   Dashboard SQL editor, then
   `insert into supabase_migrations.schema_migrations (version, name) values ('20261012200000', 'access_rules');`
2. **Deploy** the code that uses `check_calculation_access` / `record_completed_calculation`
   (both apps: speicher-physik and the hub, which reads `access_tier` and the access tables).
3. **Step 2 – lockdown.** Apply `migrations/20261102202308_access_rules_lockdown.sql`
   with `supabase db push --dry-run` (must list only that file) and then `supabase db push`.
   Leave `post-deploy/20261012200100_access_rules_lockdown.sql` where it is. Its old
   version must not be inserted into `migrations/` or into `schema_migrations`.

The lockdown is already applied in production as
`20261102202308_access_rules_lockdown.sql`. Keep that file in `migrations/`.
Do not move the older post-deploy file into `migrations/` or record its old
version in `schema_migrations`.

## Local development: local Supabase stack

Local work never touches the hosted project. `config.toml` describes a local stack
(`supabase start`), `seed.sql` creates two test users, and both apps read
`apps/*/.env.development.local` (higher `next dev` precedence than `.env.local`), which
points at `http://127.0.0.1:54321`. `apps/*/.env.local` keep the production values and
stay untouched; they are only used when `.env.development.local` is absent.

Tooling (macOS, installed once with Homebrew; no admin rights needed):

```bash
brew install supabase/tap/supabase   # Supabase CLI
brew install colima docker           # Docker runtime without Docker Desktop
colima start --cpu 4 --memory 6      # once per login session (Docker Desktop / OrbStack work too)
```

Stack:

```bash
supabase start      # first run pulls images; applies migrations/, post-deploy/*.sql, seed.sql
supabase status     # URLs + the (public, well-known) local anon key
supabase db reset   # wipe + re-apply migrations, post-deploy and seed
supabase stop       # keep data; `supabase stop --no-backup` to discard it
```

- API `http://127.0.0.1:54321` · Studio `http://127.0.0.1:54323` · Mailpit `http://127.0.0.1:54324`
- Realtime, Storage, Edge Runtime and Analytics are disabled in `config.toml` (not used).
- The local stack gets **both** steps applied (`migrations/` and `post-deploy/`), i.e. the
  final state after the production rollout.

Apps — ports are fixed by `@pv-auth/session`: hub `http://localhost:3000`, SpeicherGrenze
`http://localhost:3001`. The auth cookie is host-only on `localhost`, so one hub login is
valid on both ports.

```bash
npm run dev:hub               # apps/pvnavigator-web on :3000
npm run dev:speicher-physik   # apps/speicher-physik on :3001 (also: npm run dev)
```

`apps/*/.env.development.local` (same content in both apps; create if missing):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase status`>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_HUB_URL=http://localhost:3000
NEXT_PUBLIC_SPEICHER_GRENZE_URL=http://localhost:3001
```

### Seeded test users (`seed.sql`, local only)

| E-Mail             | Passwort           | Zugang                                               |
| ------------------ | ------------------ | ---------------------------------------------------- |
| `test@example.com` | `TestNutzer-2026!` | kostenlos, noch keine Adresse festgelegt             |
| `abo@example.com`  | `TestNutzer-2026!` | aktiver Testzeitraum, `address_limit = 2` (absichtlich klein) |

E-mail confirmation is off locally, so additional users can also be created through
`/konto-erstellen`. Mail goes to Mailpit, never to a real inbox.

### Test data: grant a paid period

Run in the SQL editor (or with the service role), never from the app:

```sql
-- 30 paid days from now, 50 addresses, marked as test data
insert into public.subscription_periods (user_id, period_start, period_end, address_limit, source)
values ('<auth.users.id>', now(), now() + interval '30 days', 50, 'test');

-- Quota behaviour with a small limit
insert into public.subscription_periods (user_id, period_start, period_end, address_limit, source)
values ('<auth.users.id>', now(), now() + interval '30 days', 2, 'test');

-- Period boundary: an already expired period
insert into public.subscription_periods (user_id, period_start, period_end, source)
values ('<auth.users.id>', now() - interval '40 days', now() - interval '10 days', 'test');

-- Inspect
select * from public.free_addresses where user_id = '<auth.users.id>';
select * from public.subscription_period_addresses where user_id = '<auth.users.id>';
select id, created_at, access_tier, address_key, summary_address
  from public.calculations where user_id = '<auth.users.id>' order by created_at desc;
```

Deleting a test period does not touch saved calculations; their `access_tier`
is frozen at creation.
