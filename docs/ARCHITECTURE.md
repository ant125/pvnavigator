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
4. Website (`/methodik-quellen`), Technische Details, documentation and future
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
- No imports from packages/*
- Pure presentation layer
- Acts as routing hub between services

This app must remain lightweight and independent of core logic.

---

This file defines the canonical structure.
Changes must respect this architecture.
