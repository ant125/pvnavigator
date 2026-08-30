# ThermBuild — building metadata

Sources: local filenames, Raisch et al. (arXiv:2606.01994), Fordatis record 486.
Only the two real TwinHouses are present locally. The 958 simulated variants are
not in `research/thermbuild/raw/`.

---

## Heat-pump technology (the main question)

**Both measured buildings use Luft/Wasser (air-source) heat pumps.**

They share **identical outdoor units**. The difference is the indoor / hydraulic
package (BSE), not the source medium.

| Building | Heat-pump technology | Confidence | Evidence |
| --- | --- | --- | --- |
| TwinHouse O5 (BSE1) | **Luft/Wasser** | Certain | Paper §2.1: “identical outdoor units for the air-source heat pumps”; Figure 1b shows the outdoor unit; product **iDM iPump** compact |
| TwinHouse N2 (BSE2) | **Luft/Wasser** | Certain | Same outdoor units; indoor unit **iDM ALM** (wall-mounted) |

Explicitly **not** present in this local download:

| Type | Present? |
| --- | --- |
| Luft/Wasser | **Yes — both houses** |
| Sole/Wasser | No |
| Wasser/Wasser | No |
| Exhaust-air (Abluft) | No |
| Hybrid (HP + fossil) | No |
| Unknown | No (both typed) |

Simulated files (not local) also model only these two air-source BSE packages,
scaled to design load. ThermBuild is an **air-source** dataset by construction.

---

## Building-by-building catalogue

### TwinHouse O5 — BSE1 (western)

| Field | Value | Source |
| --- | --- | --- |
| Building ID | Filename `…_BSE1_…_Use1001_…_wetReal_raw.csv` | local file |
| Lab name | TwinHouse **O5**, western house | paper §2.1 |
| Building type | Detached single-family test house (reality lab, not an occupied dwelling) | paper |
| Location | Fraunhofer IBP, **Holzkirchen**, south of Munich, Germany | paper |
| Coordinates | Not in files (site is the IBP Holzkirchen campus) | — |
| Construction year | TwinHouses built **around 1980** | paper |
| Renovation status | Continuously retrofitted; current envelope meets **GEG 2020** new-refurbishment requirements (`age1` in filename) | paper + filename |
| Floor area | **140 m²** living space (`size100`); basement excluded from the experiment | paper |
| Occupants | **None.** Occdem profile **1001** drives electrical **internal-heat-gain simulators** (~50% convective / 50% radiative). Mean total `*_ihs` ≈ 315 W | paper + local columns |
| Heating system | Air-source HP → **50 L** buffer (defrost only) → wet-screed UFH (ground floor) + dry-screed UFH (attic). **Almost no thermal buffering** | paper Fig. 3a |
| DHW | **Not used.** Compact unit has an integrated DHW buffer that was **not used**. All `dhw_*` and `mode_dhw` = NaN | paper + local data |
| Ventilation | Mechanical, constant **155 m³/h**. Supply: dining, sleeping, living. Extract: kitchen, bath. Attic child rooms balanced | paper Fig. 2 + filename `vent1_155` |
| Windows | Closed throughout (`*_win` = 0). Triple glazing, `SoProt0` | local + filename |
| Orientation | Living room **south** (`rot000`) | filename |
| Thermal mass | **Heavy** (`masshea`) | filename |
| Rooms | 7 common rooms (`roo3`); basement held at 18 °C by a **separate** heating system (out of dataset) | paper |
| PV | **No** | paper / columns |
| Battery | **No** | paper / columns |
| EV | **No** | paper / columns |
| Solar thermal | **No** (columns all NaN) | local |
| Weather station | IBP Holzkirchen station (shared `wea_*` columns, 100% finite) | paper §2.1, §4.1 |
| Setpoints | Paper: 20 °C, no night setback. Observed `Tset` is not a flat 20 °C (range includes 0 and 26 °C; room air means ≈ 22 °C) | paper vs local |
| Heat-pump product | **iDM iPump** compact, basement | paper Fig. 3a |

### TwinHouse N2 — BSE2 (eastern)

| Field | Value | Source |
| --- | --- | --- |
| Building ID | Filename `…_BSE2_…_Use1002_…_wetReal_raw.csv` | local file |
| Lab name | TwinHouse **N2**, eastern house | paper §2.1 |
| Building type | Identical fabric to O5 (same TwinHouse pair, IEA EBC Annex 58 / 71 labs) | paper |
| Location | Same Holzkirchen campus | paper |
| Construction year | ~1980, GEG 2020 envelope (`age1`) | paper |
| Renovation status | Same as O5 | paper |
| Floor area | **140 m²** (`size100`) | paper |
| Occupants | None. Occdem profile **1002**. Mean total `*_ihs` ≈ 357 W | paper + local |
| Heating system | Air-source HP → wall-mounted indoor unit → **500 L heating buffer** → UFH (same wet/dry split as O5) | paper Fig. 3b |
| DHW | **Yes.** **825 L** DHW store + freshwater station. Tapping follows occupancy profile. `mode_dhw` used (~12.6% of intervals ≥ 0.5) | paper + local |
| Solar thermal | **Yes.** Collector ≈ **6 m²** into DHW store. Local solar thermal energy ≈ 3,214 kWh over the campaign | paper + local |
| Ventilation | Same mechanical 155 m³/h | filename |
| Windows | Closed (`*_win` = 0) | local |
| Orientation | Living room south (`rot000`) | filename |
| PV / battery / EV | **No** | paper / columns |
| Weather station | Same IBP station | paper |
| Heat-pump product | **iDM ALM** wall-mounted indoor unit + same outdoor unit as O5 | paper Fig. 3b |

---

## Additional metadata (paper, not in CSV)

- TwinHouses previously used to validate BES tools (IEA EBC Annex 58 and Annex 71).
- Negligible external shading.
- Sensor QA: room sensors co-located before the campaign; water temperatures calibrated in-house; flow meters replaced after drift; ventilation meters lab-calibrated; weather station has a separate QA process.
- Dual acquisition (Beckhoff + iDM). TwinHouse sensors preferred when both exist.
- kNN imputation (k=5) exists as a **separate zip** not downloaded here.
- TRNSYS models and HP control code are **not** published (manufacturer polynomials).

---

## What this is *not*

These are **instrumented laboratory houses** with simulated occupancy, not a
sample of German households. Fabric is a refurbished 1980s TwinHouse at GEG 2020
level, 140 m², alpine-foothills climate (Holzkirchen), underfloor heating only,
windows closed, mechanical ventilation on. That is a **narrow slice** of the
German stock, with unusually rich HVAC instrumentation.
