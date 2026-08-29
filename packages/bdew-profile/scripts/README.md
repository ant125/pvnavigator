# BDEW H25 quarter-hour generator (Phase 4B)

## Source

- File: `apps/speicher-physik/src/app/(speicher)/data/source/bdew_representative_profiles_2025.xlsx`
- Sheet: **H25** (household representative profile 2025)
- Native resolution: **96 quarter-hour slots per day** (`00:00-00:15` … `23:45-00:00`)
- Columns: 12 months × `{SA, FT, WT}`

This is **not** classic BDEW H0. Existing hourly files and APIs still use the
legacy H0 name; they were built from this H25 sheet by summing four
quarter-hours and applying one uniform annual scale.

## Generate

From the repo root (after `npm install`):

```bash
npm run generate:h25 --workspace=packages/bdew-profile
```

Reads the XLSX (generator only; `jszip` is a **devDependency**).
Writes `src/bdew_h25_quarter_hour.ts`.

Production runtime never parses XLSX.

## Provenance / semantics (parity with current hourly production)

| Rule | Phase 4B |
|---|---|
| Sunday | uses **FT** template |
| Saturday | SA |
| Other weekdays | WT |
| Weekday public holidays (e.g. 2025-12-25) | **not** remapped; stay WT |
| Dynamisierungsfunktion | **not** applied |
| Leap day | omitted (same 365-day grid as hourly / PVGIS) |
| Reference year | 2025 |
| Normalization | one scale so `sum(365 × 96) = 1_000_000 kWh` |

User scaling (`createUserLoadProfile15MinForYear`) divides by the **actual**
remapped-year sum. Do not also multiply by `annual / 1e6` on already-scaled
weights.

## Runtime API (not production-wired)

- `buildBdewH25QuarterHourWeightsForYear(year)` → 35040 reference weights
- `createUserLoadProfile15MinForYear(annualKWh, year)` → 35040, sum = annualKWh

SpeicherGrenze still calls `createUserLoadProfileForYear` (8760 hourly).

## Hourly artifact (rollback)

Keep `data/bdew_h0_hourly_nonleap.csv` and `src/bdew_h0.ts`. They remain the
production load path until Phase 4D.
