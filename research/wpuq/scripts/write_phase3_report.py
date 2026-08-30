#!/usr/bin/env python3
"""Write Phase3_Waermepumpe_Benchmark.md from validation JSON."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results" / "heatpump_validation"
SUMMARY = RESULTS / "summary.json"
OUT = RESULTS / "Phase3_Waermepumpe_Benchmark.md"


def pct(x, digits=1) -> str:
    if x is None:
        return "n/a"
    return f"{100.0 * float(x):.{digits}f}%"


def num(x, digits=1, unit="") -> str:
    if x is None:
        return "n/a"
    s = f"{float(x):.{digits}f}"
    return f"{s} {unit}".strip() if unit else s


def dist_line(st: dict, *, as_pct=False, unit="") -> str:
    if not st:
        return "n/a"
    fmt = (lambda v: pct(v)) if as_pct else (lambda v: num(v, 1, unit))
    return (
        f"median {fmt(st['median'])}, mean {fmt(st['mean'])}, "
        f"P25–P75 {fmt(st['p25'])}–{fmt(st['p75'])}, "
        f"P05–P95 {fmt(st['p05'])}–{fmt(st['p95'])}, "
        f"std {fmt(st['std'])}"
    )


def verdict_word(v: str) -> str:
    return {
        "optimistic": "optimistic",
        "conservative": "conservative",
        "neutral_within_iqr": "neutral (within IQR)",
        "neutral": "neutral",
    }.get(v, v)


def main() -> int:
    s = json.loads(SUMMARY.read_text(encoding="utf-8"))
    d_shape = s["distributions"]["normalized_shape"]
    d_raw = s["distributions"]["raw_physical"]
    prod = s["production"]
    cmp_ = s["comparisons"]
    verd = s["verdict"]
    arch = s["architecture"]
    rec = arch["recommendation"]
    n = s["cohort_size"]
    houses = ", ".join(s["house_ids"])
    overall = verd["overall"]
    rep = s["representative"]["house_id"]
    closest = verd["closest_house_monthly_to_production"]

    k2 = s["clusters"]["k2"]["clusters"]
    k2_txt = []
    for name, c in k2.items():
        seas = c["centroid_seasonal_shares"]
        k2_txt.append(
            f"- **{name}** (n={c['size']}): "
            f"{', '.join(c['house_ids'])}. "
            f"Centroid winter {pct(seas['winter'])}, summer {pct(seas['summer'])}. "
            f"Median measured annual {num(c['median_measured_annual_kwh'], 0, 'kWh')}."
        )

    k3_txt = []
    for name, c in s["clusters"]["k3"]["clusters"].items():
        seas = c["centroid_seasonal_shares"]
        k3_txt.append(
            f"- **{name}** (n={c['size']}): {', '.join(c['house_ids'])}. "
            f"Winter {pct(seas['winter'])}, summer {pct(seas['summer'])}."
        )

    headline_rows = []
    for k, h in verd["headline_metrics"].items():
        headline_rows.append(
            f"| `{k}` | {num(h['production'], 4)} | {num(h['cohort_median'], 4)} | "
            f"{num(h['cohort_p25'], 4)}–{num(h['cohort_p75'], 4)} | "
            f"{verdict_word(h['verdict'])} |"
        )

    month_names = (
        "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    )
    month_rows = []
    for i, name in enumerate(month_names, start=1):
        key = f"m{i:02d}_share"
        st = d_shape[key]
        p = cmp_[key]
        month_rows.append(
            f"| {name} | {pct(p['production'])} | {pct(st['median'])} | "
            f"{pct(st['p25'])}–{pct(st['p75'])} | {verdict_word(p['verdict'])} |"
        )

    md = f"""# Phase 3 — Wärmepumpe benchmark (WPuQ 2019)

**Research / validation only.** Production code was not modified.
`createHeatPumpComponent15Min` and `calculateSpeicherResult` were not changed.
WPuQ is **not** a production SSOT.

## Purpose

Validate the current PVNavigator Wärmepumpe model against **real measured**
2019 WPuQ HEATPUMP profiles, holding annual energy fixed at **4000 kWh** so
the comparison is about **shape**, not consumption.

