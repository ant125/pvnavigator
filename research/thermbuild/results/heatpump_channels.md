# ThermBuild — heat-pump measurement channels

Local files: the two `*_raw.csv` members inside `ThermBuild_measure_raw.zip`,
plus extra room-temperature members in `ThermBuild_measure_Temp_raw.zip`.
Units and descriptions follow Raisch et al., Table 3, checked against the
actual headers.

Modes (`mode_heat`, `mode_dhw`, `mode_cool`) are **15-minute means of 1-second
booleans**, so they can be fractional.

---

## Does the measurement include …?

| Quantity | In dataset? | How |
| --- | --- | --- |
| Electrical power | **Yes** | `hp_elP` (kW), whole heat-pump unit |
| Compressor power | **No separate channel** | Compressor **frequency** `hp_rps` (1/s). Electrical power is not split into compressor vs pumps vs aux |
| Heating rod | **No labelled channel** | Not in Table 3. Infer only via proxies (see below) |
| DHW | **BSE2 only** | `mode_dhw`, `dhw_*` temperatures, tap mass flow, tap thermal power. BSE1: all NaN |
| Heating circuit | **Yes** | `dist_*` flow/return, buffer temperatures, mass flow, thermal power to UFH |
| COP | **No column** | Must be computed: `hp_thP / hp_elP` when both finite and electrical > 0 |
| Temperatures | **Yes** | HP, distribution, DHW, solar, rooms, outdoor |
| Flow temperature | **Yes** | `hp_Tflow_hp_store` (HP → store), `dist_Tflow_store_ufh` (common UFH supply) |
| Return temperature | **Yes** | `hp_Tflow_store_hp` (store → HP), `dist_Tflow_ufh_store` (UFH return), plus per-room `*_Tret` |
| Outdoor temperature | **Yes** | `wea_Tair_out` (°C), 100% finite on both houses |
| Indoor temperature | **Yes** | Per-room `*_Tair` at 110 cm; extra heights + MRT in the Temp zip |
| Buffer tank | **Yes** | Heating buffer `dist_Tstore_{top,mid,bott}`. BSE1: three columns **duplicated** (50 L tank, one sensor) |
| Storage temperatures | **Yes (BSE2)** | DHW `dhw_Tstore_{top,mid,bott}` plus heating buffer |

---

## Derived COP (not a native channel)

Rule used for inspection: `COP = hp_thP / hp_elP` where `hp_elP > 0.05 kW` and `hp_thP > 0`.

| | BSE1 O5 | BSE2 N2 |
| --- | ---: | ---: |
| Seasonal energy-ratio COP | **4.46** | **3.83** |
| Instantaneous COP median | 4.57 | 4.57 |
| Instantaneous COP mean | 5.31 | 4.58 |
| Share of intervals with a defined COP | 33.7% | 44.2% |

BSE2’s lower seasonal COP is expected: DHW at higher sink temperature, plus
solar already covering part of the easy DHW load. Instantaneous COP can spike
(max > 75) when `hp_elP` is small; do not use unconstrained instantaneous COP
as a quality metric.

Negative `hp_thP` occurs (min ≈ −10 kW): defrost and/or cooling. BSE1 July/August
**monthly thermal sums are negative** while electrical energy stays ~11–14 kWh.

---

## Heating-rod / auxiliary (inferred only)

There is **no** `heating_rod` / `backup_heater` column.

Local electrical peaks are modest (BSE1 max **2.36 kW**, BSE2 max **3.24 kW**),
below the 4 kW WPuQ research threshold used to flag rod events on
Wasser/Wasser machines. That does **not** prove a rod is absent; it means a
WPuQ-style 4 kW cut is the wrong classifier here.

Inspection proxies (not manufacturer ground truth):

| Proxy | BSE1 | BSE2 |
| --- | ---: | ---: |
| `hp_elP > 0.5 kW` and `hp_rps < 1` (compressor essentially off) | 987 intervals, **6.3%** of HP electrical energy | 2 intervals, 0.02% |
| COP < 1 and `hp_elP > 2 kW` | 0 | 34 intervals, 19 kWh |

BSE1’s 6% “compressor-off but drawing > 0.5 kW” energy is consistent with
**defrost electric / pumps / compact-unit aux**, not with a large backup rod.
Treat as **unknown aux**, not as a labelled heating rod.

---

## Heat-pump domain (`hp_*`, `mode_*`)

| Channel | Unit | Description | BSE1 finite | BSE2 finite |
| --- | --- | --- | ---: | ---: |
| `hp_elP` | kW | Electrical power of the heat pump | 99.40% | 100% |
| `hp_thP` | kW | Thermal power output of the heat pump | 99.98% | 100% |
| `hp_rps` | 1/s | Compressor frequency | 99.98% | 99.98% |
| `hp_Vol` | kg/h | Mass flow at the heat pump | 99.25% | 100% |
| `hp_Tflow_hp_store` | °C | Flow HP → storage | 99.69% | 100% |
| `hp_Tflow_store_hp` | °C | Flow storage → HP (return) | 99.40% | 100% |
| `mode_heat` | 0–1 | Heating mode mean | 99.98% | 99.98% |
| `mode_dhw` | 0–1 | DHW production | **0% (NaN)** | 99.98% |
| `mode_cool` | 0–1 | Cooling mode | 99.98% | 99.98% |

Mode occupancy (share of finite samples ≥ 0.5):

| Mode | BSE1 | BSE2 |
| --- | ---: | ---: |
| Heat | 32.3% | 28.1% |
| DHW | n/a | 12.6% |
| Cool | 0.17% | 1.36% |

`hp_elP` statistics:

| | BSE1 | BSE2 |
| --- | ---: | ---: |
| Median kW | 0.009 (standby-like) | 0.0 |
| Mean kW | 0.27 | 0.50 |
| P95 kW | 0.95 | 2.47 |
| Max kW | 2.36 | 3.24 |

BSE1 `hp_Vol` max 51,454 kg/h vs P95 1,097 kg/h is a **spike**; treat the extreme
as a sensor artefact.

---

## Distribution / heating circuit (`dist_*`)

| Channel | Unit | Description | BSE1 finite | BSE2 finite |
| --- | --- | --- | ---: | ---: |
| `dist_Tflow_store_ufh` | °C | Common UFH **supply** | 98.57% | 100%* |
| `dist_Tflow_ufh_store` | °C | UFH **return** | 98.58% | 98.91% |
| `dist_thP` | kW | Thermal output at buffer outlet to rooms | 98.52% | 98.86% |
| `dist_Vol` | kg/h | Mass flow buffer ↔ UFH | 98.58% | 97.95% |
| `dist_Tstore_top` | °C | Heating-buffer top | 97.56% | 100%* |
| `dist_Tstore_mid` | °C | Heating-buffer mid | 97.56% | 98.91% |
| `dist_Tstore_bott` | °C | Heating-buffer bottom | 97.11% | 100%* |

\*BSE2 `dist_Tflow_store_ufh` / `dist_Tstore_top` / `dist_Tstore_bott` were ≥ 99%
finite in the local file.

Paper: interpret supply/return only when mass flow > 0 (stagnant water drifts
toward room air). BSE1’s three buffer temperatures are **identical copies** of
the single 50 L sensor.

Campaign thermal energy at the distribution outlet: BSE1 11,218 kWh; BSE2 9,218 kWh
(BSE2 HP thermal is higher because much of it goes to DHW, not UFH).

---

## DHW (`dhw_*`)

| Channel | Unit | BSE1 | BSE2 finite |
| --- | --- | --- | ---: |
| `dhw_tap_Vset` | kg/h | all NaN | 98.91% |
| `dhw_Tflow_store_tap` | °C | all NaN | 98.91% |
| `dhw_thP_store_tap` | kW | all NaN | 98.91% |
| `dhw_Tstore_bott` | °C | all NaN | 100%* |
| `dhw_Tstore_mid` | °C | all NaN | 98.91% |
| `dhw_Tstore_top` | °C | all NaN | 96.66% |

BSE2 tap thermal energy over the campaign: **7,109 kWh**. DHW store top reached
~77 °C.

---

## Solar thermal (`solar_*`) — BSE2 only

| Channel | Unit | BSE1 | BSE2 finite |
| --- | --- | --- | ---: |
| `solar_Tflow_coll_store` | °C | all NaN | 98.91% |
| `solar_Tflow_store_coll` | °C | all NaN | 98.91% |
| `solar_thP` | kW | all NaN | 98.91% |

BSE2 campaign solar thermal energy: **3,214 kWh**. Paper validation (March 2025
window) reported 0.4% cumulated solar-energy deviation vs TRNSYS.

---

## Weather (`wea_*`)

Shared IBP Holzkirchen station. **100% finite** on both houses.

| Channel | Unit | BSE1 min / median / max |
| --- | --- | --- |
| `wea_Tair_out` | °C | −15.6 / 7.6 / 31.5 |
| `wea_IbeamHor` | W/m² | direct horizontal |
| `wea_IdiffHor` | W/m² | diffuse horizontal |
| `wea_PercentrH` | % | outdoor RH |
| `wea_vWind` | m/s | wind speed |
| `wea_Wdir` | ° | wind direction (N=0, E=90) |

No GHI-as-named column; global horizontal = beam + diffuse if needed later.

---

## Room-level (measure file, 7 rooms × 7 variables)

Rooms: `child1`, `child2`, `sleep`, `bath`, `living`, `dining`, `kitchen`.

| Suffix | Unit | Meaning |
| --- | --- | --- |
| `_ihs` | W | Internal heat source (simulator), **not** household electricity |
| `_rh` | % | Relative humidity at 110 cm |
| `_Tair` | °C | Air temperature at 110 cm |
| `_Tret` | °C | UFH return from that room |
| `_Tset` | °C | Setpoint |
| `_valve` | 0–1 (observed up to 2) | Valve command; paper says 0–1 |
| `_win` | 0–1 | Window opening; **always 0** here |

`_Tair` availability ≥ 99% on both houses. Valve / RH / Tset have larger gaps
(~75–86% finite on several rooms).

---

## Extra room-temperature file (not in the 83-column schema)

Per room, typically:

- `*_010_AT` — air at 10 cm
- `*_110_AT` — air at 110 cm
- `*_170_AT` — air at 170 cm
- `*_minus_10_AT` — air 10 cm below ceiling
- `*_110_MRT` — globe / mean radiant temperature

BSE1 file has 35 columns (no `child2_110_MRT`). BSE2 has 36. `TIME` starts at 1
with the same row count as the measure file — **align by row index**.

Availability ≈ 98.6% (BSE1) / 98.9% (BSE2); the missing block matches a common
gap of ~460–605 intervals.

---

## Time columns

`TIME`, `consecutive_days`, `day_of_the_year` — see `inventory.md`. No Unix
timestamp, no ISO clock, no timezone.

---

## Not measured (important for PVNavigator)

- Household plug-load / lighting electricity (only `*_ihs` simulators)
- Grid import / export
- PV, battery, EV
- Named heating-rod power
- Named COP / SCOP from the manufacturer
- Refrigerant circuit pressures
- Outdoor-unit fan power as a separate channel

The electrical series `hp_elP` is the right input for a PV+battery **heat-pump
component**. It is **not** a whole-house load.
