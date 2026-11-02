# PVNavigator – Architecture Canon

## Philosophy

PVNavigator is a modular photovoltaic tool platform.

Core principles:

- Free tools must remain truly free.
- Physics and economy must be separated.
- UI and math must be separated.
- Single Source of Truth for calculations.
- No hidden selling logic in free tools.
- Engineering transparency: every production assumption cites an official source.

---

## PVNavigator Engineering Rule

**Any new engineering assumption may only become production logic after its
official source has been registered inside the central Methodik & Quellen
registry (`packages/pv-methodology`, `@pv-methodology/registry`).**

This includes (non-exhaustive):

- weather data, PVGIS, BDEW
- batteries, battery efficiencies, inverter assumptions, degradation
- heat pumps, EV, tariffs, economics
- standards (VDI, DIN, …)
- every constant used by the physics model

Rules:

1. Register the source in `@pv-methodology/registry` first (id, category, title,
   organization, description, official URL, version, dates).
2. Only then wire the number / dataset into `packages/*` production code.
3. Do **not** scatter official source URLs across apps, docs footnotes, or PDF
   templates. Consume `getMethodologySources()` / the registry instead.
4. Website (`/methodik`), Referenz (`/methodik/referenz`), documentation and future
   PDF reports all read from the same registry.
5. Empty category sections (e.g. economics, standards) stay visible until filled.

---

## Monorepo Structure

pvnavigator/
├── apps/
│   ├── pvnavigator-web/        # Public portal / hub (marketing + routing only)
│   ├── speicher-physik/        # Free – physical model
│   ├── speicher-wirtschaft/    # Economy + performance
│   └── pvshadow/               # Geometry / shading analysis
│
├── packages/
│   ├── pv-core/                # Pure physics & battery math
│   ├── pvgis-adapter/          # PVGIS normalization
│   ├── bdew-profile/           # Load profiles
│   ├── geocoding/              # Address / geocoding
│   ├── heatpump-profile/       # Measured heat-pump electrical profiles
│   ├── pv-methodology/         # Methodik & Quellen registry (SSOT for sources)
│   ├── auth-session/           # Shared Auth cookie / redirect helpers
│   └── pv-access/              # Access rules vocabulary: address key, tiers, German copy

---

## Rules

