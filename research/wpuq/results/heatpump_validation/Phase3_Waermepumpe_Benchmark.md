# Phase 3 — Wärmepumpe benchmark (WPuQ 2019)

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

**Cohort size: 30 houses**

`SFH3, SFH4, SFH5, SFH7, SFH8, SFH9, SFH10, SFH11, SFH12, SFH14, SFH15, SFH16, SFH18, SFH19, SFH20, SFH21, SFH22, SFH23, SFH26, SFH27, SFH28, SFH29, SFH30, SFH32, SFH33, SFH34, SFH35, SFH36, SFH38, SFH39`

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

Exported profile sum: **4000.000 kWh**.

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
(4012 kWh).

---

## 1. Measured cohort characterization (raw 2019)

### Annual energy

median 4011.7 kWh, mean 4993.5 kWh, P25–P75 2602.8 kWh–6645.0 kWh, P05–P95 1756.1 kWh–10074.7 kWh, std 3124.4 kWh

Range: 1431 kWh –
14840 kWh.
The spread is large: a single 4000 kWh synthetic profile cannot represent
absolute consumption, only a scaled shape.

### Seasonal shares (raw; identical to normalized shares)

| Season | Cohort |
| --- | --- |
| Winter DJF | median 55.1%, mean 55.7%, P25–P75 48.8%–64.3%, P05–P95 40.0%–69.5%, std 10.1% |
| Spring MAM | median 21.8%, mean 21.0%, P25–P75 16.8%–24.0%, P05–P95 14.0%–28.6%, std 5.0% |
| Summer JJA | median 3.0%, mean 4.2%, P25–P75 2.2%–4.4%, P05–P95 0.8%–9.9%, std 4.4% |
| Autumn SON | median 19.7%, mean 19.2%, P25–P75 15.3%–23.2%, P05–P95 12.8%–24.8%, std 4.3% |

Measured heat-pump electricity is **strongly winter-dominated**. Summer is
mostly domestic hot water (a few percent of annual energy for most houses).

### Operating / standby / heating rod (raw)

| Metric | Cohort |
| --- | --- |
| Standby interval share (&lt;100 W) | median 68.5%, mean 60.2%, P25–P75 55.7%–75.5%, P05–P95 5.4%–82.6%, std 23.8% |
| Compressor interval share | median 28.0%, mean 36.5%, P25–P75 21.7%–41.5%, P05–P95 17.0%–85.7%, std 22.6% |
| Heating-rod interval share (&gt;4 kW) | median 1.0%, mean 3.3%, P25–P75 0.3%–3.8%, P05–P95 0.0%–10.8%, std 4.9% |
| Standby **energy** share | median 3.6%, mean 4.2%, P25–P75 1.7%–6.5%, P05–P95 0.1%–9.7%, std 3.1% |
| Compressor **energy** share | median 77.4%, mean 72.5%, P25–P75 58.4%–88.1%, P05–P95 35.1%–94.9%, std 19.6% |
| Heating-rod **energy** share | median 17.6%, mean 23.3%, P25–P75 7.8%–39.6%, P05–P95 0.1%–62.6%, std 20.7% |
| Operating hours | median 2758.2 h, mean 3490.0 h, P25–P75 2149.4 h–3884.4 h, P05–P95 1527.9 h–8286.6 h, std 2085.3 h |
| Standby hours | median 6001.8 h, mean 5270.0 h, P25–P75 4875.6 h–6610.6 h, P05–P95 473.4 h–7232.1 h, std 2085.3 h |
| Median operating run length | median 0.5 h, mean 584.5 h, P25–P75 0.3 h–0.5 h, P05–P95 0.2 h–4818.7 h, std 2222.4 h |
| Mean operating run length | median 0.7 h, mean 587.1 h, P25–P75 0.5 h–1.1 h, P05–P95 0.4 h–4849.5 h, std 2221.7 h |
| Peak 15-min mean power | median 6598.2 W, mean 7932.7 W, P25–P75 6011.6 W–10551.8 W, P05–P95 5718.0 W–12654.4 W, std 2738.1 W |
| Median operating power | median 948.2 W, mean 1133.2 W, P25–P75 689.1 W–1496.5 W, P05–P95 283.8 W–2532.1 W, std 695.8 W |
| Mean operating power | median 1227.3 W, mean 1471.6 W, P25–P75 920.9 W–1721.5 W, P05–P95 669.4 W–2854.9 W, std 715.0 W |

Real machines **cycle**. A large fraction of the year is standby; when they run,
power is typically ~0.5–2 kW (compressor) with occasional multi-kW rod bursts.
Rod **interval** share is small; rod **energy** share is larger because those
intervals are high power.

Mean operating-run length is dominated by always-on outliers (houses with
~0% standby, one run lasting most of the year). **Median run length (~0.5 h)**
is the relevant cycling statistic.

