# WPuQ research dataset (Phase 1)

**Research / validation only.** WPuQ is **not** the production load-profile source of truth.
PVNavigator production continues to use BDEW H25
(`packages/bdew-profile` ← `bdew_representative_profiles_2025.xlsx`).
Do not wire these profiles into SpeicherGrenze, user-selectable loads, or `pv-core` in this phase.

## Dataset

| Field | Value |
| --- | --- |
| Title | Dataset on electrical single-family house and heat pump load profiles in Germany |
| Project | Wind-Solar-Heat Pump District (WPuQ) |
| Authors | Marlon Schlemminger, Tobias Ohrdes, Elisabeth Schneider, Michael Knoop |
| Zenodo DOI | [10.5281/zenodo.5642902](https://doi.org/10.5281/zenodo.5642902) |
| Zenodo URL | https://zenodo.org/records/5642902 |
| Scientific Data article | Schlemminger et al., *Sci Data* 9, 56 (2022) — [10.1038/s41597-022-01156-1](https://doi.org/10.1038/s41597-022-01156-1) |
| License / provenance | Open research data on Zenodo as published with the Scientific Data descriptor; respect the Zenodo record license and citation requirements when redistributing derivatives |
| Scope used here | 15-minute aggregated electrical measurements for 38 German single-family houses (HOUSEHOLD and HEATPUMP separately), years 2018–2020 |

## Exact raw filenames expected

Place files manually under `research/wpuq/raw/` (never commit them):

```text
research/wpuq/raw/2018_data_15min.hdf5
research/wpuq/raw/2019_data_15min.hdf5
research/wpuq/raw/2020_data_15min.hdf5
```

These are the Zenodo 15-minute resolution measurement files for each year.
Other Zenodo products (10 s, 1 min, 60 min, weather, district heating) are out of scope for Phase 1.

## Download instructions

1. Open https://doi.org/10.5281/zenodo.5642902
2. Download the three `*_data_15min.hdf5` year files (or the matching archive entries)
3. Copy them into `research/wpuq/raw/`
4. Confirm sizes are on the order of hundreds of MB each
5. Run the Phase 1 scripts (below)

**Raw HDF5 must never be committed.** Root `.gitignore` ignores `research/wpuq/raw/*` (except `.gitkeep`) and `research/**/*.hdf5` / `*.h5`.

## Directory layout

```text
research/wpuq/
  README.md                 # this file
  requirements.txt          # h5py, numpy (research only)
  thresholds.json           # editable completeness thresholds
  raw/                      # local HDF5 only (gitignored)
  processed/                # inventory.json, annual_sums.csv, structure_summary.json
  scripts/                  # Phase 1 Python tools
  results/                  # reserved for later benchmark outputs
  docs/structure.md         # what was found in the local files
```

## Completeness classes (editable)

Thresholds live in [`thresholds.json`](./thresholds.json):

| Class | Default rule | Meaning |
| --- | --- | --- |
| `COMPLETE` | availability ≥ **99%** | Nearly full calendar coverage |
| `USABLE_WITH_SMALL_GAPS` | **95%** ≤ availability < **99%** | High coverage; OK for early benchmarks |
| `INCOMPLETE` | **50%** ≤ availability < **95%** | Biased annual totals if summed over finite samples only |
| `EXCLUDE` | availability < **50%** | Too sparse |

Availability = finite `P_TOT` samples / expected calendar quarter-hours
(35040 non-leap, **35136 leap**). **Gaps are never filled.** Change the JSON and re-run
`scripts/build_inventory.py` to recalculate classes.

“Usable for benchmark” in outputs = `COMPLETE` or `USABLE_WITH_SMALL_GAPS`.

## Calendar notes

- **2018**: many houses start around May → partial year → usually `INCOMPLETE` / `EXCLUDE`
- **2019**: best primary full-year household benchmark candidate (non-leap, 35040 steps)
- **2020**: leap year; **Feb 29 is retained** in Phase 1. Later phases will align to PVNavigator’s 35040-step non-leap grid without deleting leap-day data here

Timestamps in the files are Unix seconds on a regular 900 s grid. Phase 1 reports them as UTC ISO strings from the stored epoch values.

## HOUSEHOLD vs HEATPUMP

Keep feeds separate in all outputs:

- **HOUSEHOLD** → later validate BDEW H25 and PV/battery metrics
- **HEATPUMP** → later validate / improve the Wärmepumpe model

`WITH_PV` houses expose `P_TOT_WITH_PV` (meter, may be negative) and publisher-corrected `P_TOT`.
Phase 1 annual household kWh uses corrected `P_TOT` and records PV status explicitly.

## Phase 2 — BDEW vs real load shapes

See [`docs/phase2_benchmark.md`](./docs/phase2_benchmark.md).

```bash
/tmp/wpuq-venv/bin/pip install -r research/wpuq/requirements.txt
/tmp/wpuq-venv/bin/python research/wpuq/scripts/run_phase2.py
```

Primary question: holding annual load (5000 kWh), PV, and battery model fixed, how do
Eigenverbrauch / Autarkie / Netzbezug / technical Speichergrenze change when BDEW H25
is replaced by measured 2019 NO_PV COMPLETE household shapes?

## Phase 3 — Wärmepumpe vs measured HEATPUMP

See [`docs/phase3_heatpump.md`](./docs/phase3_heatpump.md).

```bash
/tmp/wpuq-venv/bin/python research/wpuq/scripts/run_phase3.py
```

Compares unmodified `createHeatPumpComponent15Min(4000)` to the 2019 usable
HEATPUMP cohort (~30 houses), all normalized to 4000 kWh/year. Research only;
no production changes.

Outputs: `results/heatpump_validation/` (CSV, JSON, plots,
`Phase3_Waermepumpe_Benchmark.md`).

## Run Phase 1

```bash
# one-time research venv (outside Yandex sync if needed)
python3 -m venv /tmp/wpuq-venv
/tmp/wpuq-venv/bin/pip install -r research/wpuq/requirements.txt

/tmp/wpuq-venv/bin/python research/wpuq/scripts/run_phase1.py
# or individually:
/tmp/wpuq-venv/bin/python research/wpuq/scripts/inspect_structure.py
/tmp/wpuq-venv/bin/python research/wpuq/scripts/build_inventory.py
```

Outputs:

- `processed/structure_summary.json`
- `processed/inventory.json`
- `processed/annual_sums.csv`

## Phase 3 — Wärmepumpe vs measured HEATPUMP

See [`docs/phase3_heatpump.md`](./docs/phase3_heatpump.md).

```bash
/tmp/wpuq-venv/bin/python research/wpuq/scripts/run_phase3.py
```

Compares unmodified `createHeatPumpComponent15Min(4000)` to the 2019 usable
HEATPUMP cohort (~30 houses), all normalized to 4000 kWh/year. Research only;
no production changes.

Outputs: `results/heatpump_validation/` (CSV, JSON, plots,
`Phase3_Waermepumpe_Benchmark.md`).

## Production Wasser/Wasser asset

The selected SFH38 2019 HEATPUMP series is generated by
`scripts/generate_heatpump_production_profile.py` as:

`processed/ww-heating-dhw-wpuq-2019-sfh38-v1.json`

The production copy lives at
`packages/heatpump-profile/data/wasserwasser/ww-heating-dhw-wpuq-2019-sfh38-v1.json`
and is the catalogue default for Wasser/Wasser heating + DHW.

Profile-id grammar (shared with ThermBuild):
`{tech}-{dhw}-{dataset}-{optionalYear}-{building}-v{n}`.

Methodology source: `wpuq-wasserwasser-heatpump` (`load_profiles`). This is
**not** `wpuq-scientific-data` (household robustness).

The 24 robustness houses stay under `processed/robustness/` with research ids
(`ww-wpuq-2019-sfh{nn}-v1`) and are not catalogued.

## Explicitly out of scope (Phase 1)

- Comparison against BDEW H25
- `pv-core` / battery simulations
- Changes to SpeicherGrenze or heat-pump production logic
- UI / report wiring
- Making WPuQ a selectable user load profile
