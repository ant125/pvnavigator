# Phase 2 — BDEW H25 vs real WPuQ household load shapes

## Purpose

Quantify how much **household load shape alone** changes physical SpeicherGrenze KPIs
when annual consumption, PV series, and battery model are held fixed.

This is **research / validation / sensitivity analysis** within the WPuQ measured
cohort. It does **not** replace BDEW H25 as production SSOT.

## Cohort selection

Derived from Phase 1 `processed/inventory.json` (not a hard-coded house list):

- year = **2019**
- `pv_group` = **NO_PV** only (no meter PV contamination)
- HOUSEHOLD `completeness_class` = **COMPLETE**
- exactly **35040** intervals, zero missing / NaN after extraction
- no negative `P_TOT`

Expected size: **27** houses. Final list: `processed/benchmark_cohort_2019.json`.

### Why only 2019 NO_PV COMPLETE?

- 2018 starts mid-year for most sites → not a full calendar shape benchmark
- 2020 is leap year (35136 steps) and needs later calendar alignment to PVNavigator’s 35040 grid
- WITH_PV houses need corrected/contaminated power handling; deferred
- COMPLETE (≥99% availability in Phase 1 thresholds) minimizes gap artefacts

## Normalization (isolate shape)

Primary scenario annual household electricity: **5000 kWh**.

For each house:

```text
scaleFactor = 5000 / measuredAnnualKWh
normalizedIntervalEnergy = measuredIntervalEnergy * scaleFactor
```

Conversion from HDF5:

```text
interval_kWh = P_TOT[W] / 1000 * 0.25
```

BDEW reference:

```text
createUserLoadProfile15MinForYear(5000, 2019)
```

Raw measured annual kWh is retained in metadata; the primary shape benchmark does
**not** compare unequal annual totals against a fixed 5000 kWh BDEW profile.

## PV scenario (shared once)

Config: `phase2_config.json`

| Parameter | Value |
| --- | --- |
| Location | Hamelin vicinity (WPuQ district): 52.1036°N, 9.3556°E |
| Weather year | **2019** (single year, shared) |
| Database | PVGIS-SARAH2 (adapter default) |
| PV size | 10 kWp |
| Orientation | South (UI azimuth 180° → PVGIS aspect 0°) |
| Tilt | **35°** (Phase 2 brief; production live 4D Köln uses 30°) |
| Shading / HP / EV / reserve | none |

One PVGIS fetch → expand to 35040 quarter-hours → **identical PV array** for BDEW and all real houses.

## Battery assumptions (production reuse)

From `@pv-core` / SpeicherGrenze production path:

- `runPhysicalKernel` with `timeStepHours = 0.25`
- `DEFAULT_MULTI_YEAR_BATTERY_SIZES_KWH` = 5…30 kWh (+ explicit size 0 without storage)
- `DEFAULT_BATTERY_SPEC` (hybrid efficiencies, 15 W standby, 1%/month self-discharge, DoD 1.0)
- Hybrid power limits via `resolveHybridBatteryPowerLimitKw`
- Technical Speichergrenze via `buildSpeicherChartData` + `deriveRecommendedTechnicalSize` (ΔEV < 50 kWh plateau)

Planning recommendation is **not** a Phase 2 target.

## Metric definitions (production reuse)

| Metric | Definition used |
| --- | --- |
| Eigenverbrauch | Kernel self-consumption with storage; size 0 = `calculateEigenverbrauch` / without-storage |
| Eigenverbrauchsquote | EV / PV yield |
| Autarkie | EV / load |
| Netzbezug | `averageGridToHouseholdKwh` (size > 0); size 0 = load − EV |
| Einspeisung | `averageGridExportKwh` (size > 0); size 0 = PV − EV |
| Technical Speichergrenze | Plateau on mean Eigenverbrauch vs size curve |

## Heat pump (prepared, not simulated)

2019 usable HEATPUMP cohort statistics only (`results/heatpump_2019_*`).
Standby / compressor / rod bins use paper thresholds (&lt;100 W / ≤4 kW / &gt;4 kW) as
**research classifications**, not ground truth. HH+HP combined battery runs are a later phase.

## Limitations

- Houses are from **one district in Lower Saxony** — not statistically representative of Germany
- Results are framed as “within the WPuQ measured cohort”
- Single weather year (2019), not the production 2006–2020 multi-year average
- Tilt 35° differs from the Köln 30° live-4D production check scenario
- No shading, HP, EV, or tariff layer
- Completeness thresholds are explicit in `thresholds.json` but still convention-based

## How to run

```bash
# Python deps (h5py, numpy, matplotlib)
/tmp/wpuq-venv/bin/pip install -r research/wpuq/requirements.txt matplotlib

# Full Phase 2
/tmp/wpuq-venv/bin/python research/wpuq/scripts/run_phase2.py
```

Or step-wise: `build_benchmark_cohort.py` → `heatpump_2019_stats.py` →
`npx tsx --tsconfig apps/speicher-physik/tsconfig.json research/wpuq/scripts/run_bdew_vs_real_benchmark.ts`
→ `plot_phase2.py`.

## Outputs

| Path | Content |
| --- | --- |
| `processed/benchmark_cohort_2019.json` | Cohort metadata |
| `processed/profiles_2019_normalized/` | Per-house 35040 kWh arrays (local / gitignored) |
| `results/bdew_vs_real_2019_detail.csv` | profile × battery size |
| `results/bdew_vs_real_2019_summary.json` | Distributions + BDEW position |
| `results/bdew_vs_real_2019_summary.csv` | Flat summary stats |
| `results/representative_profiles.json` | Low / median / high autarkie houses |
| `results/heatpump_2019_*` | HP research stats |
| `results/plots/*.png` | Research plots |