Primary questions:

1. Does the synthetic seasonal model match measured monthly / seasonal / diurnal structure?
2. Is the production model optimistic, neutral, or conservative relative to this cohort?
3. Can a synthetic model still represent median behaviour, or should production
   migrate to a measured-based profile — and if so, which architecture?

## Executive answers

| Question | Answer |
| --- | --- |
| Close enough for a 15-min PV+battery kernel? | **No.** Winter/summer split is outside the cohort IQR; cycling and peaks are missing entirely. |
| Optimistic / neutral / conservative? | **Optimistic** (6 of 8 headline metrics). Seasonal PV coincidence overstated; peaks understated. |
| Can we keep a synthetic monthly model? | Only as a **fallback**. Retuning 1.65/1.00/0.42 would fix months, not cycling. |
| Replace with measured-based? | **Yes, when you next touch HP production.** Not in this phase. |
| One profile or several? | **One default (SFH38)** plus optional **k=2 cluster** representatives. Not interval-wise median. Not bins by annual kWh. |

## Cohort

Derived from Phase 1 `processed/inventory.json` (same rule as Phase 2 HP stats):

- year = **2019**
- HEATPUMP `completeness_class` ∈ `COMPLETE` ∪ `USABLE_WITH_SMALL_GAPS`
- 35040 quarter-hour intervals
- HOUSEHOLD PV group does **not** contaminate HEATPUMP meters (feeds are separate)

**Cohort size: {n} houses**

`{houses}`

Local time for hour-of-day, weekday, and typical days: **Europe/Berlin**.
Standby / compressor / heating-rod bins follow Schlemminger et al. (Sci Data 2022)
interpretive thresholds (**&lt;100 W** / **≤4 kW** / **&gt;4 kW**) — research
classification only, not ground truth of machine state.

## Production model under test

Unmodified call:

```text
createHeatPumpComponent15Min(4000)
```

Source: `apps/speicher-physik/src/load/heatpump.ts` `seasonalMultiplier`
(0-indexed months):

| Months | Multiplier |
| --- | ---: |
| Jan, Feb, Mar, Nov, Dec | 1.65 |
| Apr, May, Sep, Oct | 1.00 |
| Jun, Jul, Aug | 0.42 |

Properties of this model (by construction):

- piecewise-constant **within each month** (no diurnal pattern)
- **no compressor cycling**
- **no heating rod**
- **no weekday/weekend** difference
- every 15-minute interval in a month has the same energy

Exported profile sum: **{num(s['production_source']['sum_kwh'], 3, 'kWh')}**.

## Normalization

For every real house:

```text
scaleFactor = 4000 / measuredAnnualKWh
normalizedIntervalEnergy = measuredIntervalEnergy × scaleFactor
```

Raw measured annual kWh, peaks, and mode shares (standby / compressor / rod)
are reported **unscaled** (physical meaning). Shape comparisons (monthly shares,
hour-of-day, duration curves, heat-maps) use the **4000 kWh** series.

4000 kWh is close to this cohort’s measured median
({num(d_raw['annual_kwh_measured']['median'], 0, 'kWh')}).

---

## 1. Measured cohort characterization (raw 2019)

### Annual energy

{dist_line(d_raw['annual_kwh_measured'], unit='kWh')}

Range: {num(d_raw['annual_kwh_measured']['min'], 0, 'kWh')} –
{num(d_raw['annual_kwh_measured']['max'], 0, 'kWh')}.
The spread is large: a single 4000 kWh synthetic profile cannot represent
absolute consumption, only a scaled shape.

### Seasonal shares (raw; identical to normalized shares)

| Season | Cohort |
| --- | --- |
| Winter DJF | {dist_line(d_raw['raw_season_winter_share'], as_pct=True)} |
| Spring MAM | {dist_line(d_raw['raw_season_spring_share'], as_pct=True)} |
| Summer JJA | {dist_line(d_raw['raw_season_summer_share'], as_pct=True)} |
| Autumn SON | {dist_line(d_raw['raw_season_autumn_share'], as_pct=True)} |

Measured heat-pump electricity is **strongly winter-dominated**. Summer is
mostly domestic hot water (a few percent of annual energy for most houses).

