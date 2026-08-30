# ThermBuild vs WPuQ (and BDEW / OPSD)

Research comparison only. No production profiles, no preprocessing beyond
in-memory inspection of the local ThermBuild zips.

WPuQ figures below are from the existing Phase 1–3 work
(`research/wpuq/`, Schlemminger et al., Sci Data 2022). OPSD figures are from
`research/opsd/results/`. BDEW H25 is the production household SSOT
(`packages/bdew-profile`).

---

## Direct comparison: ThermBuild vs WPuQ

| | **ThermBuild (local)** | **WPuQ (local 15-min)** |
| --- | --- | --- |
| What it is | Two Fraunhofer **lab** TwinHouses + (unpublished here) 958 TRNSYS clones | 38 **occupied** SFH in a Lower-Saxony district |
| Heat-pump source | **Luft/Wasser** (iDM outdoor units, both houses) | **Wasser/Wasser** on a cold local heating network (~10–12 °C groundwater) |
| n (HP electrical) | **2** real (958 sim not downloaded) | **38** houses; 2019 usable HEATPUMP cohort **~30** |
| Years | 2025-02-07 → 2026-04-26 (~444 days, not a calendar year) | 2018–2020 calendar years (2019 best) |
| Sampling | 15 min | 15 min (also 10 s / 1 min / 60 min on Zenodo, unused here) |
| HP electrical | `hp_elP` kW, 99.4–100% finite | `P_TOT` W on a dedicated HEATPUMP meter |
| HP thermal / COP | **Yes** (`hp_thP`, derived COP 4.46 / 3.83) | **No** (electrical only) |
| Flow / return / buffers | **Yes** | No |
| DHW vs space heat | **Yes** (`mode_dhw` / `mode_heat`; BSE1 has no DHW) | Not separated; HP meter is the whole unit |
| Compressor frequency | **Yes** (`hp_rps`) | No |
| Heating rod | Not labelled; peaks ≤ 3.2 kW | Not labelled; research bins > 4 kW as rod-like |
| Indoor climate | 7 zones, T/RH/valves + extra heights | No |
| Weather | On-site station, 100% | Separate weather product on Zenodo (out of Phase 1) |
| Household electricity | **No** (Occdem heat-gain simulators only) | **Yes**, separate HOUSEHOLD meter |
| Occupancy | Simulated in empty labs | Real households (mean 2.38 persons in the paper) |
| PV on HP meter | None | HEATPUMP feed independent of rooftop PV |
| Envelope | GEG 2020 TwinHouse, 140 m², UFH | Late-1990s / early-2000s district, UFH + solar DHW |
| Climate | Holzkirchen (alpine foothills, −16 °C observed) | Hamelin area, Lower Saxony |
| Representativeness for DE | **Narrow** (n=2, lab, refurbished, one climate, one manufacturer) | **Narrow in technology** (all W/W district), **broader in occupancy** (38 real homes) |
| Production suitability | Not a household SSOT; not a drop-in 35,040-step L/W profile from n=2 | Not the household SSOT; best **electrical shape** cohort we have, but **wrong source medium** for typical Luft/Wasser sales |
| Research suitability | **Best local physics dataset for Luft/Wasser** | **Best local field cohort for HP electricity + household** |

### Seasonal electrical share (shape, not kWh)

| Season | Production `createHeatPumpComponent15Min` | WPuQ 2019 usable median | ThermBuild BSE1 (no DHW), Mar 2025–Feb 2026 | ThermBuild BSE2 (DHW+solar), Mar 2025–Feb 2026 |
| --- | ---: | ---: | ---: | ---: |
| Winter DJF | 36.2% | **55.1%** | **50.7%** | 39.5% |
| Summer JJA | 9.4% | **3.0%** | **1.7%** | 8.5% |

Reading:

- BSE1 (space heat only, Luft/Wasser) is **winter-heavy like WPuQ**, not like the
  synthetic monthly model. Summer is even emptier because there is no DHW.
- BSE2 (Luft/Wasser **with DHW**) has a **higher summer share** (~8.5%), close to
  the synthetic 9.4%, because DHW runs year-round. Winter share drops because
  shoulder-season heating in Holzkirchen is long (SON 29%).
- **DHW presence moves the seasonal shape as much as source technology.**
  Mixing BSE1 and BSE2 into one “ThermBuild median” would be the same mistake
  as interval-averaging WPuQ houses.

### Strengths of ThermBuild (vs WPuQ)

- Confirmed **Luft/Wasser** — the technology PVNavigator actually sells against.
- Full **thermal** instrumentation: COP, flow/return, buffers, DHW vs space heat,
  compressor frequency, outdoor and zone temperatures.
- Two **hydraulic archetypes** that matter in the field: direct-coupled compact
  (BSE1) vs storage-coupled with DHW and solar (BSE2).
