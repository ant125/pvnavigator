# ThermBuild — recommendation for PVNavigator

Research only. No production change in this phase.

---

## 1. Should ThermBuild become the primary dataset for modelling Luft/Wasser heat pumps?

**For physics and model design: yes. For a shipped electrical load profile: not yet.**

ThermBuild is the **only local dataset** that (a) is explicitly **Luft/Wasser**,
(b) measures electrical **and** thermal power, and (c) separates DHW, space
heating, buffers, flow temperatures, compressor frequency, and weather.

That is the right primary **research** source for Luft/Wasser. It should drive
how we think about ASHP behaviour (COP vs outdoor air, cycling, DHW vs heating,
direct vs storage hydraulics).

It should **not** become the primary **production time series** on the evidence
of two laboratory TwinHouses:

- n = 2, unoccupied, Occdem simulators, one manufacturer, one GEG 2020 fabric,
  Holzkirchen climate, UFH only, windows closed.
- Campaign is ~15 months, not a Jan–Dec 35,040-step year.
- BSE1 (no DHW, ~2.9 MWh_el) and BSE2 (DHW + solar, ~5.3 MWh_el) are different
  machines; averaging them is the interval-wise-median mistake again.
- No household electricity, PV, battery, or EV.

**Verdict:** ThermBuild is the primary **Luft/Wasser physics** dataset.
It is **not** a replacement SSOT for the electrical HP component until a
mapped, methodology-registered profile exists — and even then it should remain
a **class prototype**, not “the German ASHP”.

---

## 2. Should WPuQ remain the primary source for Wasser/Wasser systems?

**Yes.**

WPuQ is a field sample of **Wasser/Wasser** machines on a cold district network
(Hamelin area, 38 SFH, dedicated HP meters, 2018–2020). Nothing in ThermBuild
measures that source medium.

WPuQ should stay:

- the **validation cohort** for occupied-house HP electricity (Phase 3 already
  showed the synthetic monthly model is optimistic vs this cohort);
- the natural **Wasser/Wasser class** if production ever splits HP types.

It should **not** be treated as a proxy for Luft/Wasser. Source temperature
stability, winter share, and >4 kW rod-like bursts are properties of that
district system, not of an iDM outdoor unit in Holzkirchen.

---

## 3. Can both datasets coexist inside PVNavigator?

**Yes — they should coexist, as separate technology classes, not as one pool.**

They answer different questions:

| Dataset | Role inside PVNavigator |
| --- | --- |
| BDEW H25 | Production **household** electricity |
| WPuQ | Research / future **Wasser/Wasser** electrical shape + robustness tests |
| ThermBuild | Research / future **Luft/Wasser** physics (COP, DHW split, hydraulics) and, later, class prototypes from BSE1 / BSE2 |
| OPSD | Research **EV / PV / appliances**; untyped HP feeds stay unused for type-aware modelling |

Do **not** concatenate WPuQ and ThermBuild houses into a single median profile.
Do **not** replace BDEW with TwinHouse `*_ihs` simulators.

Coexistence is compatible with the methodology rule: each class gets a
registered source in `@pv-methodology/registry` before it becomes production
logic. WPuQ is already registered as research. ThermBuild is not registered
yet and must not be wired until it is.

---

## 4. What architecture for future heat-pump modelling?

Keep the current synthetic `createHeatPumpComponent15Min` as an explicit
**fallback** (Phase 3 already recommended that). Replace it, when production
is next touched, with **typed, scaled 15-min components** — not one monthly
multiplier, and not an interval-wise mean across houses.

Recommended stack:

```text
User annual HP kWh
        │
        ▼
 Technology class (user or default)
        │
        ├── Luft/Wasser  →  ThermBuild-informed prototype(s)
        │                    BSE1: space-heat, compact, little storage
        │                    BSE2: space-heat + DHW (+ solar as optional)
        │                    Scale electrical shape to user kWh.
        │                    Use thermal channels for COP / flow research,
        │                    not as a second user-facing load.
        │
        ├── Wasser/Wasser → WPuQ clustered representative (Phase 3:
        │                    SFH38 default and/or k=2 clusters).
        │                    Electrical only. Scale to user kWh.
        │
        └── Fallback      → createHeatPumpComponent15Min (monthly weights)
```

Rules that follow from this inspection and from Phase 3:

1. **Split by source technology.** Luft/Wasser and Wasser/Wasser are not the
   same load. Default for a typical detached-house quote should be Luft/Wasser
   once a ThermBuild-derived prototype exists; WPuQ remains the W/W path.
2. **Split DHW vs space-heat inside Luft/Wasser.** BSE1 vs BSE2 seasonal shares
   differ as much as WPuQ vs the synthetic model. A user who has no HP-DHW
   must not get BSE2’s summer DHW bump.
3. **Do not interval-average buildings.** Same finding as WPuQ Phase 3.
   Pick a real series (or a cluster of daily-duration shapes), then scale.
4. **Do not use ThermBuild as household load.** Household stays BDEW H25
   (validated against WPuQ HOUSEHOLD, not against TwinHouse simulators).
5. **Map calendar later, do not preprocess now.** ThermBuild needs a documented
   mapping onto the 35,040-step non-leap grid (15-month campaign, partial
   first/last days, no timezone column). That is a later research phase.
6. **Optional physics layer** (not required for the first electrical prototype):
   outdoor-temperature-dependent COP from `hp_thP`/`hp_elP` vs `wea_Tair_out`,
   for economics / SCOP display. Register the derivation in pv-methodology.
7. **Do not download-and-ship the 958 TRNSYS files as “measured”. ** If the sim
   library is fetched later, it is a **synthetic expansion** of the TwinHouses,
   useful for sensitivity, not as field truth.
8. **Seek a larger ASHP field set** before calling any L/W profile
   representative of Germany (radiators, existing buildings, other brands).
   ThermBuild is the **lab prototype**, WPuQ is the **W/W field cohort**.
   The missing piece is an **ASHP field cohort**.

---

## Short answers

| # | Question | Answer |
| --- | --- | --- |
| 1 | Primary dataset for modelling Luft/Wasser? | **Primary physics source: yes. Primary production electrical SSOT: no (n=2 lab).** |
| 2 | WPuQ primary for Wasser/Wasser? | **Yes.** |
| 3 | Can both coexist? | **Yes, as separate classes, plus BDEW for household.** |
| 4 | Architecture? | **Typed HP components (L/W from ThermBuild prototypes, W/W from WPuQ representatives), scaled to user kWh; synthetic monthly model as fallback; never mix technologies or interval-average.** |

---

## Explicitly out of scope (this phase)

- Representative 35,040-step profiles
- Gap filling / imputed zip
- TRNSYS 13 GB download
- `createHeatPumpComponent15Min` changes
- Registry entry for ThermBuild
- Commit / push / deploy