### Operating / standby / heating rod (raw)

| Metric | Cohort |
| --- | --- |
| Standby interval share (&lt;100 W) | {dist_line(d_raw['raw_share_standby_intervals'], as_pct=True)} |
| Compressor interval share | {dist_line(d_raw['raw_share_compressor_intervals'], as_pct=True)} |
| Heating-rod interval share (&gt;4 kW) | {dist_line(d_raw['raw_share_heating_rod_intervals'], as_pct=True)} |
| Standby **energy** share | {dist_line(d_raw['raw_share_standby_energy'], as_pct=True)} |
| Compressor **energy** share | {dist_line(d_raw['raw_share_compressor_energy'], as_pct=True)} |
| Heating-rod **energy** share | {dist_line(d_raw['raw_share_heating_rod_energy'], as_pct=True)} |
| Operating hours | {dist_line(d_raw['raw_operating_hours'], unit='h')} |
| Standby hours | {dist_line(d_raw['raw_standby_hours'], unit='h')} |
| Median operating run length | {dist_line(d_raw['raw_median_run_hours'], unit='h')} |
| Mean operating run length | {dist_line(d_raw['raw_mean_run_hours'], unit='h')} |
| Peak 15-min mean power | {dist_line(d_raw['raw_peak_power_w'], unit='W')} |
| Median operating power | {dist_line(d_raw['raw_median_operating_power_w'], unit='W')} |
| Mean operating power | {dist_line(d_raw['raw_mean_operating_power_w'], unit='W')} |

Real machines **cycle**. A large fraction of the year is standby; when they run,
power is typically ~0.5–2 kW (compressor) with occasional multi-kW rod bursts.
Rod **interval** share is small; rod **energy** share is larger because those
intervals are high power.

Mean operating-run length is dominated by always-on outliers (houses with
~0% standby, one run lasting most of the year). **Median run length (~0.5 h)**
is the relevant cycling statistic.

### Weekday / weekend (raw daily kWh)

Weekend/weekday daily-energy ratio:
{dist_line(d_raw['raw_weekend_to_weekday_ratio'])}.

Near 1.0 means space-heating dominated (calendar does not care about weekends).
Deviations indicate DHW / occupancy effects.

---

## 2–4. Production vs real (shape, 4000 kWh)

### Overall verdict

**The current production model is {overall}** relative to the WPuQ 2019
usable HEATPUMP cohort.

Headline metric counts: {verd['headline_metric_counts']['optimistic']} optimistic,
{verd['headline_metric_counts']['conservative']} conservative,
{verd['headline_metric_counts']['neutral_within_iqr']} within IQR.

{verd['interpretation']}

The optimism is **seasonal and structural**, not a clock-hour PV-window artefact:
winter share is ~19 percentage points too low, summer ~6 points too high,
the model is always-on at ~0.2–0.7 kW, and it has no heating-rod bursts.
Annual hour-of-day energy shares and the 09–16 PV window sit **inside the
cohort IQR** (production is almost 1/24 per hour; so is the cohort median).

RMSE of monthly shares vs cohort-median monthly vector:
**{num(verd['rmse_monthly_shares_vs_cohort_median'], 4)}**.
RMSE of hour-of-day shares vs cohort-median hourly vector:
**{num(verd['rmse_hourly_shares_vs_cohort_median'], 4)}**.

House nearest production monthly shape: **{closest}**.
House nearest cohort-median monthly shape (representative): **{rep}**.

### Headline comparisons

| Metric | Production | Cohort median | P25–P75 | Verdict |
| --- | ---: | ---: | ---: | --- |
{chr(10).join(headline_rows)}

### Monthly shares

| Month | Production | REAL median | REAL P25–P75 | Verdict |
| --- | ---: | ---: | ---: | --- |
{chr(10).join(month_rows)}

**What matches (weakly):** shoulder months can fall nearer the cohort IQR than
deep winter / mid summer. The model *does* put more energy in winter than in
summer — the sign of seasonality is correct.

**What differs (materially):**

1. **Winter share is too low.** Production winter ≈ {pct(prod['season_winter_share'])}
   vs cohort median {pct(d_shape['season_winter_share']['median'])}
   (mean {pct(d_shape['season_winter_share']['mean'])}).