- On-site weather, not a remote station.
- 15-min grid matches the production kernel.
- Paper-validated sensors and a documented sim-to-real TRNSYS baseline
  (ASHRAE Guideline 14 band on a 15-day window).

### Weaknesses of ThermBuild (vs WPuQ)

- **n=2 occupied-equivalent buildings** (labs, not families).
- Occupancy is **simulated**; no real household plug-load.
- **15 months**, not three calendar years; not Jan–Dec; last file day is 26 Apr
  2026 vs paper 30 Apr.
- One manufacturer (iDM), one fabric (GEG 2020 TwinHouse), one climate
  (Holzkirchen), windows always closed, UFH only.
- No PV / battery / EV.
- 958-building simulation library **not downloaded** (13 GB); even if it were,
  those series are TRNSYS, not field measurements.
- Cannot answer “how much do German ASHP households vary?” — WPuQ at least
  shows occupancy and control diversity, albeit on groundwater HPs.

### Completeness

For **Luft/Wasser physics**, ThermBuild is the only local dataset that is
complete enough to model COP(T), cycling, DHW vs heating, and buffer dynamics.

For **electrical load-shape statistics**, WPuQ is far more complete (30 usable
houses, full 2019). ThermBuild cannot replace that sample size.

For **household electricity**, neither ThermBuild nor the HP side of WPuQ
replaces BDEW H25. ThermBuild has no household meter at all.

### Representativeness for Germany

Luft/Wasser is the **dominant residential HP type** in current German sales.
Wasser/Wasser / cold-district systems are a niche. On **technology**, ThermBuild
is the more relevant real-world source. On **buildings and people**, WPuQ is
the more relevant field sample — but it measures the **wrong machine class**
for a typical detached-house Luft/Wasser quote.

Neither dataset is a stratified sample of the German stock (construction year,
radiators vs UFH, hybrid systems, existing-building high-temperature operation).

### Suitability for Luft/Wasser modelling

**Use ThermBuild** to understand and later **parameterise** Luft/Wasser
behaviour (seasonal COP, flow temperatures, DHW vs space-heat split, cycling,
defrost-related electrical tails).

**Do not** ship a production 15-min electrical profile that is simply
“the mean of O5 and N2”. n=2, lab occupancy, and BSE1 vs BSE2 DHW difference
make that profile an artefact.

**Do not** use WPuQ as if it were Luft/Wasser. Groundwater source temperatures
are far more stable than outdoor air; WPuQ winter share and rod-like peaks
describe **Wasser/Wasser district machines**.

---

## Four-way comparison

Scoring is qualitative: **production** = can it be the shipped SSOT today;
**research** = does it teach us something the kernel currently lacks.

| | **BDEW H25** | **WPuQ** | **OPSD** | **ThermBuild** |
| --- | --- | --- | --- | --- |
| Household profiles | **Production SSOT** (synthetic standard load) | Field HH meters, 38 SFH, used to **validate** H25 (Phase 2) | 6 residential sites, cumulative kWh, Konstanz | **None** (ihs simulators only) |
| Heat pumps | Not a HP dataset | Electrical only, **Wasser/Wasser**, n≈30 usable (2019) | 2 untyped `heat_pump` feeds | Electrical **+ thermal**, **Luft/Wasser**, n=2 labs |
| EV | No | No | Yes (residential4 + industrial3) | No |
| PV | No | 4 WITH_PV houses; HH meter corrected | Yes (several sites) | No |
| Metadata | Profile class only | District-level (paper): W/W, UFH, solar DHW, 7.4–11.3 kW_th | Minimal (urban/suburban tag) | **Rich** (filename + paper): fabric, BSE, ventilation, occupancy profile |
| Weather | No | Separate Zenodo product (not in Phase 1 files) | No on-site HP weather | **On-site** Holzkirchen, 100% |
| Sampling | 15 min (native H25) | 15 min locally | 15 min CSV; 1/15/60 min in SQLite | 15 min |
| Production suitability | **Household SSOT** | Validation / future W/W class profile; not household SSOT | Research only (EV/PV, untyped HP) | Research / future **L/W physics**; not household SSOT; not n=2 electrical SSOT |
| Research suitability | Shape reference for HH | Best field HP **electricity** + HH cohort | EV, PV, appliance splits | Best **Luft/Wasser physics** we have locally |

---

## What ThermBuild cannot replace

- BDEW H25 as the household load.
- WPuQ as the occupied-house HP **electrical diversity** set.
- OPSD as the EV / submetered appliance set.

## What ThermBuild uniquely adds

A typed **Luft/Wasser** measurement with COP, hydraulics, DHW, weather, and
zone temperatures — the layer WPuQ and OPSD do not have, and the layer the
current synthetic `createHeatPumpComponent15Min` does not even attempt.