### Weekday / weekend (raw daily kWh)

Weekend/weekday daily-energy ratio:
median 1.0, mean 1.0, P25–P75 0.9–1.0, P05–P95 0.9–1.1, std 0.1.

Near 1.0 means space-heating dominated (calendar does not care about weekends).
Deviations indicate DHW / occupancy effects.

---

## 2–4. Production vs real (shape, 4000 kWh)

### Overall verdict

**The current production model is optimistic** relative to the WPuQ 2019
usable HEATPUMP cohort.

Headline metric counts: 6 optimistic,
0 conservative,
2 within IQR.

Production overstates coincidence with PV and/or understates winter concentration, peaks, and heating-rod bursts relative to WPuQ.

The optimism is **seasonal and structural**, not a clock-hour PV-window artefact:
winter share is ~19 percentage points too low, summer ~6 points too high,
the model is always-on at ~0.2–0.7 kW, and it has no heating-rod bursts.
Annual hour-of-day energy shares and the 09–16 PV window sit **inside the
cohort IQR** (production is almost 1/24 per hour; so is the cohort median).

RMSE of monthly shares vs cohort-median monthly vector:
**0.0452**.
RMSE of hour-of-day shares vs cohort-median hourly vector:
**0.0032**.

House nearest production monthly shape: **SFH8**.
House nearest cohort-median monthly shape (representative): **SFH38**.

### Headline comparisons

| Metric | Production | Cohort median | P25–P75 | Verdict |
| --- | ---: | ---: | ---: | --- |
| `season_winter_share` | 0.3624 | 0.5512 | 0.4881–0.6430 | optimistic |
| `season_summer_share` | 0.0944 | 0.0299 | 0.0217–0.0437 | optimistic |
| `pv_window_share` | 0.2917 | 0.2862 | 0.2504–0.3218 | neutral (within IQR) |
| `night_window_share` | 0.3333 | 0.3143 | 0.2688–0.3653 | neutral (within IQR) |
| `peak_power_w_normalized` | 671.0754 | 8250.8983 | 4406.0482–10855.7803 | optimistic |
| `operating_interval_share_normalized` | 1.0000 | 0.3216 | 0.2586–0.4392 | optimistic |
| `share_heating_rod_energy_normalized` | 0.0000 | 0.1134 | 0.0014–0.2556 | optimistic |
| `daily_kwh_p95` | 16.1058 | 30.6896 | 26.6860–44.3345 | optimistic |

### Monthly shares

| Month | Production | REAL median | REAL P25–P75 | Verdict |
| --- | ---: | ---: | ---: | --- |
| Jan | 12.5% | 25.7% | 20.1%–33.1% | optimistic |
| Feb | 11.3% | 13.0% | 11.8%–16.5% | optimistic |
| Mar | 12.5% | 10.5% | 8.2%–11.6% | conservative |
| Apr | 7.3% | 6.1% | 4.4%–6.7% | optimistic |
| May | 7.6% | 4.6% | 3.3%–6.2% | optimistic |
| Jun | 3.1% | 0.9% | 0.5%–1.4% | optimistic |
| Jul | 3.2% | 1.1% | 0.9%–1.6% | optimistic |
| Aug | 3.2% | 0.9% | 0.5%–1.7% | optimistic |
| Sep | 7.3% | 2.1% | 1.2%–3.0% | optimistic |
| Oct | 7.6% | 5.4% | 4.3%–6.9% | conservative |
| Nov | 12.1% | 11.3% | 9.6%–13.3% | neutral (within IQR) |
| Dec | 12.5% | 14.7% | 11.4%–17.0% | neutral (within IQR) |

**What matches (weakly):** shoulder months can fall nearer the cohort IQR than
deep winter / mid summer. The model *does* put more energy in winter than in
summer — the sign of seasonality is correct.

**What differs (materially):**

1. **Winter share is too low.** Production winter ≈ 36.2%
   vs cohort median 55.1%
   (mean 55.7%).
2. **Summer share is too high.** Production summer ≈ 9.4%
   vs cohort median 3.0%.
   Extra summer HP load coincides with high PV — this is the main **optimistic**
   bias for Eigenverbrauch of the heat-pump portion.
3. **Intra-day *annual energy* allocation is close.** Production hour-of-day
   shares are almost 1/24 (entropy 3.178 vs
   cohort median 3.162).
   PV-window share production 29.2% vs median
   28.6% — **within IQR**. The miss is
   not “the model puts HP at night vs day over the year”. Winter *typical
   days* still show a mild morning peak in the measured median that a
   monthly constant cannot represent.
4. **No cycling.** Production operating-interval share
   100.0% (always on at a few hundred watts).
   Cohort median operating share
   32.2%.