2. **Summer share is too high.** Production summer ≈ {pct(prod['season_summer_share'])}
   vs cohort median {pct(d_shape['season_summer_share']['median'])}.
   Extra summer HP load coincides with high PV — this is the main **optimistic**
   bias for Eigenverbrauch of the heat-pump portion.
3. **Intra-day *annual energy* allocation is close.** Production hour-of-day
   shares are almost 1/24 (entropy {num(prod['hourly_share_entropy'], 3)} vs
   cohort median {num(d_shape['hourly_share_entropy']['median'], 3)}).
   PV-window share production {pct(prod['pv_window_share'])} vs median
   {pct(d_shape['pv_window_share']['median'])} — **within IQR**. The miss is
   not “the model puts HP at night vs day over the year”. Winter *typical
   days* still show a mild morning peak in the measured median that a
   monthly constant cannot represent.
4. **No cycling.** Production operating-interval share
   {pct(prod['operating_interval_share'])} (always on at a few hundred watts).
   Cohort median operating share
   {pct(d_shape['operating_interval_share_normalized']['median'])}.
5. **No peaks / no rod.** Production peak 15-min power
   {num(prod['peak_power_w'], 0, 'W')} vs cohort median
   {num(d_shape['peak_power_w_normalized']['median'], 0, 'W')}
   after 4000 kWh scaling (raw unscaled peaks:
   {num(d_raw['raw_peak_power_w']['median'], 0, 'W')}; scaled peaks can be
   higher because small-annual houses are scaled up).
   Production heating-rod energy share is **{pct(prod['share_heating_rod_energy'])}**.
6. **Daily duration is too flat.** Production daily kWh P95
   {num(prod['daily_kwh_p95'], 2, 'kWh')} vs cohort median
   {num(d_shape['daily_kwh_p95']['median'], 2, 'kWh')} at the same 4000 kWh/year.
7. **Weekday/weekend:** production ratio is exactly 1.
   Cohort: {dist_line(d_shape['weekend_to_weekday_ratio'])}.
   This is a match, not a miss.

### Why this is optimistic for SpeicherGrenze / PV self-consumption

Holding annual HP kWh fixed:

- Too much energy in **PV-rich summer** and too little in **PV-poor winter**
  → overstated HP Eigenverbrauch, overstated Autarkie, understated winter
  Netzbezug. This is the main PV-coincidence bias.
- **Smooth always-on** power is easier for PV and a small battery to cover than
  compressor bursts and rod spikes.
- Clock-hour allocation over the *full year* is **not** the problem (PV window
  and night shares are inside the IQR).

The model is **not** conservative on peaks: it understates grid/inverter
stress from rod events. That is optimistic for comfort of the simulation,
not for electrical design.

A retune of the three monthly multipliers could fix (1)–(2) only. It cannot
fix (3)–(6). Monthly seasonality is necessary but not sufficient for a
15-minute PV+battery kernel.

---

## 5. Statistics

Full tables: `cohort_distributions.csv`, `house_characterization_raw.csv`,
`house_shape_normalized_4000.csv`, `production_vs_cohort.csv`.

Every metric includes **median, P25–P75, P05–P95, mean, std** (sample std, ddof=1).

Selected normalized shape metrics:

| Metric | Production | Cohort |
| --- | ---: | --- |
| Winter share | {pct(prod['season_winter_share'])} | {dist_line(d_shape['season_winter_share'], as_pct=True)} |
| Summer share | {pct(prod['season_summer_share'])} | {dist_line(d_shape['season_summer_share'], as_pct=True)} |
| PV window share (local 09–16) | {pct(prod['pv_window_share'])} | {dist_line(d_shape['pv_window_share'], as_pct=True)} |
| Night share (local 22–06) | {pct(prod['night_window_share'])} | {dist_line(d_shape['night_window_share'], as_pct=True)} |
| Peak power (scaled) | {num(prod['peak_power_w'], 0, 'W')} | {dist_line(d_shape['peak_power_w_normalized'], unit='W')} |
| Median operating power (scaled) | {num(prod['median_operating_power_w'], 0, 'W')} | {dist_line(d_shape['median_operating_power_w_normalized'], unit='W')} |

