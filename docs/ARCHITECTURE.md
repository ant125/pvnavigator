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
│   └── pv-methodology/         # Methodik & Quellen registry (SSOT for sources)

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