1. All math lives ONLY in packages/*
2. apps/* contain:
   - UI
   - server actions (orchestration only)
   - validation
3. No calculation logic inside apps/*
4. 8760 hours is canonical year model
5. No duplicated formulas across apps

---

## Product Separation

### Speicher Physik (Free)
- 8760 hours
- BDEW
- PVGIS
- Battery simulation
- No economy
- No pricing
- No 15-year aggregation

### Speicher Wirtschaft (Pro)
- 15-year aggregation
- Degradation
- Cost modeling
- Scenario simulation
- Extended reporting

### PVShadow
- Geometry
- Roof analysis
- Shading model

### PVNavigator Web (Portal)

Purpose:
- Public entry point (pvnavigator.de)
- Overview of all tools
- Links to:
  - Speicher Physik
  - Speicher Wirtschaft
  - PVShadow
- YouTube link
- Legal pages (Impressum, Datenschutz)

Rules:
- No calculation logic
- No imports from physics packages (`packages/pv-core`, PVGIS, BDEW, …)
- Pure presentation layer
- Acts as routing hub between services
- May import `@pv-auth/session` for the shared Auth cookie/redirect helpers
  and `@pv-access/core` for the access-rule vocabulary shown in `/konto`

This app must remain lightweight and independent of core logic.

---

## Identity and persistence (Phase 1)

One shared PVNavigator account across products. Authentication UI stays on
`pvnavigator.de`. SpeicherGrenze (`speicher.pvnavigator.de`) is a product on
that account. Identity is **Supabase Auth**; `auth.users` is the source of
identity. Email is not duplicated into application tables.

| Relation | Role |
|---|---|
| `auth.users` | Identity (email, credentials, confirmation) |
| `public.profiles` | Application profile (`id` = `auth.users.id`) |
| `public.calculations` | Completed, user-owned historical calculations |

A new Auth user gets a `profiles` row from a signup trigger
(`private.handle_new_user`). Authenticated clients may select/update their own
profile; they cannot insert arbitrary profiles.

**RLS is the ownership boundary.** A calculation belongs to exactly one
authenticated user (`user_id = auth.uid()`). Clients may select, insert,
update, and delete only their own rows, and cannot change `user_id`. Anonymous
roles have no table access. Organisations are not implemented; `user_id`
remains the creator / private owner if `organisation_id` is added later.

**Who can calculate:** Product information (landing page, Methodik, Referenz,
legal pages) stays public. **Executing** a SpeicherGrenze calculation requires
a PVNavigator account. `/calculate` and `POST /api/calculate` are
authentication-gated. Anonymous calculations are not allowed.

**Session:** One identity across products. Production uses a parent-domain
cookie (`.pvnavigator.de`) via `@supabase/ssr` so `pvnavigator.de` and
`speicher.pvnavigator.de` share the same Auth session. Localhost omits the
cookie domain.

**Calculation persistence:** store canonical input JSON plus a compact result
snapshot, with schema / battery-model versions. Do not persist 15-minute or
hourly kernel arrays. Opening an old calculation shows that snapshot;
recalculation is an explicit later user action.

Successful authenticated calculations are persisted automatically into
`public.calculations`. That table is the shared cross-product history
(`product_key` distinguishes SpeicherGrenze and future tools). Hub `/konto`
lists the current user's rows.

SpeicherGrenze reports are historical snapshots. Reopening a row does **not**
rerun physics, PVGIS, or the 15-minute kernel. `result_schema_version`
selects a reader (`speicher-grenze-result/v1` derives headline sizes;
`v2` prefers frozen `presentation` sizes stored at calculation time).
Unknown schema versions show a compatibility message instead of
recalculating.

The read-only historical report route is
`https://speicher.pvnavigator.de/result/<calculation-id>`.
Hub `/konto` links SpeicherGrenze rows there. Live calculation remains
`/calculate`.

Shared cookie/redirect helpers: `packages/auth-session` (`@pv-auth/session`).
Schema SQL: `supabase/migrations/`.

---

## Access rules (PVNAVIGATOR_)

One account, two kinds of access. The decision is taken **in the database**
(`SECURITY DEFINER` functions, per-user advisory lock), never in the browser.
The vocabulary (address key, tiers, German copy) lives in `packages/pv-access`
(`@pv-access/core`).

| Relation | Role |
|---|---|
| `public.free_addresses` | The single pinned free address per account |
| `public.subscription_periods` | One row per paid period (`period_start <= now() < period_end`), `address_limit` = 50 |
| `public.subscription_period_addresses` | Unique addresses that consumed a slot of a paid period |
| `public.calculations.access_tier` | `free` \| `paid` decided when the row was recorded; `null` = legacy |

**Free access.** After registration a user may pin one address for
SpeicherGrenze. It is pinned by the **first successful** calculation (a failed
run — geocoding, physics, validation — never pins). For that address any
parameters may be recalculated. Another address requires a subscription. No
monthly reset.

**Address identity.** `buildAddressKey()` normalises the *entered* fields
(case, whitespace, umlauts, `Str.` → `strasse`), so spelling variants do not
create a new object while different house numbers (`12`, `12a`, `12b`) stay
distinct. The geocoder's formatted address is used for display only, so a
later change in its formatting cannot silently turn a pinned address into a
new one.

**Subscription.** One paid period = 50 unique addresses across SpeicherGrenze
and the future RENDITEGUIDE. Re-calculating a known address inside the period
does not consume a slot; a new paid period counts an address once again.
Viewing and downloading saved reports never touches the quota. When the quota
is exhausted or the period is over, the free rules apply; saved reports stay
readable and their tier does not change.

**Flow.** `POST /api/calculate`: session → validation →
`check_calculation_access(address_key)` (read only, 403 with a German
explanation if refused) → physics → `record_completed_calculation(...)`
(atomic: re-check under lock, insert with tier, pin / count). Only the record
step pins or counts, so parallel requests and failed runs cannot over-consume.
If the check or the record step is technically unavailable (503 / stream
`code: "service_unavailable"`), the result is withheld — never shown without
accounting. The form shows such refusals (and access refusals, 403 /
`code: <reason>`) in a separate notice box, not as input errors.
Clients have **no** `INSERT` on `calculations` after the lockdown migration
(step 1 already excludes `access_tier` / `address_key` from the column grant)
and no write access to the access tables; `access_tier` is not in the
`UPDATE` column grant. The lockdown SQL lives in `supabase/post-deploy/`, not
in `supabase/migrations/`, so `supabase db push` cannot apply it before the
deployment it depends on. Rollout order: `supabase/README.md › Production
rollout order`.

**Reports.** The tier is stored with the calculation and read from there for
the PDF: free reports carry the marking "Nur zur privaten Nutzung" (one pale
diagonal outline beneath the content plus a footer caption on every page);
paid reports never do, also after the subscription ended; a free report does
not become paid because of a later subscription.

**Legacy rows** (`access_tier is null`, created before these rules) are shown
and exported unchanged, never re-marked, and never pin an address. Existing
users pin their free address with their next successful calculation.

Billing is connected in test mode only. The hub creates a Stripe Checkout
Session and a Customer Portal Session on the server; access is granted only
when the signed webhook records a paid invoice as one `subscription_periods`
row (`source = 'stripe'`, `external_ref` = invoice id, bounds from the invoice
line). The browser cannot insert a period. Live keys are refused. Rollout of
the additive Stripe migration stays in `migrations/` and does not move the
access lockdown out of `post-deploy/`.

---

This file defines the canonical structure.
Changes must respect this architecture.

---

## Heat-pump profiles

`packages/heatpump-profile` is the production package for measured heat-pump
electrical series. Selection is `(technology, dhwService)` plus optional
`profileId`. Runtime scales unit weights uniformly to the user annual kWh.

Profile-id grammar:

`{tech}-{dhw}-{dataset}-{optionalYear}-{building}-v{n}`

Shared envelope contract: `schemaVersion`, `profileId`, `technology`,
`dhwService`, `timeStepHours`, `steps`, `weights`,
`measuredAnnualElectricalKwh`, `quality`, `methodologySourceId`, `license`,
`generatorVersion`, `sourceWindow`, `calendarAlignment`, `seasonalShares`,
`fillSummary`. Dataset-specific provenance stays optional.

Methodology ids:

- `thermbuild-fordatis-486` — production Luft/Wasser
- `wpuq-wasserwasser-heatpump` — production Wasser/Wasser heat-pump profile
- `wpuq-scientific-data` — WPuQ household robustness only

Wasser/Wasser heating + DHW resolves to `ww-heating-dhw-wpuq-2019-sfh38-v1`.
Wasser/Wasser heating-only is unsupported. Robustness JSON under
`research/wpuq/processed/robustness/` is not part of the production catalogue.

---

## Related physics documents

| Document | Role |
|---|---|
| [`docs/internal/speicher-physics-model.md`](internal/speicher-physics-model.md) | Canonical implemented physics of SpeicherGrenze |
| [Load Profile Scaling Principle](internal/speicher-physics-model.md#load-profile-scaling-principle) | Annual kWh sets energy volume; the selected profile sets only the 15-minute temporal shape |
| [`docs/physics-model.md`](physics-model.md) | Former public simplified methodology (superseded by `/methodik`) |