---

## 6–7. Can a synthetic model represent the median?

**Monthly median: only if multipliers are retuned.** The current 1.65 / 1.00 / 0.42
set is the wrong winter/summer split for this district-year.

**15-minute median behaviour: no.** Real median behaviour is *cycling with
winter-dominated energy*, not a constant monthly kW. An interval-wise median
across houses is the wrong object:

- Interval-wise **mean** operating share after re-normalization to 4000 kWh:
  {pct(arch['interval_wise_mean_after_renorm']['operating_interval_share'])}
  (smears asynchronous compressors into a smoother profile).
- Interval-wise **median** sum before re-normalization:
  {num(arch['interval_wise_median_after_renorm']['sum_before_renorm_kwh'], 1, 'kWh')};
  operating share after re-normalization
  {pct(arch['interval_wise_median_after_renorm']['operating_interval_share'])}.
  When houses are off at different times, the timestamp-wise median sits near
  standby; scaling that series back to 4000 kWh invents an artificial shape.

**Is the current model close enough?** **No** — not for a 15-minute physical
kernel that is used to compute Eigenverbrauch, Autarkie, Netzbezug, and
technical Speichergrenze with heat pump enabled. It is an acceptable *order of
magnitude* seasonal sketch, not a measured-equivalent load.

**Should production migrate to a measured-based model?** **Yes, if** heat-pump
users are a product-critical path. The cleanest research-backed architecture
is below. This Phase 3 does **not** implement that migration.

### Architecture options

| Option | Verdict |
| --- | --- |
| **A. Interval-wise median real profile** | Reject as a 15-min load series (cycling cancelled). |
| **B. Clustered profiles** | **Preferred** if the product can ship 2–3 shapes. |
| **C. One representative real house** | **Best single-profile default** (house **{rep}** here). |
| **D. Different profile by annual kWh** | **Not justified**: corr(annual kWh, winter share) = {num(arch['correlation_measured_annual_vs_winter_share'], 2)}; corr vs summer share = {num(arch['correlation_measured_annual_vs_summer_share'], 2)}. Shape looks like system/building type, not size. |

k=2 clusters (monthly-share vectors, normalized) — useful product split
**moderate winter** vs **strong winter** (not “DHW vs heating” as a clean
label; SFH5’s high summer share sits inside the moderate-winter cluster):

{chr(10).join(k2_txt)}

k=3 mainly splits the winter-heavy group further; the 16-house moderate
cluster is unchanged. Prefer k=2 for a product:

{chr(10).join(k3_txt)}

Recommended production architecture (when — not now — you choose to replace
the synthetic series):

1. Keep `createHeatPumpComponent15Min` as an explicit **fallback / regression** helper.
2. Add a **package-level** 35040-step measured-derived profile (not in `apps/`),
   scaled to the user-entered annual HP kWh (same pattern as BDEW).
3. Ship **one default = representative house nearest median monthly shares**
   (`{rep}` in this 2019 cohort), plus **optionally 2 cluster representatives**
   (heating-dominated / strong-winter vs moderate-winter) if the UI can ask a simple
   question (e.g. “high space-heating share” vs “flatter year-round HP use”).
4. Register sources in `@pv-methodology` (WPuQ Zenodo + Sci Data paper +
   processing note). Do not hardcode Zenodo URLs in the UI.
5. **Do not** average 30 houses interval-wise. **Do not** pick profiles by
   annual kWh alone.

