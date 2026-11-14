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

The published product is free. Every registered account may calculate any
number of different addresses, download the PDF and use the result
commercially. RENDITEGUIDE and PVShadow stay unpublished. The decision is
taken **in the database** (`private.decide_calculation_access`, called by the
`SECURITY DEFINER` RPCs under a per-user advisory lock), never in the browser.
The vocabulary lives in `packages/pv-access` (`@pv-access/core`).

| Relation | Role |
|---|---|
| `public.free_addresses` | Historical pins. New calculations do not insert or change one |
| `public.subscription_periods` | Historical paid periods. They neither grant nor limit access |
| `public.subscription_period_addresses` | Addresses formerly counted against a paid period. New calculations do not consume a slot |
| `public.calculations` | Usage record. New rows store `access_tier = free` and reason `open_access`; older rows keep `free`, `paid` or `null` |

**Open access.** A signed-in user with a non-empty address key is allowed.
There is no monthly address quota and no paywall. A missing session and a
blank address key are still refused. `public.calculation_runs` still limits
automated bursts: one concurrent run and at most 12 starts per 10 minutes.

**Address identity.** `buildAddressKey()` normalises the *entered* fields
(case, whitespace, umlauts, `Str.` → `strasse`), so spelling variants do not
create a new object while different house numbers (`12`, `12a`, `12b`) stay
distinct. The geocoder's formatted address is used for display only. The key
is stored with the calculation so new addresses, repeat runs and PDF exports
remain countable.

**Flow.** `POST /api/calculate`: session → validation →
`check_calculation_access(address_key)` → physics →
`record_completed_calculation(...)`. The record step inserts the calculation.
It pins a free address only for the historical reason `free_claim_pending`
and counts a subscription address only for `subscription_new_address`.
`open_access` does neither. Viewing or downloading a saved report does not
write a calculation. If the check or the record step is technically
unavailable (503 / stream `code: "service_unavailable"`), the result is
withheld. Clients have no `INSERT` on `calculations`; rows are created only
by `record_completed_calculation()`.

**Reports.** PDFs do not carry a private-use restriction. The stored tier of
an existing row is left as it is.

**Billing.** Stripe products, prices, customers, invoices and the billing
code stay in the repository for a possible later monetization.
`PUBLIC_PAID_BILLING_ENABLED` is `false`. Checkout, upgrades, plan changes
and the subscription portal return to the hub before Stripe is called, including
direct API requests. The webhook still stores signed events and, while
billing is paused, does not cancel a subscription or void an invoice. Invoice
history stays available. Setting the constant back to `true` is a deliberate
product decision; it does not by itself restore an address quota.

The free decision is `supabase/migrations/20261113203647_free_open_access.sql`.
It replaces only `private.decide_calculation_access` and is already recorded in
production. On 2026-11-14 the two VAT migration filenames were aligned with their
existing production versions (`20261106181748` / `20261106202138`) after verifying
that the stored SQL matches. All local and remote migration versions now match.
This reconciliation changed filenames only; no SQL was reapplied and no production
history rows were altered. See `supabase/README.md` for the old-to-new mapping.


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
