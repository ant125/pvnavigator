# WPuQ HDF5 structure (as found locally)

Inspection target: `research/wpuq/raw/*_data_15min.hdf5`  
Generated tooling: `scripts/inspect_structure.py` → `processed/structure_summary.json`

This document records what Phase 1 actually found. It is not a substitute for the
Scientific Data descriptor ([10.1038/s41597-022-01156-1](https://doi.org/10.1038/s41597-022-01156-1)).

## Files inspected

| File | Year | Size (approx) | SFH houses | Leap year | Rows per SFH table |
| --- | --- | ---: | ---: | --- | ---: |
| `2018_data_15min.hdf5` | 2018 | ~449 MB | 38 | no | 35040 |
| `2019_data_15min.hdf5` | 2019 | ~438 MB | 37 | no | 35040 |
| `2020_data_15min.hdf5` | 2020 | ~427 MB | 36 | **yes** | **35136** |

House dropout vs full set of 38:

- **SFH24** present only in 2018 (missing thereafter; paper notes large gaps from Sep 2018)
- **SFH25** present in 2018–2019, absent in 2020

## Top-level groups

Every year file has:

```text
/
├── NO_PV/          # houses without rooftop PV self-consumption on the HH meter
├── WITH_PV/        # houses where PV self-consumption contaminates the HH meter
└── MISC/
    ├── ES1/TRANSFORMER/table   # district substation
    └── PV1/PV/INVERTER/{EAST,SOUTH,WEST}/table
```

Phase 1 inventory focuses on `NO_PV` and `WITH_PV` single-family houses only.

## House path pattern

```text
{NO_PV|WITH_PV}/SFH{n}/{HOUSEHOLD|HEATPUMP}/table
```

Examples:

- `NO_PV/SFH10/HOUSEHOLD/table`
- `NO_PV/SFH10/HEATPUMP/table`
- `WITH_PV/SFH15/HOUSEHOLD/table`

Both feeds exist for every SFH present in these 15-minute files.

## Timestamp semantics

- Column: `index` (`int64`)
- Meaning: Unix time in seconds
- Step: **900 s** (15 minutes), regular across the full calendar grid
- Grid span (from stored epoch values, reported as UTC ISO):
  - 2018: `2018-01-01T00:00:00+00:00` … `2018-12-31T23:45:00+00:00`
  - 2019: `2019-01-01T00:00:00+00:00` … `2019-12-31T23:45:00+00:00`
  - 2020: `2020-01-01T00:00:00+00:00` … `2020-12-31T23:45:00+00:00` (**includes Feb 29**)
- Missing measurements are **NaN** in the power columns; the time grid rows remain
- Publisher short-gap interpolation (≤1 day) is already baked into the released files; Phase 1 does **not** fill additional gaps

**Calendar alignment notes for later phases**

- PVNavigator production non-leap grid length = **35040** (matches 2018/2019 row counts)
- 2020 has **35136** rows; Phase 1 retains leap-day samples and records `is_leap_year=true`
- 2018 measurements typically become finite only from early/mid **May** → partial year

## Units and columns

Per Scientific Data Table 4 and local dtypes:

| Column pattern | Quantity | Unit |
| --- | --- | --- |
| `P_*` | Active power | W |
| `Q_*` | Reactive power | var |
| `S_*` | Apparent power | VA |
| `U_*` | Voltage | V |
| `I_*` | Current | A |
| `PF_*` | Power factor | — |

Power values are **interval means** (mean over each 15-minute bin).

### `NO_PV` / `HOUSEHOLD`

```text
index, S_1, S_2, S_3, S_TOT, I_1, I_2, I_3,
PF_1, PF_2, PF_3, PF_TOT,
P_1, P_2, P_3, P_TOT,
Q_1, Q_2, Q_3, Q_TOT,
U_1, U_2, U_3
```

### `WITH_PV` / `HOUSEHOLD`

Same as above, plus:

```text
P_TOT_WITH_PV   # meter reading including PV (can be negative when exporting)
P_TOT           # publisher-corrected household load estimate (PV removed)
```

Phase 1 annual household energy uses corrected `P_TOT`. Contaminated sums are also stored when present.

### `HEATPUMP` (both PV groups)

```text
index, S_TOT, PF_TOT, P_1, P_2, P_3, P_TOT, Q_1, Q_2, Q_3, Q_TOT
```

Heat-pump meters are separate from household circuits (unaffected by rooftop PV self-consumption on the HH meter).

## PV groups found locally

**WITH_PV houses (all years present):** `SFH13`, `SFH15`, `SFH26`, `SFH33`

All other SFH IDs in these files sit under `NO_PV`.

## Energy calculation used in Phase 1

For finite samples only:

\[
E_\mathrm{kWh} = \sum_i P_{\mathrm{TOT},i}\,[\mathrm{W}] \times 0.25\,\mathrm{h} / 1000
\]

No gap filling. Incomplete years are flagged via availability % and completeness class
(see `thresholds.json` / README).

## Observed quality patterns (local run)

- **2018:** all house-years `INCOMPLETE` or `EXCLUDE` (May start); not suitable as the primary full-year benchmark
- **2019:** best year — **30** `COMPLETE` household-years; **27** of them are `NO_PV` (preferred for BDEW H25 validation). Non-usable matches the paper’s known problem houses (`SFH6`, `13`, `17`, `25`, `31`, `37`, `40`; `SFH24` absent)
- **2020:** leap year retained; several houses degrade (e.g. `SFH6/8/13/15/17` exclude-level); prefer 2019 for first household benchmark
- Mean 2019 `COMPLETE` household ≈ 2899 kWh and heat pump ≈ 4993 kWh (aligned with paper averages ~2829 / ~4993)

## Out of scope here

No BDEW comparison, no `pv-core` / battery runs, no production wiring.