License / provenance: WPuQ is open research data
([Zenodo 10.5281/zenodo.5642902](https://doi.org/10.5281/zenodo.5642902),
Schlemminger et al., Sci Data 9, 56 (2022)). A production derivative must
respect that license and remain a **research-validated template**, not a claim
that every German heat pump looks like Lower Saxony 2019.

---

## 8. Plots

All under `results/heatpump_validation/plots/`:

| File | Content |
| --- | --- |
| `monthly_comparison.png` | Monthly kWh, REAL band vs production |
| `seasonal_shares.png` | DJF/MAM/JJA/SON shares |
| `typical_winter_day.png` | Mean DJF diurnal (kW) |
| `typical_spring_day.png` | Mean MAM diurnal |
| `typical_summer_day.png` | Mean JJA diurnal |
| `typical_autumn_day.png` | Mean SON diurnal |
| `calendar_winter_day.png` | 2019-01-15 |
| `calendar_spring_day.png` | 2019-04-15 |
| `calendar_summer_day.png` | 2019-07-15 |
| `calendar_autumn_day.png` | 2019-10-15 |
| `daily_duration_curve.png` | Sorted daily kWh |
| `load_duration_curve.png` | Sorted 15-min power |
| `power_histogram.png` | All-interval power density |
| `operating_histogram.png` | ≥100 W operating power |
| `hourly_distribution.png` | Hour-of-day energy share |
| `weekday_weekend.png` | Mean daily kWh weekday vs weekend |
| `cumulative_energy_calendar.png` | Cumulative kWh vs day of year |
| `cumulative_energy_duration.png` | Lorenz-like sorted intervals |
| `heatmap_median_vs_production.png` | Hour × day heat-map |
| `heatmap_representative_vs_production.png` | `{rep}` vs production |
| `measured_annual_kwh.png` | Raw annual totals |

---

## 9. Recommendations (no production change)

If we wanted to **replace** the current synthetic heat-pump profile:

**Cleanest architecture:** one **representative measured 15-min profile**
(option C) as default, scaled to the entered annual kWh, with **two cluster
representatives** (option B: moderate-winter vs strong-winter monthly shape)
if the product can distinguish those use types. Not interval-wise median (A).
Not annual-kWh bins (D).

**Should production use one or multiple profiles?**
Default = **one** (median-shape house). Multiple = **better**, because this
cohort’s summer share IQR is {pct(d_shape['season_summer_share']['p75'] - d_shape['season_summer_share']['p25'])}
and a single house cannot cover both a ~1% summer DHW load and a ~20%+
year-round outlier. Two profiles cover that split without averaging artefacts.

**Is replacing the synthetic profile justified?** **Yes**, for any result that
uses 15-minute coincidence (Eigenverbrauch, Autarkie, Speichergrenze with HP
on). The synthetic model’s winter/summer split is already outside the cohort
IQR, and the missing cycling/peaks are a structural miss, not a calibration
error.

**This phase does not ship that replacement.**

---

## Limitations

- One district in Lower Saxony, one year (2019). Not statistically Germany.
- Completeness thresholds are conventions (`thresholds.json`).
- 100 W / 4 kW mode bins are paper heuristics, not labelled compressor/rod.
- WITH_PV houses are included for HEATPUMP (meter is separate); household PV
  still does not enter this comparison.
- No weather-driven re-simulation; no battery kernel in Phase 3 (that would be
  a later “HP + HH + PV” phase).
- Typical days use meteorological seasons and four mid-season calendar dates.
- Time zone conversion uses Europe/Berlin; HDF5 timestamps are Unix UTC.

## How to reproduce

```bash
/tmp/wpuq-venv/bin/pip install -r research/wpuq/requirements.txt matplotlib
/tmp/wpuq-venv/bin/python research/wpuq/scripts/run_phase3.py
```

Requires Phase 1 inventory and local `research/wpuq/raw/2019_data_15min.hdf5`.

## Outputs

| Path | Content |
| --- | --- |
| `house_characterization_raw.csv` | Per-house physical stats (unscaled) |
| `house_shape_normalized_4000.csv` | Per-house shape at 4000 kWh |
| `cohort_distributions.csv` | Median / IQR / tails / mean / std |
| `production_vs_cohort.csv` | Production vs cohort + verdict |
| `monthly_comparison.csv` | Monthly shares |
| `hourly_distribution.csv` | Hour-of-day shares |
| `shape_distance.csv` | RMSE vs production / vs median |
| `summary.json` | Full machine-readable result |
| `verdict.json` | Optimistic / neutral / conservative |
| `clusters.json` | k=2 / k=3 |
| `architecture_recommendation.json` | A/B/C/D |
| `plots/*.png` | Research figures |
| `Phase3_Waermepumpe_Benchmark.md` | This document |
"""

    OUT.write_text(md, encoding="utf-8")
    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
