# OPSD Household Data — heat-pump and household metadata

Documentation-only search. No measurements were analysed.

## Sources checked

**Local download (`research/opsd/raw/`):** only `household_data_15min_singleindex.csv` and `household_data.sqlite`. There is **no** local README, `datapackage.json`, household catalogue, or CoSSMic deliverable.

**Official package (version matching the local files, 2020-04-15):**

- Package page: https://data.open-power-system-data.org/household_data/2020-04-15/
- README: https://data.open-power-system-data.org/household_data/2020-04-15/README.md
- `datapackage.json`: https://data.open-power-system-data.org/household_data/2020-04-15/datapackage.json
- Processing notebooks: https://github.com/isc-konstanz/household_data/blob/2020-04-15/main.ipynb, `processing.ipynb`
- Household config: https://github.com/isc-konstanz/household_data/blob/2020-04-15/conf/households.yml
- Per-house gap-fill rules: `conf/residential1.d/series.yml`, `conf/residential4.d/series.yml`
- Earlier release 2017-08-01 / 2017-11-10 README (same field text)
- CoSSMic CORDIS result brief: https://cordis.europa.eu/article/id/198834-smart-neighbourhoods-exchange-energy
- Independent paper on the same OPSD table: Fu et al., *A semantic web approach to uplift decentralized household energy data* (arXiv:2208.10265) — states the published set is energy-flow only

## Verdict

The dataset **does not document** heat-pump technology, heating circuit, DHW, floor heating, building fabric, or installation year for `residential1` or `residential4`. What exists is a **feed name** (`heat_pump`) plus a coarse building-class tag.

| Question | Documented? | What the docs actually say |
| --- | --- | --- |
| Heat-pump type for residential1 / residential4 | **No** | Only “Heat pump energy consumption … in kWh” |
| Luft/Wasser, Sole/Wasser, Wasser/Wasser, or other | **No** | These terms do not appear in the package docs, YAML, or notebooks |
| Heating system (radiators, buffer, backup heater, …) | **No** | Not stated for either house |
| Domestic hot water system | **No** | Not stated |
| Floor heating | **No** | Not stated |
| Building characteristics (area, occupancy, construction year, U-values) | **Almost none** | Only “residential building, suburban” vs “urban” |
| Installation year of the heat pump | **No** | Not stated. CoSSMic collected data Oct 2013–Dec 2016; meters for these feeds start in 2015 (gap-fill rules only) |
| Any household metadata at all | **Minimal** | See table below |

## Metadata that *is* published

Per-column `opsd-properties` in `datapackage.json` (repeated for every resolution) are only:

`Region`, `Type`, `Household`, `Feed`.

`conf/households.yml` is the processing catalogue. It lists emoncms feed IDs and units. It does **not** add HP model, COP, kW, or fabric data.

| | residential1 | residential4 |
| --- | --- | --- |
| Region | `DE_KN` (Konstanz, southern Germany) | same |
| `Type` | `residential_building_suburb` | `residential_building_urban` |
| Description text | “residential building, located in the suburban area” | “residential building, located in the urban area” |
| Heat-pump feed | `DE_KN_residential1_heat_pump` | `DE_KN_residential4_heat_pump` |
| Other documented feeds | `grid_import`, `pv`, dishwasher, washing machine, freezer | `grid_import`, `grid_export`, `pv`, `ev`, heat pump, dishwasher, washing machine, refrigerator, freezer |
| `circulation_pump` | **absent** | **absent** |
| emoncms `heat_pump` id | 62 | 49 |
| Internal source dir | `DE_KN_residential_001` | `DE_KN_residential_004` |

The generic feed glossary (`main.ipynb`) defines:

- `heat_pump`: “Heat pump energy consumption”
- `circulation_pump`: “Circulation pump energy consumption, circulating the heated water of e.g. boilers”

That glossary is **not** attached to residential1/4. Circulation-pump feeds exist for residential2, 3 and 6 (houses **without** a `heat_pump` column). Absence of `circulation_pump` on the two HP houses is not documentation of floor heating, radiators, or DHW.

`series.yml` files only list timestamp ranges to `remove` / `fill` / `difference`. They are data-cleaning rules, not equipment datasheets.

Package-level facts that apply to all sites, not to a specific HP:

- Trial: CoSSMic (FP7), German site Konstanz; Italian Caserta site is not in this package
- Contact / contributor: Adrian Minde, ISC Konstanz (`adrian.minde@isc-konstanz.de`)
- Meters: MID-certified, cumulative kWh
- Geographical scope string: “11 households in southern Germany”
- CORDIS: monitoring installed in **12 buildings** in Konstanz (count not mapped to OPSD IDs)

## What is explicitly missing

Across README, datapackage JSON, YAML, notebooks, original-data index, and GitHub issues:

- no Luft/Wasser / Sole/Wasser / Wasser/Wasser / Luft/Luft
- no manufacturer, model, rated kW, COP, SCOP, bivalent point
- no statement whether the HP supplies space heat, DHW, or both
- no floor heating / radiator / buffer-tank flag
- no floor area, occupancy, construction year, insulation standard
- no PV kWp, tilt, or azimuth (only that a `pv` feed exists)
- no coordinates finer than Konstanz

Fu et al. (2022), working from the same OPSD table, also note that the published dataset is energy-flow columns plus header descriptions, and lacks other variables needed to interpret the houses.

## Do not confuse with other Konstanz heat-pump projects

Two other Konstanz-area HP datasets exist and are **not** linked by OPSD to `residential1` / `residential4`:

- IEA HPT Annex 52 case “KON”: 2016 multi-family building, Sole/Wasser, floor heating + DHW
- ISC SoLAR (Allensbach): later neighbourhood with groundwater heat pumps

Those descriptions must not be copied onto the CoSSMic OPSD houses.

## Implication

OPSD can show **that** two homes have a metered heat-pump electricity series. It cannot tell PVNavigator **which** heat-pump model class to assume. WPuQ remains the better-documented HP research set for type-aware validation; OPSD HP feeds are untyped electricity only.

If this metadata is required later, the documented contact is Adrian Minde (ISC Konstanz). That would be an external enquiry, not something recoverable from the published package.