5. **No peaks / no rod.** Production peak 15-min power
   671 W vs cohort median
   8251 W
   after 4000 kWh scaling (raw unscaled peaks:
   6598 W; scaled peaks can be
   higher because small-annual houses are scaled up).
   Production heating-rod energy share is **0.0%**.
6. **Daily duration is too flat.** Production daily kWh P95
   16.11 kWh vs cohort median
   30.69 kWh at the same 4000 kWh/year.
7. **Weekday/weekend:** production ratio is exactly 1.
   Cohort: median 1.0, mean 1.0, P25–P75 0.9–1.0, P05–P95 0.9–1.1, std 0.1.
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
| Winter share | 36.2% | median 55.1%, mean 55.7%, P25–P75 48.8%–64.3%, P05–P95 40.0%–69.5%, std 10.1% |
| Summer share | 9.4% | median 3.0%, mean 4.2%, P25–P75 2.2%–4.4%, P05–P95 0.8%–9.9%, std 4.4% |
| PV window share (local 09–16) | 29.2% | median 28.6%, mean 29.3%, P25–P75 25.0%–32.2%, P05–P95 22.4%–38.3%, std 5.6% |
| Night share (local 22–06) | 33.3% | median 31.4%, mean 30.9%, P25–P75 26.9%–36.5%, P05–P95 19.8%–39.3%, std 6.5% |
| Peak power (scaled) | 671 W | median 8250.9 W, mean 8464.8 W, P25–P75 4406.0 W–10855.8 W, P05–P95 2492.2 W–16156.7 W, std 4575.4 W |
| Median operating power (scaled) | 407 W | median 990.7 W, mean 1097.1 W, P25–P75 721.5 W–1434.2 W, P05–P95 450.2 W–1995.9 W, std 516.4 W |

---

## 6–7. Can a synthetic model represent the median?

**Monthly median: only if multipliers are retuned.** The current 1.65 / 1.00 / 0.42
set is the wrong winter/summer split for this district-year.

**15-minute median behaviour: no.** Real median behaviour is *cycling with
winter-dominated energy*, not a constant monthly kW. An interval-wise median
across houses is the wrong object:

- Interval-wise **mean** operating share after re-normalization to 4000 kWh:
  71.1%
  (smears asynchronous compressors into a smoother profile).
- Interval-wise **median** sum before re-normalization:
  2154.7 kWh;
  operating share after re-normalization
  52.6%.
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
| **C. One representative real house** | **Best single-profile default** (house **SFH38** here). |
| **D. Different profile by annual kWh** | **Not justified**: corr(annual kWh, winter share) = -0.32; corr vs summer share = 0.05. Shape looks like system/building type, not size. |

k=2 clusters (monthly-share vectors, normalized) — useful product split
**moderate winter** vs **strong winter** (not “DHW vs heating” as a clean
label; SFH5’s high summer share sits inside the moderate-winter cluster):

- **cluster_0** (n=16): SFH3, SFH5, SFH7, SFH8, SFH9, SFH10, SFH12, SFH15, SFH18, SFH19, SFH20, SFH22, SFH32, SFH34, SFH38, SFH39. Centroid winter 48.6%, summer 5.2%. Median measured annual 4764 kWh.
- **cluster_1** (n=14): SFH4, SFH11, SFH14, SFH16, SFH21, SFH23, SFH26, SFH27, SFH28, SFH29, SFH30, SFH33, SFH35, SFH36. Centroid winter 63.7%, summer 3.0%. Median measured annual 3514 kWh.

k=3 mainly splits the winter-heavy group further; the 16-house moderate
cluster is unchanged. Prefer k=2 for a product:

- **cluster_0** (n=8): SFH4, SFH14, SFH16, SFH21, SFH26, SFH27, SFH28, SFH33. Winter 61.2%, summer 3.0%.
- **cluster_1** (n=6): SFH11, SFH23, SFH29, SFH30, SFH35, SFH36. Winter 67.1%, summer 2.9%.
- **cluster_2** (n=16): SFH3, SFH5, SFH7, SFH8, SFH9, SFH10, SFH12, SFH15, SFH18, SFH19, SFH20, SFH22, SFH32, SFH34, SFH38, SFH39. Winter 48.6%, summer 5.2%.

Recommended production architecture (when — not now — you choose to replace
the synthetic series):

1. Keep `createHeatPumpComponent15Min` as an explicit **fallback / regression** helper.
2. Add a **package-level** 35040-step measured-derived profile (not in `apps/`),
   scaled to the user-entered annual HP kWh (same pattern as BDEW).
3. Ship **one default = representative house nearest median monthly shares**
   (`SFH38` in this 2019 cohort), plus **optionally 2 cluster representatives**
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
| `heatmap_representative_vs_production.png` | `SFH38` vs production |
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
cohort’s summer share IQR is 2.2%
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
