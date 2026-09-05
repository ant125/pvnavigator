# SpeicherGrenze – Internes Physikmodell

> Interne technische Spezifikation.  
> Dieses Dokument beschreibt die implementierte Berechnungslogik,
> Modellparameter, Randbedingungen und bekannte Einschränkungen vollständig.
> Es ist nicht die öffentliche Methodikseite und nicht für eine automatische
> Veröffentlichung unter `/technische-details` vorgesehen.

## Dokumentrollen

| Rolle | Dokument |
|---|---|
| Interne kanonische technische Spezifikation | dieses File (`docs/internal/speicher-physics-model.md`) |
| Lastprofil-Skalierung (Engineering-Prinzip) | [Load Profile Scaling Principle](#load-profile-scaling-principle) in diesem File |
| Öffentliche, vereinfachte Methodik | `docs/physics-model.md` (gerendert unter `/technische-details`) |
| Offizielle Quellen (SSOT) | `packages/pv-methodology` → `/methodik-quellen` |
| Architecture canon | `docs/ARCHITECTURE.md` |

- Implementiertes Verhalten ist letztlich durch den referenzierten Produktions-Quellcode definiert.
- Abweichungen zwischen Code und Dokumentation sind als Defekte zu behandeln und zu auditieren.

---

## Core modelling principles

The calculation engine of SpeicherGrenze is built on a small number of architectural principles.

Every new dataset, simulation model and calculation component should follow these principles unless there is an explicit engineering decision to change them.

### 1. Separate energy volume from temporal distribution

Annual energy consumption is always defined by the user.

Timing comes from the component’s measured or reference profile, or from explicit user-provided behavioural inputs.

These two concepts are intentionally independent.

### 2. Behaviour/timing has an explicit source

Behaviour and timing must come from either:

- measured or reference data appropriate to the component, or
- explicit user-provided behavioural inputs.

They must not come from hidden invented assumptions.

Measured datasets remain the timing source for template-based loads (BDEW, ThermBuild, WPuQ). They are used to reproduce realistic temporal behaviour, not because of their original annual energy.

### 3. Deterministic calculations

For identical inputs, SpeicherGrenze must always produce identical outputs.

No randomisation or hidden optimisation is allowed inside the calculation engine.

### 4. Single Source of Truth

Every physical model, dataset and methodology must have exactly one authoritative implementation.

Duplicated modelling logic should be avoided.

### 5. Architecture grows by extension

New datasets should extend the existing architecture.

They should not require redesigning the calculation engine or replacing existing modelling principles.

These principles form the foundation of the SpeicherGrenze calculation engine and should remain stable as the project evolves.

---

# Technische Details der Berechnung

Diese Seite beschreibt die technischen Grundlagen der Berechnung.

---

## 1. Überblick

Diese Berechnung basiert auf einem physikalischen Simulationsmodell

für Photovoltaik-Erzeugung und Batteriespeicher.

### Zeitauflösung und Kalender

Die **Produktionssimulation** erfolgt in 15-Minuten-Schritten. Jedes modellierte Jahr besteht aus genau 35.040 Intervallen mit einer Dauer von jeweils 15 Minuten (Δt = 0,25 h).

- BDEW-Quelle: natives H25-Viertelstundenprofil (96 Slots/Tag, 35040 Schritte/Nichtschaltjahr). Keine Dynamisierung, keine Feiertags-Umbelegung.
- PVGIS-Quelle: unverändert stündlich (seriescalc). Nach der bestehenden Berlin-8760-Ausrichtung wird jede Stundenenergie \(E\) gleichmäßig auf vier Viertelstunden \([E/4, E/4, E/4, E/4]\) verteilt. Keine 15-min-PVGIS-API, keine Einstrahlungsinterpolation.
- Wärmepumpe: Luft/Wasser über gemessene 15-Minuten-Referenzprofile (ThermBuild), Wasser/Wasser über das gemessene WPuQ-Referenzprofil, jeweils gleichmäßig auf die eingegebene Jahres-kWh skaliert. Gemeinsames Skalierungsprinzip: [Load Profile Scaling Principle](#load-profile-scaling-principle).
- Elektroauto (EV v1): generiertes zustandsbehaftetes Heimladeprofil, separat für jedes Wetterjahr (35.040 Schritte). Nur die Heimladung geht in die Haushaltslast. Arbeitsplatzladung erscheint nicht im Lastprofil. Keine gemessene Template-Skalierung. Siehe [2.4 Electric Vehicle](#24-electric-vehicle).
- Merge: indexweise, alle Komponenten müssen dieselbe Länge haben (kein Mix 8760 + 35040).
- Kernel: `timeStepHours = 0.25`, `BATTERY_MODEL_VERSION = 1.1.0`, `PHYSICAL_KERNEL_SCHEMA_VERSION = 1.1.0`.
- Stundenhelfer (BDEW hourly, `createHeatPumpComponent` 8760) bleiben für Regression/Rollback.

---

## 2. Eingangsdaten

### 2.1 PV-Erzeugung (PVGIS)

Die Berechnung der PV-Erzeugung basiert auf den Daten des PVGIS-Systems

der Europäischen Kommission (Joint Research Centre).

Berücksichtigte Effekte:

- Standort (Latitude / Longitude)

- Dachneigung (Tilt)

- Ausrichtung (Azimut)

- Solare Einstrahlung

- Systemverluste (Standardwert)

PVGIS berücksichtigt standardmäßig pauschale PV-Systemverluste von 14 %. Dazu gehören typischerweise Wechselrichterverluste, Kabelverluste, Modul-Mismatch, Verschmutzung (Soiling) und weitere typische Anlagenverluste.

Diese Verluste betreffen ausschließlich die PV-Anlage. Speicherverluste sind darin nicht enthalten und werden separat im Batteriemodell berücksichtigt.

👉 PVGIS gilt als Industriestandard für die Ertragsabschätzung von PV-Anlagen in Europa.

---

### Details zur Datenbasis

- Datenquelle: PVGIS (EU JRC)

- Strahlungsdaten: SARAH2 Satellitendatenbank

- Zeitauflösung der Quelle: stündlich (8760 Werte pro Jahr nach Kalenderangleichung)
- Simulation: 15-Minuten-Schritte (35.040 Werte). Jede Stundenenergie \(E\) wird gleichmäßig auf \([E/4, E/4, E/4, E/4]\) verteilt.

- Mehrjährige Simulation (2006–2020)

### Schaltjahre

Im Zeitraum 2006–2020 sind die Wetterjahre 2008, 2012, 2016 und 2020 Schaltjahre. Nach der Umrechnung der PVGIS-Zeitstempel auf Europe/Berlin wird der lokale 29. Februar entfernt. Dadurch verwenden PV-Erzeugung, Lastprofil und Batteriesimulation für jedes Jahr dasselbe nicht-schaltjährige Raster (8760 Stundenquellenwerte, anschließend 35.040 Viertelstunden).

### Zeitzone und Sommerzeit

PVGIS-Zeitstempel werden als UTC interpretiert und auf Europe/Berlin umgerechnet. Anschließend werden sie einem festen Raster aus 365 Tagen mit jeweils 24 Zivilstunden zugeordnet.

Die Zeitumstellung wird dabei vereinfacht abgebildet: Die fehlende Stunde im Frühjahr bleibt leer, während die doppelte Stunde im Herbst in einem gemeinsamen Stundenintervall zusammengefasst wird. Tage mit 23 oder 25 Simulationsintervallen werden nicht verwendet.

👉 Die Berechnung erfolgt physikalisch basierend auf realen Klimadaten,

nicht auf vereinfachten Durchschnittswerten.

👉 Wichtige Einschränkungen:

- Wetterdaten sind historisch und nicht prognostisch

- Lokale Verschattung (z. B. Bäume, Gebäude) wird nicht berücksichtigt

- Individuelle Anlagenverluste können abweichen

👉 Die Ergebnisse stellen eine realistische Ertragsabschätzung dar,

aber keine exakte Vorhersage der tatsächlichen Produktion.

---

### Mehrere Dachflächen

Für jede eingegebene Dachfläche werden PV-Leistung, Neigung und Ausrichtung separat berücksichtigt. Die Geocodierung des Gebäudes erfolgt einmal.

PVGIS berechnet für jede Dachfläche und jedes Wetterjahr eine eigene stündliche Erzeugungsreihe. Der im Formular verwendete Azimut von 0° bis 359° wird dabei in die von PVGIS erwartete Ausrichtung umgerechnet.

Nach der zeitlichen Ausrichtung auf das gemeinsame Raster mit 8760 Stunden werden die Erzeugungsreihen aller Dachflächen stundenweise addiert. Erst die zusammengefasste PV-Erzeugung wird anschließend mit dem Lastprofil und dem Batteriespeicher simuliert.

Der gesamte PV-Jahresertrag und die installierte Gesamtleistung ergeben sich aus allen Dachflächen. Der spezifische Ertrag wird als gesamter PV-Jahresertrag geteilt durch die Summe der installierten kWp berechnet.

Weitere Annahmen:

- Die PVGIS-Systemverluste von 14 % werden für jede Dachfläche angewendet.
- Lokale Verschattung wird derzeit nicht modelliert.
- Alle Dachflächen verwenden die Wetterjahre 2006–2020.

Es wird **keine** mittlere Dachneigung und **kein** mittlerer Azimut über die Flächen gebildet. Jede Fläche behält ihre eigenen Eingaben für Neigung und Ausrichtung.

---

### 2.2 Lastprofil (Stromverbrauch)

- Quelle: BDEW Standardlastprofil H25

- Entwickelt vom Bundesverband der Energie- und Wasserwirtschaft (Deutschland)

- Repräsentiert ein typisches Haushaltsverbrauchsverhalten

### BDEW-Lastprofil H25

Als Haushaltslast dient das BDEW-Standardlastprofil H25 in nativer Viertelstundenauflösung mit 35.040 Werten (96 Slots/Tag). Die hinterlegte Referenzreihe entspricht dem Kalenderjahr 2025 und einer Bezugsmenge von 1 GWh. Dynamisierung und Feiertags-Umbelegung werden nicht angewendet.

Für jedes Wetterjahr von 2006 bis 2020 wird das Profil anhand von Monat und Tagestyp (Werktag, Samstag oder Sonntag) für die jeweilige Kalenderstruktur neu zusammengesetzt. Anschließend wird es so skaliert, dass seine Jahressumme exakt dem eingegebenen Haushaltsverbrauch entspricht.

Gemeinsames Skalierungsprinzip für BDEW, WPuQ und ThermBuild: [Load Profile Scaling Principle](#load-profile-scaling-principle).

👉 Wichtig:

Dieses Profil ist ein statistisches Durchschnittsprofil und kein individuelles Messprofil.

Das bedeutet:

- Tages- und Jahresverlauf sind realistisch modelliert

- BDEW selbst enthält keine Wärmepumpe und kein Elektroauto. Ist eine Wärmepumpe aktiviert, wird sie separat modelliert (Abschnitt 2.3). Ist EV v1 aktiviert, wird die Heimladung separat als explizite Lastkomponente modelliert (Abschnitt 2.4).

- Individuelle Abweichungen, die nicht als eigene Lastkomponente modelliert sind (z. B. Home Office), bleiben möglich

👉 Die Abweichung der Simulation hängt stark davon ab,

wie gut das Standardlastprofil dem tatsächlichen Verbrauchsverhalten entspricht.

---

### 2.3 Wärmepumpe

Falls eine Wärmepumpe aktiviert ist, wird der zusätzliche Stromverbrauch separat modelliert und dem Haushaltsverbrauch hinzugefügt.

Annahmen:

Der eingegebene Jahresstromverbrauch der Wärmepumpe wird als zusätzliche Lastreihe in 15-Minuten-Schritten modelliert. Für Luft/Wasser verwendet die Produktion gemessene elektrische Referenzprofile aus der ThermBuild-Messkampagne. Für Wasser/Wasser verwendet die Produktion ein gemessenes elektrisches Referenzprofil aus dem WPuQ-Projekt (bewohnte Einfamilienhäuser, eigener Wärmepumpenzähler). Das Profil wird gleichmäßig auf den angegebenen Jahresstromverbrauch skaliert. Es handelt sich nicht um den Lastgang der Wärmepumpe des Nutzers. Siehe [Load Profile Scaling Principle](#load-profile-scaling-principle).

Wasser/Wasser ist nur für Heizung und Warmwasser verfügbar.

👉 Wichtig:

Die Wärmepumpe verändert das Lastprofil deutlich, insbesondere durch:

höheren Verbrauch in Zeiten geringer PV-Erzeugung

Dadurch steigt der Bedarf an gespeicherter Energie.

👉 Einschränkungen:

Kein dynamisches Temperaturmodell

Keine Abbildung von realen Steuerstrategien

Das Referenzprofil bildet nicht die individuelle Wärmepumpe des Nutzers ab.

Offizielle Quellen und öffentliche Formulierung: Methodik & Quellen (`thermbuild-fordatis-486`, `wpuq-wasserwasser-heatpump`).

---

### 2.4 Electric Vehicle

SpeicherGrenze EV v1 models an electric vehicle as an additional household load component. When EV is enabled, the model generates one deterministic 35.040-step home-charging load profile for each target weather year. That profile is merged with the household load and the optional heat-pump load before the existing physical battery kernel runs.

`pv-core` continues to see only the final merged load profile. The physical kernel remains unchanged. The EV vehicle battery is not a second storage device inside `pv-core`.

This section is the frozen EV v1 methodology. The profile model is implemented in `@ev-profile/loader` and is integrated into the server-side SpeicherGrenze load pipeline: a home-charging profile is generated separately for each weather year, merged with the household and optional heat-pump loads, and included in the existing robustness calculations. The customer form/UI and report/PDF presentation are not yet implemented.

**Terminology.** In mathematical result formulas later in this document (`EV₀`, `EV(C)`, `EV_mean`, `ΔEV`), `EV` historically denotes Eigenverbrauch. In this section, EV denotes Electric Vehicle. Vehicle-energy ledger symbols use `Edrive`, `Ehome`, `Evehicle`, and related names — not `EV`.

#### Product philosophy

PVNavigator does not invent customer behaviour when physically relevant information can reasonably be provided by the user.

Physically relevant EV parameters are requested explicitly. No hidden behavioural default may materially influence the storage recommendation. The calculation must remain traceable from user input to derived EV demand to the final home-charging profile.

If essential EV information is unavailable, EV is excluded rather than modelled from unsupported assumptions.

SpeicherGrenze does not model an average EV owner. It models the specific customer from the information explicitly provided.

#### Required user inputs

The user enters only values. Units and time format are fixed by the UI.

**Vehicle**

- annual driving distance \(D_a\): km / year
- electricity consumption `consumptionKwhPer100Km`: kWh / 100 km
- usable EV battery capacity: kWh

**Typical driving pattern**

Separate typical driving distances:

- Monday–Friday \(d_{\mathrm{WD}}\): km / day
- Saturday \(d_{\mathrm{SA}}\): km / day
- Sunday \(d_{\mathrm{SU}}\): km / day

Approved principle:

- annual kilometres = energy volume / how much
- typical WD / SA / SU distances = temporal distribution / when

**Home charging**

- maximum effective home charging power `maxHomeChargePowerKw`
- home charging availability Monday–Friday
- home charging availability Saturday
- home charging availability Sunday

Charging times use the same 15-minute grid as the rest of SpeicherGrenze (96 slots/day, Δt = 0,25 h).

**Workplace charging**

Question:

Können Sie Ihr Elektroauto regelmäßig am Arbeitsplatz laden?

If no:

- no workplace parameters are required.

If yes, both of the following are required:

- average workplace charging energy: kWh / month
- typical workplace charging frequency: charging days / month

Both are required because they answer different physical questions:

- kWh/month defines the energy volume charged outside the home.
- charging days/month prevents the model from unrealistically smoothing that energy into a small equal charge on every weekday.

#### Driving-distance normalization

For each target weather year \(Y\), use the existing canonical Europe/Berlin calendar classification shared with the household model (`classifyBdewDayTypeEuropeBerlin`):

- WD = Monday–Friday
- SA = Saturday
- SU = Sunday
- 29 February omitted
- total modelled days = 365

Let \(N_{\mathrm{WD}}(Y)\), \(N_{\mathrm{SA}}(Y)\), \(N_{\mathrm{SU}}(Y)\) be those day counts.

\[
D_{\mathrm{imp}}(Y)=N_{\mathrm{WD}}(Y)\,d_{\mathrm{WD}}+N_{\mathrm{SA}}(Y)\,d_{\mathrm{SA}}+N_{\mathrm{SU}}(Y)\,d_{\mathrm{SU}}
\]

For \(D_a>0\), require \(D_{\mathrm{imp}}(Y)>0\).

Then

\[
s(Y)=\frac{D_a}{D_{\mathrm{imp}}(Y)}
\]

and

\[
d_{\mathrm{effective},\tau}(Y)=s(Y)\,d_{\tau},\qquad \tau\in\{\mathrm{WD},\mathrm{SA},\mathrm{SU}\}
\]

Apply the corresponding effective distance to every modelled day of that type.

Correct only the final floating-point residual on the last modelled day so that

\[
\sum \mathrm{dailyKm}[Y] = D_a
\]

within numerical tolerance.

Annual EV driving-energy demand is

\[
E_{\mathrm{drive}}=D_a\cdot\frac{\mathrm{consumptionKwhPer100Km}}{100}
\]

and must be identical for every weather year.

Do not reuse \(s(Y)\) of one weather year for another.

Driving distance must never be reduced because workplace charging exists. Workplace charging changes where electrical energy is replenished, not how much the vehicle is driven.

##### Mileage consistency metadata

Always preserve:

- `impliedAnnualKmFromTypicalDistances`
- `normalizationFactor`

For customer-facing comparison, use a fixed non-leap reference mix:

- 261 WD
- 52 SA
- 52 SU

\[
\mathrm{impliedAnnualKmFromTypicalDistances}
=261\,d_{\mathrm{WD}}+52\,d_{\mathrm{SA}}+52\,d_{\mathrm{SU}}
\]

\[
\mathrm{normalizationFactor}
=\frac{D_a}{\mathrm{impliedAnnualKmFromTypicalDistances}}
\]

(omit the factor when the implied mileage is 0).

Do **not** freeze a warning threshold (including 5 %) into the physics methodology. Whether the application visually warns about a large mismatch is UI / product policy, not a physical rule.

Hard validation:

- negative annual km → invalid
- negative typical km → invalid
- annual km \(>0\) while all WD / SA / SU typical km are zero → invalid
- annual km \(=0\) remains authoritative even if typical distances are non-zero; driving demand is zero and the mismatch may be exposed in metadata

#### Deterministic workplace charging events

Workplace charging must **not** be smoothed into a small equal credit on every weekday.

When workplace charging is enabled, for each calendar month of target year \(Y\):

Eligible dates are all Monday–Friday modelled civil dates in chronological order. Saturday, Sunday, and omitted 29 February are not eligible.

Let \(W\) be the number of eligible working days in that month and \(n=\) `chargingDaysPerMonth`.

Validation:

- \(n\) must be an integer
- if workplace kWh/month \(>0\), then \(n\) must be \(>0\)
- if \(n>W\) for any simulated month, return a validation error
- never silently clamp

For \(k=0,\ldots,n-1\), select workplace event index

\[
\mathrm{idx}(k)=\left\lfloor\frac{(2k+1)\,W}{2n}\right\rfloor
\]

The selected date is the eligible weekday at \(\mathrm{idx}(k)\).

This is the frozen neutral deterministic placement convention. It is:

- evenly distributed through the eligible working days
- without weekday preference
- without a Friday-specific assumption
- without randomness
- not a claim that these are the customer’s actual charging weekdays

Monthly workplace energy is divided equally between those \(n\) events. Only the final event absorbs the floating-point residual so that the monthly offered energy equals exactly the declared kWh/month.

Workplace energy:

- never enters the household load profile
- only affects the EV battery energy state
- may be rejected when the usable EV battery is full
- rejected workplace energy must be preserved explicitly in calculation metadata

Workplace charging is **not** a simple annual subtraction from EV driving energy.

#### Abstract daily event ordering

Do **not** introduce invented customer clock times such as driving at 08:00 or workplace charging at 12:00.

Driving and workplace charging are abstract EV-energy-state transitions. Only home charging exists on the physical 15-minute household grid.

For each civil day \(D\):

1. Determine that day’s user-defined home-availability mask.
2. Determine the first home-unavailable slot of that civil day.
3. Immediately before that unavailable period, apply:
   - the day’s driving-energy consumption;
   - then the workplace charging event, if that date is a selected workplace charging day.
4. After those abstract state transitions, vehicle energy is available to the subsequent real home-charging slots.

If the vehicle is home-available for the entire civil day:

- use civil midnight as the abstract event boundary;
- this is a calendar boundary, not an assumed commute time.

If there is no home availability that day:

- the same abstract daily energy transitions still occur;
- home charging remains zero.

The event epoch is derived from the user-provided home-availability boundary, not from an invented departure or arrival time.

A home-charging slot at time \(t\) sees vehicle energy after every event epoch strictly before \(t\). An overnight morning segment therefore replenishes the previous civil day’s driving / workplace events, not the new day’s events.

#### Home charging windows

Materialize the user’s WD / SA / SU availability directly on the 15-minute grid.

For a day-type window:

- `start < end` → `[start, end)` on that civil day
- `start > end` → overnight wrap: `[start, 24:00)` plus `[00:00, end)`
- `start == end` must **not** implicitly mean 24 hours

Full-day availability must use an explicit UI / data representation.

Continuity across midnight exists only when the next civil day’s own availability also contains the corresponding morning slots.

Example: a Friday WD window does not automatically make Saturday morning available unless Saturday’s own window includes those slots.

Home charging:

- occurs only in available 15-minute slots
- is unmanaged
- never exceeds `maxHomeChargePowerKw * 0.25` kWh per slot
- charges only into free usable EV battery capacity
- is the only EV energy written into the household load profile

There is no PV-aware or tariff-aware dispatch.

#### Vehicle battery energy buffer

The EV battery is represented internally by usable energy

\[
0\le E_{\mathrm{vehicle}}\le \mathrm{usableBatteryCapacityKwh}
\]

It is **not** the stationary Speicher battery, not a second `pv-core` storage device, and not V2H. It must not use home-battery SOC types.

For EV v1, the vehicle battery exists only to determine how charging outside the home can carry energy across multiple days and how much charging can physically be accepted.

Driving:

```text
served   = min(Evehicle, drivingDemand)
unserved = drivingDemand − served
Evehicle -= served
```

Workplace charging offer:

```text
accepted = min(usableBatteryCapacityKwh − Evehicle, workplaceOffer)
rejected = workplaceOffer − accepted
Evehicle += accepted
```

Home charging during an allowed slot:

```text
home = min(usableBatteryCapacityKwh − Evehicle, maxHomeChargePowerKw * 0.25)
Evehicle += home
```

and `home` is written to the EV household-load profile.

Driving distance must never be silently reduced. A driving-energy requirement that cannot be supplied by the vehicle buffer is physical infeasibility.

#### Cyclic year-boundary treatment

The reported EV year must not depend on an arbitrary 1 January SOC.

Physical requirement: the reported annual EV simulation must satisfy a cyclic vehicle-energy boundary

\[
E_{\mathrm{end}}\approx E_{\mathrm{start}}
\]

within numerical solver tolerance.

Each target weather year is solved independently. Do not carry vehicle energy from 2006 into 2007 or between any other weather years.

Production approach: repeated-year warm-up / fixed-point iteration.

- The numerical seed for the first discarded pass may be \(E_{\mathrm{vehicle}}=0\).
- Run the complete target year.
- Use the previous pass’s year-end vehicle energy as the next pass’s starting energy.
- Continue until the annual cycle converges.
- Only the converged pass becomes the reported EV profile.

The seed is a numerical solver seed only. It is not a claim that the customer starts January with an empty EV battery.

Do **not** freeze:

- a customer starting SOC
- a specific maximum iteration count as physical methodology
- a specific floating-point epsilon as physical behaviour

Numerical tolerance and iteration limits are implementation guards.

If convergence cannot be achieved within the implementation guard:

- fail the EV year
- do not publish a cold-start profile

#### Energy-conservation ledger

For one reported weather year preserve at least:

- `Edrive` — declared driving-energy demand
- `EdriveServed`
- `EdriveUnserved`
- `EworkplaceDeclared`
- `EworkplaceAccepted`
- `EworkplaceRejected`
- `Ehome`
- `Estart`
- `Eend`

Identities:

```text
EworkplaceDeclared = EworkplaceAccepted + EworkplaceRejected
Edrive             = EdriveServed + EdriveUnserved
```

Vehicle energy conservation:

```text
Eend − Estart = EworkplaceAccepted + Ehome − EdriveServed
```

For the converged cyclic reported year, `Eend ≈ Estart`, therefore

```text
Ehome + EworkplaceAccepted ≈ EdriveServed
```

within numerical tolerance.

Zero home EV charging is valid. Do **not** reject merely because `EworkplaceDeclared >= Edrive`, because workplace charging may cover all required EV energy.

Rejected workplace energy is not home-charging credit.

#### Physical infeasibility

Distinguish input validation, valid but notable results, and genuine physical infeasibility.

**Input validation** (EV excluded; no profile generated):

- missing required EV inputs
- invalid / non-finite numbers
- negative km
- invalid usable battery capacity
- invalid charging power
- annual km \(>0\) with no temporal driving shape
- workplace charging enabled but missing kWh/month or charging days/month
- charging days/month exceed eligible weekdays

**Valid but notable results** (not automatically errors):

- workplace declared energy exceeds annual EV demand
- some workplace energy is rejected because the battery is already full
- home EV charging becomes zero
- typical day distances imply a substantially different annual mileage from annual km

**Genuine physical infeasibility** (fail the EV year):

- `EdriveUnserved` greater than numerical tolerance
- vehicle battery energy outside \([0,\,\mathrm{capacity}]\)
- home charge outside declared windows
- home slot energy greater than the charging-power limit
- broken conservation identity
- cyclic solver failure

Do not silently:

- reduce driving distance
- spill home charging outside availability
- exceed charging power
- discard required driving energy

#### Calendar behaviour

EV must explicitly differ from the heat-pump profile.

Heat-pump production profiles use `calendarRemap: false` because they preserve measured weather/seasonal sequences. The measured campaign year is not weekday-remapped onto the weather calendar.

EV is behavioural and day-type dependent. Monday–Friday / Saturday / Sunday behaviour is part of the EV model itself.

Therefore EV must be generated separately for every target weather year using that year’s actual calendar. EV must never be built once for `years[0]` and reused across 2006–2020.

29 February is omitted consistently with the existing 35.040-step non-leap grid.

Household and EV must use the same canonical weekday / day-type classification (Werktag, Samstag, Sonntag) so that Saturdays and Sundays align.

The resulting EV output for every target year is:

- exactly 35.040 interval-energy values
- non-negative
- deterministic

#### Relationship to the Load Profile Scaling Principle

EV still follows the high-level principle in [Load Profile Scaling Principle](#load-profile-scaling-principle):

- annual driving distance and consumption define annual energy volume
- user driving and charging behaviour define temporal distribution

EV is an explicit generated-profile exception to measured-template uniform scaling.

EV does **not** use a measured template plus one uniform amplitude scaling factor such as `scaleUniformEnergy`.

Do not force EV into the heat-pump / household template-scaling implementation (BDEW remap-then-scale, ThermBuild / WPuQ unit-weight × annual kWh).

#### Resulting load architecture

```text
Household profile
+
optional Heat Pump profile
+
optional EV home-charging profile
↓
merge load components
↓
35.040 total household load
↓
existing physical battery kernel
```

The physical kernel remains unchanged.

EV is an additional positive household load component. Only home charging enters the merge. Workplace charging does not.

All merged components must have the same length (35.040). Merge remains index-wise, as for household and heat pump.

#### Report traceability

The calculation result / report must preserve the EV inputs used.

Section title intended for the report:

Ihre Angaben zum Elektroauto

Required displayed inputs:

- Jahresfahrleistung
- Stromverbrauch
- typical driving distance Monday–Friday
- typical driving distance Saturday
- typical driving distance Sunday
- usable battery capacity
- maximum home charging power
- home charging windows Monday–Friday / Saturday / Sunday
- workplace charging yes/no
- if yes:
  - kWh/month
  - charging days/month

Approved report text:

Die Berechnung basiert auf den oben angegebenen Eingabedaten.

And:

Ändern sich diese Eingabedaten, kann sich auch die empfohlene Speichergröße ändern.

The report should later also expose explainable derived values such as:

- annual EV driving / charging-energy demand
- energy supplied at the workplace
- remaining annual home-charging demand

Always preserve the mileage-consistency metadata (`impliedAnnualKmFromTypicalDistances`, `normalizationFactor`) and the workplace accepted / rejected split.

Unapproved report aggregation rules are not defined here.

#### Scope and limitations of EV v1

EV v1 includes:

- one electric vehicle
- user-defined annual driving distance
- user-defined consumption
- user-defined usable battery capacity
- day-type driving pattern
- user-defined home charging windows
- user-defined maximum home charging power
- workplace charging energy and charging frequency
- vehicle-energy buffer
- deterministic 15-minute home charging profile

EV v1 intentionally does not model:

- PV-optimised charging
- dynamic tariffs
- HEMS control
- bidirectional charging / V2H
- multiple vehicles
- battery degradation
- temperature-dependent EV consumption
- detailed charging-power taper / BMS behaviour

---

### Mehrjährige Mittelung

PV-Ertrag, Eigenverbrauch ohne Speicher und die Batteriesimulationen für Speichergrößen von 5 bis 30 kWh werden für dieselben Wetterjahre 2006 bis 2020 berechnet. Die ausgewiesenen Jahresenergiewerte sind arithmetische Mittelwerte dieser fünfzehn Jahre.

Autarkiegrad und Eigenverbrauchsquote sind Quotienten aus diesen Mittelwerten der Energiegrößen — **nicht** Mittelwerte von jährlichen Prozentwerten.

Ist eine Wärmepumpe aktiviert, ist ihr Verbrauch Bestandteil der modellierten Haushaltslast. Ist EV v1 aktiviert, ist die Heimladung ebenfalls Bestandteil der modellierten Haushaltslast; Arbeitsplatzladung nicht.

Alle physikalischen Kennzahlen beziehen sich auf die **technische Speichergrenze**. Die planerische Anfangskapazität (75 %-Restkapazitäts-Anpassung) dient nur der Kaufempfehlung und wird **nicht** zur Berechnung der physikalischen Kennzahlen verwendet.

---

## Load Profile Scaling Principle

This is an engineering design decision of SpeicherGrenze, not a dataset-specific accident.

BDEW H25, WPuQ household profiles, and ThermBuild heat-pump profiles are **not** used because of their absolute annual energy. They are used because of their **temporal shape**.

The user's annual energy consumption always determines the total annual energy. The selected profile determines only **when** this energy is consumed throughout the year.

> **Engineering principle:** Annual consumption determines the energy volume. The selected profile determines the temporal distribution.

### Common scaling rule

Template-based production and robustness load sources (BDEW, WPuQ households, ThermBuild / WPuQ heat-pump profiles) follow the same modelling philosophy:

1. Take the original 15-minute yearly profile.
2. Preserve its relative temporal shape.
3. Apply **one** uniform annual scaling factor to every interval.
4. Ensure the resulting 35,040-step profile sums exactly to the user's requested annual kWh (within floating-point error).

```text
scaleFactor = userAnnualKwh / sum(sourceProfile)
result[i]   = sourceProfile[i] × scaleFactor
```

Each `result[i]` is interval energy in kWh. Timing, cycling, zeros, and relative peaks are unchanged; only amplitude changes.

Generated stateful EV home-charging profiles are an explicit exception. They do not use a measured template or `scaleUniformEnergy`. See [2.4 Electric Vehicle](#24-electric-vehicle).

Runtime entry points:

- Household BDEW: `createUserLoadProfile15MinForYear` in `packages/bdew-profile`
- WPuQ robustness: `scaleProfileToAnnualKwh` in `apps/speicher-physik/src/lib/wpuqCohort.ts`
- Heat pump: `scaleUniformEnergy` via `createHeatPumpProfile15Min` in `packages/heatpump-profile`

### Profile-specific notes

**BDEW H25** is the production household reference profile. It is stored as yearly weights on a 1 GWh reference scale, remapped onto the requested weather-year calendar (weekday / Saturday / Sunday templates; no Dynamisierung; no weekday-holiday remap), then scaled so the 35,040 steps sum to the user's annual household consumption. The remapped-year sum is used as the divisor, not a second hard-coded 1 GWh factor.

**WPuQ** supplies 27 measured real household profiles (2019 COMPLETE NO_PV). They are used **only** for robustness validation, not as a user-selectable production load. Research preprocessing first normalizes each house to a packed 5000 kWh year so shape can be compared independently of measured volume. Production then scales those packed profiles to the customer's annual household consumption with the same uniform factor. Original measured annual kWh is research metadata; the production pack does not retain it.

**ThermBuild** supplies measured Luft/Wasser heat-pump electrical profiles. Production stores them as unit-weight yearly shapes (`sum(weights) = 1`). Runtime scales those weights directly to the user's annual electrical heat-pump consumption: `profile[i] = weight[i] × userHpKwh`. `measuredAnnualElectricalKwh` is provenance, not the runtime scale divisor. The measured campaign year is not weekday-remapped onto the weather calendar.

**WPuQ Wasser/Wasser** supplies the production heat-pump electrical profile for Wasser/Wasser heating + DHW. The same unit-weight scaling applies. Wasser/Wasser heating-only has no catalogue default.

### Heat-pump envelope and identifiers (contract)

Heat-pump production identifiers use one grammar:

`{tech}-{dhw}-{dataset}-{optionalYear}-{building}-v{n}`

Examples:

- `lw-heating-only-thermbuild-o5-v1`
- `lw-heating-dhw-thermbuild-n2-v1`
- `ww-heating-dhw-wpuq-2019-sfh38-v1` (production Wasser/Wasser default)

Shared production envelope fields (typed in `packages/heatpump-profile`): `schemaVersion`, `profileId`, `technology`, `dhwService`, `timeStepHours`, `steps`, `weights`, `measuredAnnualElectricalKwh`, `quality`, `methodologySourceId`, `license`, `generatorVersion`, `sourceWindow`, `calendarAlignment`, `seasonalShares`, `fillSummary`. Dataset-specific provenance (rotation, zip vs HDF5 locators, raw annual kWh) remains optional.

Methodology ids are separate:

- `thermbuild-fordatis-486` — production Luft/Wasser heat-pump profiles (`load_profiles`)
- `wpuq-wasserwasser-heatpump` — production Wasser/Wasser heat-pump profile (`load_profiles`)
- `wpuq-scientific-data` — WPuQ household robustness only (`research`)

Wasser/Wasser heating + DHW is the production default `ww-heating-dhw-wpuq-2019-sfh38-v1`. Wasser/Wasser heating-only is unsupported. Robustness houses stay under `research/wpuq/processed/robustness/` and are not catalogued.

### Accepted limitation

Uniform scaling preserves timing but also scales peak loads. A measured household of 2500 kWh scaled to 7500 kWh makes every 15-minute interval three times larger. The same applies to a measured heat pump.

This is an accepted modelling assumption in the current version of SpeicherGrenze.

The profiles are **temporal templates**. They are **not** equipment-sizing models. They do not represent a larger household, a larger heat-pump compressor, or a weather-adjusted COP. They redistribute the user-stated annual kWh in time.

### Future work

Possible future improvements include equipment-dependent scaling, weather-dependent heat-pump reshaping, and occupancy-dependent household reshaping. Those are future modelling improvements. They are intentionally outside the current architecture.

### Architectural rationale

This modelling principle intentionally separates two independent concepts.

The user specifies **how much** energy is consumed during a year.

The selected load profile specifies **when** that energy is consumed.

Those two dimensions are intentionally independent.

The separation allows SpeicherGrenze to:

- compare different households using the same annual energy;
- compare different heat-pump technologies using the same annual electrical consumption;
- perform robustness validation using measured real households without changing customer input;
- integrate future datasets without redesigning the calculation engine.

This separation is one of the fundamental design principles of SpeicherGrenze.

### Invariant

The higher-level invariant for every load component in SpeicherGrenze is:

1. Annual energy defines the energy volume (for EV: annual kilometres × consumption).
2. The model or profile defines the temporal distribution.
3. There is no silent arbitrary amplitude manipulation.

Template-based load components additionally satisfy:

1. The original measured or reference temporal shape must be preserved.
2. The profile must be scalable to any valid annual energy consumption using a single uniform scaling factor.
3. After scaling, the resulting 35,040-step profile must sum exactly (within floating-point tolerance) to the requested annual energy.

These template rules apply to:

- BDEW household profiles
- WPuQ reference households
- ThermBuild heat-pump profiles
- future domestic hot water profiles that are measured templates
- future industrial or commercial load datasets that are measured templates

They do **not** apply to SpeicherGrenze EV v1. EV is a generated stateful profile: annual kilometres and consumption define volume; user-declared driving and charging behaviour define timing. EV has no measured source profile and must not be forced through `scaleUniformEnergy`. See [2.4 Electric Vehicle](#24-electric-vehicle).

This higher-level volume / timing separation is considered part of the core architecture of SpeicherGrenze and should not be changed without an explicit modelling decision.

---

## 3. Simulationslogik

Für jede Stunde wird ein AC-Bus-Modell verwendet. Haushaltsflüsse und Systemverbrauch des Speichers werden getrennt bilanziert.

### PV-Überschuss-Stunde

1. PV deckt zuerst den Haushaltsverbrauch.
2. Verbleibende PV-Erzeugung deckt den Systemverbrauch (Auxiliary) des Speichersystems.
3. Weiterer PV-Überschuss lädt die Batterie über die modellierten Verluststufen.
4. Verbleibender Überschuss wird ins Netz eingespeist.

### Defizit-Stunde

1. Die Batterie deckt zuerst das Haushaltsdefizit.
2. Verbleibende verfügbare Batterieleistung kann den Systemverbrauch decken.
3. Das Netz deckt den restlichen Haushaltsbedarf.
4. Das Netz deckt den restlichen Systemverbrauch.

Der Systemverbrauch des Speichersystems wird separat erfasst. Er erhöht weder den ausgewiesenen Haushaltsverbrauch noch den Eigenverbrauch oder den Autarkiegrad.

---

## 4. Batteriemodell

Berücksichtigte Effekte:

- Modernes LiFePO4-Heimspeichersystem mit Hybridwechselrichter und DC-gekoppeltem Ladepfad (PV-Überschuss zuerst in den Speicher; Entladung über den Wechselrichter auf den AC-Haushaltsbus)

- Modellierte Verlustpfade mit getrennter Bilanz:
  - PV → Speicher
  - Zellverluste beim Laden
  - Zellverluste beim Entladen
  - Speicher → AC-Bus
  - Selbstentladung der Batterie
  - Systemverbrauch Standby

  Der effektive Gesamt-Roundtrip liegt weiterhin in der Größenordnung von etwa 94 %, wird aber aus mehreren modellierten Stufen abgeleitet.

- Speichergrößen entsprechen der herstellerseitig ausgewiesenen nutzbaren Kapazität (market usable kWh); interner BMS-/Chemie-Schutz ist darin bereits enthalten

- Im Standardmodell wird kein zusätzlicher Depth-of-Discharge-Abschlag angewendet (DEFAULT depthOfDischarge = 100 %)

- Realistische größenabhängige Lade- und Entladeleistungsbegrenzung moderner Hybrid-Heimspeichersysteme

Die Lade- und Entladeleistung wird über realistische, größenabhängige Leistungsgrenzen moderner Hybrid-Heimspeicher modelliert. Dadurch werden unrealistische Lade- und Entladeleistungen großer Speicher vermieden.

- Getrennte Bilanzierung von Haushaltsverbrauch und Systemverbrauch

Die Selbstentladung reduziert den Ladezustand der Batterie über die Zeit und wird als Batterieverlust berücksichtigt.

Der Systemverbrauch des Speichersystems (z. B. Elektronik, BMS, Kommunikation und Betriebsbereitschaft) wird separat bilanziert. Er kann durch PV, Batterie oder Netz gedeckt werden, erhöht aber nicht den ausgewiesenen Haushaltsverbrauch, Eigenverbrauch oder Autarkiegrad.

👉 Das Modell bildet das reale Verhalten eines Heimspeichers vereinfacht, aber praxisnah ab.

---

### 4.1 Notstromreserve

Optional kann eine Notstromreserve berücksichtigt werden.

Dabei wird ein Teil der Batteriekapazität für Notfälle reserviert

und im normalen Betrieb nicht genutzt.

👉 Modellierung:

Die Batterie entlädt nur bis zu einem definierten Mindestladestand

(State of Charge, SoC).

Beispiel:

Bei 2 kWh Notstromreserve startet die Jahres-Simulation mit 2 kWh gespeicherter
Energie. Diese Reserve ist vor aktiver Haushalts- und Auxiliary-Entladung geschützt.
Selbstentladung kann den SoC leicht unter die konfigurierte Reserve absenken;
eine automatische Nachfüllung (Netzladung oder unverbuchte SoC-Klemme) findet nicht statt.
PV-Ladung kann den SoC später wieder über die Reserve anheben.

👉 Auswirkungen:

Reduktion des nutzbaren Speicherbereichs

Leicht geringerer Eigenverbrauch

Leicht geringere Autarkie

👉 Ziel:

Sicherstellung einer minimalen Energieverfügbarkeit bei Stromausfällen.

👉 Einschränkungen:

Keine Simulation realer Notstromsysteme

Keine Umschaltlogik bei Netzausfall

Keine Priorisierung einzelner Verbraucher

👉 Die Notstromreserve wird als geschützte Startenergie und Entladeboden modelliert
(keine automatische Nachfüllung nach Selbstentladung).

---

### Details zur Simulation

Die Batteriesimulation basiert auf folgenden Annahmen:

- Ladung und Entladung erfolgen in 15-Minuten-Schritten (35.040 Zeitschritte pro Jahr, Δt = 0,25 h)

- Realistische größenabhängige Lade- und Entladeleistungsbegrenzung moderner Hybrid-Heimspeichersysteme (siehe Abschnitt 4)

- Wirkungsgrad wird berücksichtigt

- Die modellierte Speichergröße entspricht der ausgewiesenen nutzbaren Kapazität moderner Heimspeicher; ein zusätzlicher DoD-Abschlag wird im Standardmodell nicht angewendet (DEFAULT depthOfDischarge = 100 %)

- Optionale Notstromreserve bleibt eine separate, vom Anwender gewählte untere Kapazitätsgrenze (siehe Abschnitt 4.1)

- Für Legacy- oder Rohkapazitätsmodelle können benutzerdefinierte Spezifikationen weiterhin depthOfDischarge < 1.0 setzen

Der Eigenverbrauch und der Autarkiegrad beziehen sich auf den Haushaltsverbrauch. Der Systemverbrauch des Speichersystems wird separat bilanziert und erhöht diese Kennzahlen nicht künstlich.

👉 Wichtige Einschränkungen:

- Keine temperaturabhängigen Effekte

- Keine Alterung innerhalb eines Jahres

- Keine individuellen Steuerungsstrategien (z. B. Prognose oder dynamische Tarife)

- Keine Abbildung spezifischer Hersteller-Systeme

👉 Die Ergebnisse stellen eine realistische Näherung dar,

aber keine exakte Abbildung eines konkreten Speichersystems.

👉 Besonders bei großen PV-Anlagen kann die Leistungsbegrenzung

einen spürbaren Einfluss auf die Ergebnisse haben.

---

## 5. Vereinfachungen

Nicht explizit separat modelliert:

- temperaturabhängige Batterieeffekte

- Batteriealterung innerhalb eines Jahres

- dynamische Speichersteuerung (z. B. Prognosen oder variable Stromtarife)

- herstellerspezifische Systemlogik

- Netzrestriktionen

- detaillierte herstellerspezifische Wirkungsgradkennlinien von Batterie- und Hybridwechselrichtern

- Sub-Stunden-Inverterverhalten und dynamische Wirkungsgradkurven

---

## 6. Ergebnis

Die folgenden Kennzahlen beziehen sich auf die **technische Speichergrenze**, nicht auf die größere planerische Anfangskapazität. Jahresenergiewerte sind Mittelwerte der Wetterjahre 2006–2020.

### PV-Jahresertrag

Mittlere jährliche PV-Erzeugung aller Dachflächen nach den in PVGIS angesetzten Systemverlusten von 14 %. Mittelwert der Wetterjahre 2006–2020.

### Spezifischer Ertrag

PV-Jahresertrag geteilt durch die installierte Gesamtleistung aller Dachflächen.

`Spezifischer Ertrag = PV-Jahresertrag / PV-Gesamtleistung`

### Direktverbrauch ohne Speicher

PV-Energie, die im selben Stundenintervall unmittelbar den Haushaltsverbrauch einschließlich einer optionalen Wärmepumpe und einer optionalen EV-Heimladung deckt.

`EV₀ = Σ min(PV, Last)`

In mathematical result formulas, `EV` historically denotes Eigenverbrauch. In section 2.4, EV denotes Electric Vehicle.

### Eigenverbrauch mit Speicher

Energie zur Deckung des Haushaltsverbrauchs aus direkter PV-Erzeugung und aus der Batterie. Maßgeblich ist die technische Speichergrenze, nicht die größere planerische Anfangskapazität.

`Eigenverbrauch mit Speicher = Direktverbrauch + Batterie → Haushalt (AC)`

Der Systemverbrauch des Speichersystems ist **nicht** Bestandteil dieses Eigenverbrauchs.

### PV-Energie zur Batterieladung

PV-Überschuss, der vor den modellierten Ladeverlusten für die Batterieladung vorgesehen wird.

### Batterie → Haushalt (AC)

Energie, die nach Zell- und Wechselrichterverlusten auf der AC-Seite an den Haushalt geliefert wird.

Batterieenergie, die den Systemverbrauch des Speichersystems deckt, ist hier **nicht** enthalten.

### Batterieverluste gesamt

Summe aus PV→Speicher-Verlust, Zellverlust beim Laden, Zellverlust beim Entladen, Speicher→AC-Verlust und Selbstentladung.

Der Systemverbrauch Standby ist **nicht** Bestandteil der Batterieverluste gesamt.

Die Summe wird aus den ungerundeten Komponenten gebildet und erst danach gerundet. Einzeln gerundete Komponenten können vom gerundeten Gesamtwert um 1 kWh abweichen.

### Systemverbrauch Standby

Konstanter modellierter Eigenbedarf des Speichersystems von 15 W. Dies entspricht bei 8760 Stunden rund 131 kWh pro Jahr. Der Bedarf kann durch PV, Batterie oder Netz gedeckt werden.

Der Systemverbrauch wird separat bilanziert und ist nicht Bestandteil des Haushaltsverbrauchs, Eigenverbrauchs oder Autarkiegrads.

### Netzbezug Haushalt mit Speicher

Netzenergie zur Deckung des verbleibenden Haushaltsverbrauchs einschließlich einer optionalen Wärmepumpe und einer optionalen EV-Heimladung.

`Netzbezug Haushalt = modellierter Haushaltsverbrauch − Eigenverbrauch mit Speicher`

Netzenergie für den Systemverbrauch des Speichersystems ist **nicht** enthalten.

### Modellierte Netzeinspeisung

Im Modell verbleibender PV-Überschuss nach direktem Haushaltsverbrauch, Systemverbrauch und Batterieladung.

Der Wert stammt aus dem expliziten Netzeinspeisungs-Ledger der Simulation (Mehrjahresmittel an der technischen Speichergrenze). Es handelt sich **nicht** um eine EEG-Abrechnungsgröße und **nicht** um eine exakte Vorhersage des physikalischen Stromzählers. Eine Rekonstruktion als „PV-Jahresertrag − Eigenverbrauch“ wird nicht verwendet.

### Autarkiegrad

`Autarkiegrad = Eigenverbrauch / modellierter Haushaltsverbrauch × 100 %`

- Der Haushaltsverbrauch enthält eine optionale Wärmepumpe und eine optionale EV-Heimladung.
- Der Systemverbrauch des Speichersystems ist ausgeschlossen.
- Autarkie wird getrennt ohne und mit Speicher berechnet.
- Das Ergebnis ist der Quotient der Mehrjahres-Mittelwerte (nicht das Mittel von jährlichen Prozentwerten).

### Eigenverbrauchsquote

`Eigenverbrauchsquote = Eigenverbrauch mit Speicher / PV-Jahresertrag × 100 %`

- Es wird nur der Haushalts-Eigenverbrauch verwendet.
- Der Systemverbrauch des Speichersystems ist ausgeschlossen.
- Das Ergebnis ist der Quotient der Mehrjahres-Mittelwerte.

### Veränderungen

`Δ Eigenverbrauch = Eigenverbrauch mit Speicher − Direktverbrauch ohne Speicher`

`Δ Autarkie = (Eigenverbrauch mit Speicher − Direktverbrauch ohne Speicher) ÷ modellierter Haushaltsverbrauch × 100`

Δ Autarkie wird in **Prozentpunkten** ausgewiesen (nicht als „%“ des Autarkiegrads). Die Einzelwerte Autarkie ohne/mit Speicher bleiben ganzzahlig gerundet; Δ Autarkie wird aus den ungerundeten Quotienten gebildet und erst danach gerundet.

---

## 7. Genauigkeit

Diese Berechnung ist eine Erstabschätzung.

Die Abweichung kann je nach Übereinstimmung des Standardlastprofils mit dem
tatsächlichen Verbrauch, lokaler Verschattung, Wetterabweichungen und den
Eigenschaften des konkreten Speichersystems deutlich variieren. Eine
Genauigkeitsgarantie besteht nicht.

Wichtige Einschränkungen:

- BDEW H0 ist ein Standardprofil, kein gemessenes Haushaltsprofil
- lokale Verschattung wird nicht modelliert
- PVGIS-Wetterjahre sind historische Eingangsdaten, keine Ertragsgarantie
- herstellerspezifische Steuerstrategien und Wirkungsgradkennlinien werden nicht modelliert

---

## 8. Ziel

Ermittlung der technisch sinnvollen Speichergrenze.

Eine wirtschaftlich optimale Speichergröße wird in dieser Analyse nicht berechnet. Dafür müssen zusätzlich unter anderem Anschaffungskosten, Strompreis, Einspeisevergütung und mögliche Förderungen berücksichtigt werden.

Für detaillierte Wirtschaftlichkeitsanalysen siehe Premium-Version.

---

## 9. Interpretation der Ergebnisse

Die berechneten Werte dienen zur Orientierung bei der Auswahl der Speichergröße.

Wichtige Hinweise:

- Ein höherer Eigenverbrauch bedeutet nicht automatisch eine bessere Wirtschaftlichkeit  

- Große Speicher erhöhen den Eigenverbrauch, sind aber oft wirtschaftlich nicht sinnvoll  

- Die technisch sinnvolle Speichergrenze liegt in dem Bereich, ab dem zusätzliche Speicherkapazität den Eigenverbrauch nur noch geringfügig erhöht

👉 Einfluss der Eingaben:

Die Ergebnisse der Simulation hängen direkt von den eingegebenen Parametern ab.

Wichtige Einflussfaktoren:

PV-Anlage (kWp)

Eine größere PV-Anlage erhöht die verfügbare Energie und damit den potenziellen Eigenverbrauch.

Haushaltsverbrauch

Ein höherer Verbrauch erhöht den Bedarf an gespeicherter Energie.

Dadurch kann ein größerer Speicher sinnvoll sein.

Wärmepumpe

Eine Wärmepumpe verschiebt den Verbrauch in Zeiten mit geringerer PV-Erzeugung.

Dadurch steigt die Bedeutung des Speichers.

Notstromreserve

Eine aktivierte Notstromreserve reduziert den nutzbaren Speicherbereich.

Dies führt zu einem leicht geringeren Eigenverbrauch und geringerer Autarkie.

👉 Wichtig:

Die technisch sinnvolle Speichergrenze ergibt sich aus dem Zusammenspiel der technischen Eingaben und Simulationsannahmen.

Es gibt keine universell „richtige“ Speichergröße ohne Berücksichtigung des individuellen Systems.

---

## 10. Empfehlung

Die technisch sinnvolle Speichergrenze ist individuell und hängt unter anderem ab von:

- Ihrem Stromverbrauch  

- der Größe der PV-Anlage  

- Ihrem Lastprofil  

👉 In dieser Analyse erkennen Sie die technisch sinnvolle Speichergrenze daran,  

dass der zusätzliche Eigenverbrauch mit wachsender Speichergröße deutlich abnimmt.

Das bedeutet:

- Am Anfang bringt zusätzlicher Speicher viel Nutzen  

- Ab einem bestimmten Punkt steigt der Eigenverbrauch nur noch geringfügig  

👉 Dieser Punkt stellt die technisch sinnvolle Speichergrenze dar.

---

### Technische Speichergrenze und Kaufplanung

Die Analyse unterscheidet drei Begriffe:

1. **Technische Speichergrenze (Simulationsergebnis)**  
   Ergebnis der physikalischen Mehrjahressimulation: die heute technisch sinnvolle
   **nutzbare Kapazität** unter den aktuellen Simulationsannahmen (ohne
   Kapazitätsalterung im Modell). Sie wird über die feste Schwelle von
   **50 kWh zusätzlichem Eigenverbrauch pro Jahr** ermittelt (siehe unten). Das
   ist **kein** wirtschaftlicher Rentabilitätsschwellenwert.

2. **Planerische Kaufempfehlung / Planerische Anfangskapazität**
   Eine **planerische** Größe für den Speicherkauf. Die physikalische Simulation
   liefert die technische Speichergrenze; die angezeigte Kaufplanungs-Kapazität
   wird daraus abgeleitet.

   **Formel (Kaufplanung):**

   `Planerische Anfangskapazität = Math.ceil(technische Speichergrenze / PLANNING_REMAINING_CAPACITY_FRACTION)`

   mit der kanonischen Konstante in
   `apps/speicher-physik/src/lib/speicherRecommendation.ts`:

   `PLANNING_REMAINING_CAPACITY_FRACTION = 0.75`

   Aufrundung erfolgt mit `Math.ceil`. Bei technischer Größe 0 wird die
   planerische Größe ebenfalls 0 (keine Division).

   Dabei bedeutet 0,75 eine Planungsannahme von **75 % verbleibender nutzbarer
   Kapazität** (gleichbedeutend mit einer **25 %-Alterungsreserve** /
   Kapazitätsreserve). Der Planungshorizont beträgt etwa **10 Jahre**.

   Wichtige Abgrenzungen:

   - Es wird **keine** Alterungstrajektorie simuliert.
   - Die Simulation modelliert **keine** zehn Kalenderjahre Batteriealterung.
   - Die 75-%-Anpassung liegt **außerhalb** der Jahres- und Mehrjahressimulation.
   - Die planerische Anfangskapazität wird **nicht** zurück in die physikalische
     KPI-Lookup oder die Batteriesimulation geführt (`getPhysicalKpiLookupSize`
     verwendet ausschließlich die technische Speichergrenze).
   - Das ist eine allgemeine Planungsannahme, **keine** Prognose der
     tatsächlichen Batteriedegradation und **keine** Garantie für ein bestimmtes
     Speichersystem.

3. **Wirtschaftlich optimale Speichergröße**
   Wird in SpeicherGrenze **nicht** berechnet. Dafür wären unter anderem
   Anschaffungskosten, Strompreis, Einspeisevergütung und mögliche Förderungen
   erforderlich.

**Beispiel:** Technische Speichergrenze 9 kWh → planerische Anfangskapazität
12 kWh, weil `Math.ceil(9 / 0.75) = 12`.

Das entspricht etwa **33 % mehr Anfangskapazität** gegenüber der technischen
Speichergrenze — **nicht** einfach „Speichergrenze + 25 %“.

👉 **Wichtig:** Alle physikalischen Kennzahlen (Eigenverbrauch, Autarkie,
Netzbezug, Batterieflüsse, Verluste) beziehen sich weiterhin auf die
**technische Speichergrenze**, nicht auf die planerische Anfangskapazität. Die
tatsächliche Alterung hängt unter anderem von Hersteller, Batteriechemie,
Temperatur, Betriebsstrategie, Zyklenzahl, Entladetiefe und Garantiebedingungen
ab.

#### Herstellerkontext (Beispiele, keine Empfehlung)

Herstellergarantien zeigen, dass eine verbleibende Speicherkapazität häufig über
einen bestimmten Zeitraum, eine Zyklenzahl oder einen Energiedurchsatz definiert
wird. Die konkreten Bedingungen unterscheiden sich jedoch je nach Produkt.
Beispiele (sonnenBatterie 10 performance, Enphase IQ Battery 5P-Garantie,
Tesla Powerwall 2 European Warranty) sowie weitere Herstellerseiten
(Huawei LUNA, BYD Battery-Box, Tesla Powerwall) sind ausschließlich im zentralen
Register **Methodik & Quellen** (`packages/pv-methodology`,
`@pv-methodology/registry`) hinterlegt und unter `/methodik-quellen` öffentlich
einsehbar. Keine offiziellen Quell-URLs in dieser Datei duplizieren.

Die in SpeicherGrenze verwendeten 75 % sind deshalb keine Übernahme einer
bestimmten Herstellergarantie, sondern eine einheitliche und vorsichtige
Planungsannahme. Vor dem Kauf müssen die Garantiebedingungen des konkret
angebotenen Speichers geprüft werden. Diese Herstellerangaben stellen keine
Empfehlung oder Endorsement von PVNavigator dar.

Quellenstand: siehe Methodik & Quellen (`@pv-methodology/registry`)

### Ermittlung der technischen Speichergrenze

Als Vergleichspunkt wird zunächst der Betrieb ohne Batteriespeicher mit 0 kWh betrachtet. Anschließend werden nutzbare Speicherkapazitäten von 5 bis 30 kWh simuliert. Zwischen 5 und 30 kWh beträgt die Schrittweite 1 kWh.

Für jede Kapazitätsstufe wird der zusätzliche jährliche Eigenverbrauch gegenüber der vorherigen simulierten Stufe bestimmt:

`ΔEV(Cᵢ) = EV(Cᵢ) − EV(Cᵢ₋₁)`

Sobald dieser zusätzliche Eigenverbrauch erstmals weniger als 50 kWh pro Jahr beträgt, wird die vorherige Kapazitätsstufe als technische Speichergrenze ausgewiesen.

Ein Wert von genau 50 kWh pro Jahr löst die Grenze noch nicht aus. Wird der Schwellenwert bis 30 kWh nicht unterschritten, liegt das Ergebnis am oberen Rand des simulierten Bereichs bei 30 kWh.

Der Schwellenwert ist ein fester absoluter Wert. Er wird nicht als Prozentsatz des Haushaltsverbrauchs, der PV-Erzeugung oder des Eigenverbrauchs berechnet.

**Beispiel:** Liegt der zusätzliche Eigenverbrauch beim Schritt von 9 auf 10 kWh erstmals unter 50 kWh pro Jahr, beträgt die technische Speichergrenze 9 kWh.

---

## 11. Nächster Schritt

Diese Analyse zeigt die technisch sinnvolle Speichergröße basierend auf physikalischen Daten.

Für eine fundierte Entscheidung empfehlen wir eine Wirtschaftlichkeitsanalyse, die zusätzlich berücksichtigt:

- Strompreise  

- Einspeisevergütung  

- Investitionskosten  

- Förderprogramme  

---

## 12. Gesamtsystem-Genauigkeit

Die Einschätzung der Gesamtsimulation ergibt sich aus dem Zusammenspiel mehrerer Modellkomponenten:

### PV-Erzeugung (PVGIS)

- Physikalische Modellierung auf Basis historischer Klimadaten
- Wetterjahre sind Eingangsdaten, keine Ertragsgarantie
- lokale Verschattung wird nicht modelliert

### Lastprofil (BDEW)

- Statistisches Standardprofil (BDEW H0), kein gemessenes Haushaltsprofil
- Individuelle Abweichungen möglich
- Größter Unsicherheitsfaktor im Modell

### Batteriesimulation

- Physikalisch basiertes Modell mit praxisnahen Annahmen
- Vereinfachungen bei Steuerung und realem Systemverhalten
- herstellerspezifische Steuerstrategien und Wirkungsgradkennlinien werden nicht modelliert

---

👉 Gesamteinschätzung:

Die Abweichung kann je nach Übereinstimmung des Standardlastprofils mit dem
tatsächlichen Verbrauch, lokaler Verschattung, Wetterabweichungen und den
Eigenschaften des konkreten Speichersystems deutlich variieren. Eine
Genauigkeitsgarantie besteht nicht.

---

👉 Wichtig:

Die tatsächliche Abweichung hängt stark davon ab,

wie gut das Lastprofil dem realen Verbrauch entspricht.

➡️ Diese erweiterte Analyse ist in der Premium-Version verfügbar.

---

## 🔍 Transparenz

Diese Berechnung basiert auf einem physikalischen Modell,

das nachvollziehbar und reproduzierbar ist.

Wir verwenden:

- PVGIS-Daten (EU JRC)

- BDEW Standardlastprofile

- ein deterministisches Batteriesimulationsmodell

Das Batteriemodell bilanziert separat:

- PV-Ladeverluste

- Zellverluste

- Wechselrichterverluste

- Selbstentladung

- Systemverbrauch Standby

👉 Die Berechnung basiert auf transparenten technischen Annahmen und nachvollziehbaren Modellen.

---

## Mehrjahressimulation und SoC-Randbedingungen

### Wetterjahre und Simulationsstruktur

Die Produktions-Mehrjahressimulation verwendet die Wetterjahre **2006 bis 2020** (15 historische Wetterjahre).

Implementiertes Verhalten:

- Jedes Wetterjahr wird **separat** simuliert.
- Jedes Jahr enthält genau **35040** Viertelstundenintervalle (Δt = 0,25 h).
- Für jedes Jahr werden alle Speicherkapazitäten von **5 bis 30 kWh** (Schrittweite 1 kWh) simuliert.
- Die Jahre werden **nicht** zu einer durchgehenden Timeline von N × 35040 Schritten zusammengefügt.
- Jede Kombination aus Speicherkapazität und Wetterjahr startet eine **neue** Batteriesimulation.
- Es gibt **keinen** SoC-Übertrag vom 31. Dezember auf den 1. Januar.
- Es gibt **kein** Warm-up-Jahr.
- Es gibt **keine** zyklische SoC-Konvergenz (kein Schließen der Jahresgrenze auf den Anfangs-SoC).
- Scheitert die Berechnung eines Jahres (z. B. ungültiges PV-/Lastprofil), bricht die gesamte Berechnung ab; Jahre werden **nicht** stillschweigend übersprungen.

### Mehrjahresmittel und Speichergrenze

Für jede nutzbare Kapazität \(C\) gilt:

```
EV_mean(C) = (1/N) × Σ_y EV_y(C)
wobei N = Anzahl der Wetterjahre (hier N = 15 für 2006–2020).
```

Der marginale Eigenverbrauchszuwachs zwischen aufeinanderfolgenden simulierten Kapazitäten:

```
ΔEV(C_i) = EV_mean(C_i) − EV_mean(C_(i−1))
```

Auswahl der technischen Speichergrenze:

- Die Speichergrenze wird auf der **bereits gemittelten** Eigenverbrauchskurve `EV_mean(C)` ermittelt.
- Der erste marginale Schritt, der **streng unter** 50 kWh/Jahr liegt (`ΔEV < 50`), löst das Plateau aus.
- Zurückgegeben wird die **vorherige** simulierte Kapazität.
- Genau **50 kWh/Jahr** löst die Grenze **nicht** aus (`<`, nicht `≤`).
- Jahreswerte aus dem Ledger (Flüsse, Verluste, diagnostische SoC-Werte) sind **arithmetische Mittel** der N Jahresergebnisse.
- Autarkiegrad und Eigenverbrauchsquote sind Quotienten der gemittelten Energiewerte — **nicht** Mittelwerte von jährlichen Prozentwerten.

### Anfangs-SoC

Implementiertes Verhalten (Modellversion 1.0.0):

- Ohne Notstromreserve startet jeder Jahreslauf mit **0 kWh** (`soc = 0`).
- Der Anfangs-SoC ist **nicht** 50 %, nicht voll und nicht vom vorherigen Wetterjahr geerbt.
- Mit Notstromreserve \(R\) gilt
  `minSoc = clamp(R / C, 0, maxSoc)`, dann
  `initialSocKwh = minSoc × C` (nutzbare Kapazität) und `initialSoc = minSoc`.
  `socStartKwh` / `socStartPct` melden diesen Anfangswert.
  Weil `minSoc` bereits auf `[0, maxSoc]` begrenzt ist, kann der Start-SoC weder negativ
  noch oberhalb des modellierten Maximums liegen.
- Die Reserve ist vor aktiver Haushalts- und Auxiliary-Entladung geschützt
  (`soc > minSoc` sowie Entladekopfraum nur oberhalb der Reserve).
- Selbstentladung ist ein physikalischer Verlust und wird **nicht** durch eine aufwärts gerichtete
  `minSoc`-Klemme nachgefüllt; SoC darf nach Selbstentladung leicht unter die Reserve fallen.
- Spätere PV-Ladung kann den SoC wieder über die Reserve anheben.
- Es gibt **keine** modellierte Netzladung zur Reservennachfüllung und **keine**
  unverbuchte Ladungsbuchung.
- Numerische Sicherheitsgrenzen bleiben `[0, maxSoc]`.

> **Behoben in Modellversion 1.0.0.**
> Die frühere Backup-Reserve-SoC-Klemme (`soc = max(soc, minSoc)` nach Selbstentladung und
> am Intervallende) erzeugte unverbuchte Energie und erhöhte `energyBalanceErrorKwh`.
> Mit korrekter Initialisierung und ohne Aufwärtsklemme schließt die Energiebilanz
> innerhalb der numerischen Toleranz.

### End-SoC

- `socEndKwh` und `socEndPct` werden pro Jahreslauf aufgezeichnet.
- Mehrjahresmittel dieser Diagnostikwerte sind verfügbar (`averageSocEndKwh`, `averageSocEndPct`).
- Der End-SoC muss dem Anfangs-SoC **nicht** entsprechen.
- Es gibt **keine** Korrektur der Form `final SoC − initial SoC` auf Eigenverbrauch, Netzflüsse, geladene/entladene Energie, Verluste oder die Speichergrenze.
- Verbleibende Dezember-Energie ist daher eine **Jahresgrenzen-Vereinfachung**.

### Konservative obere Schranke (nur Wandlungsverluste)

Nur die Entlade-Wandlungsstufen (ohne Selbstentladung, ohne Standby):

```
η_discharge = 0.99 × 0.98 = 0.9702
```

Theoretischer oberer Randeffekt der offenen Jahresgrenze:

```
maximaler EV-Randeffekt ≲
(C − Notstromreserve) × 0.9702
```

Beispiele **nur als theoretische Obergrenzen** (nicht als gemessene Fehler eines konkreten Ergebnisses):

| Nutzbare Kapazität C (ohne Reserve) | Obergrenze ≲ C × 0.9702 |
|---:|---:|
| 5 kWh | ca. 4,85 kWh/Jahr |
| 10 kWh | ca. 9,70 kWh/Jahr |
| 30 kWh | ca. 29,11 kWh/Jahr |

Diese Werte sind **theoretische Obergrenzen**, keine gemessenen Fehler eines bestimmten Simulationsergebnisses.

---

## Physical Kernel (Phase 3)

Phase 3 ändert **keine** physikalischen Formeln. Sie führt ein internes, serialisierbares Ergebnisobjekt ein, das SpeicherGrenze, SpeicherWirtschaft, PDF, künftigen Nutzer-/Firmenkabinetten und späteren Analysen (Zyklen, Degradation, dynamische Tarife) als gemeinsame Grundlage dient.

### Pipeline

```
Calculation Input
  → PhysicalKernelResult          (intern, serverseitig)
    → SpeicherGrenzPayload        (kompakte Mittelwerte → UI)
      → künftige Persistenz in einer Datenbank
```

`PhysicalKernelResult` hängt nicht von React, Server Actions oder UI ab. Es ist ein reines JSON-serialisierbares Objekt in `packages/pv-core`. Es wird **nicht** automatisch an den Browser gesendet.

Der kostenlose SpeicherGrenze-Pfad ruft das Kernel mit `includeHourly: false` auf und kopiert anschließend nur die Mittelwert-Felder in `SpeicherGrenzPayload`.

### Struktur

```
PhysicalKernelResult
  meta
    modelVersion              (= BATTERY_MODEL_VERSION, derzeit 1.1.0)
    kernelSchemaVersion       (Form des Ergebnisobjekts, derzeit 1.1.0)
    timeStepHours             (Produktion: 0.25)
    timeStepMinutes           (Produktion: 15)
    stepsPerYear              (Produktion: 35040)
    weatherDatabase           (Produktion: PVGIS-SARAH2)
    weatherPeriod             ({ startYear, endYear }, Produktion 2006–2020)
    createdAt                 (ISO-8601)
    includeHourly
    hourlyBatterySizes
  batterySizes
  years[]                     (ein Eintrag je Wetterjahr)
    year
    pvYieldKwh
    loadKwh
    selfConsumptionWithoutStorageKwh
    hourlyPvKwh?              (nur bei includeHourly; einmal pro Jahr)
    hourlyLoadKwh?            (nur bei includeHourly; einmal pro Jahr)
    batteries[]               (ein Eintrag je Speicherkapazität)
      Eigenverbrauch, Netzbezug, Einspeisung,
      geladen/entladen (AC und SoC-Durchsatz),
      Verluste, SoC-Start/Ende, Autarkie/Eigenverbrauchsquote (Jahresdiagnostik),
      hourly?                 (nur bei includeHourly für diese Größe)
  yearly                      (kompakter Index Jahr → Größe → Eigenverbrauch)
  average*                    (arithmetische Mittel über die Wetterjahre; identisch zu Phase 2)
```

Jahresergebnisse werden **nicht** verworfen. Für jedes Wetterjahr 2006–2020 und jede simulierte Kapazität bleibt der vollständige physikalische Jahresledger erhalten.

Mittelwerte werden weiterhin als arithmetisches Mittel der Jahresergebnisse gebildet. Die Speichergrenze wird auf der **mittleren Eigenverbrauchskurve** bestimmt — nicht als Mittel von 15 einzelnen Speichergrenzen. Jährliche Autarkie- und Eigenverbrauchsquote-Felder sind Diagnostik; die UI-Kennzahlen bleiben Quotienten der Mehrjahresmittel.

### Optionale Stundenreihen

`calculateBatterySimulation` berechnet intern je Simulationsschritt SoC, Ladung, Entladung, Netzbezug und Einspeisung. Die letzten vier Reihen sind **optional** rückgabefähig:

| Reihe | Inhalt | Immer berechnet | Im Kernel behalten |
|---|---|---|---|
| `socHourly` / `hourly.soc` | SoC-Anteil nach der Stunde | ja (bestehende API) | nur bei `includeHourly` |
| `hourly.batteryChargeKwh` | AC-Überschuss in den Ladepfad | nur bei `includeHourly` | nur bei `includeHourly` |
| `hourly.batteryDischargeKwh` | AC-Abgabe Haushalt+Aux | nur bei `includeHourly` | nur bei `includeHourly` |
| `hourly.gridImportKwh` | Netzbezug Haushalt+Aux | nur bei `includeHourly` | nur bei `includeHourly` |
| `hourly.gridExportKwh` | nicht gespeicherter PV-Überschuss | nur bei `includeHourly` | nur bei `includeHourly` |

PV- und Lastprofile sind für alle Kapazitäten eines Wetterjahres identisch. Wenn sie gespeichert werden, liegen sie **einmal pro Wetterjahr** in `years[].hourlyPvKwh` / `hourlyLoadKwh`, nicht 26-fach.

Produktion (SpeicherGrenze): `includeHourly = false`.

Für spätere Analysen: `includeHourly = true` und optional `hourlyBatterySizes` (z. B. nur die technische Speichergrenze), damit nicht 15 × 26 × 35040 Schritte gehalten werden.

### Speicherbedarf (Groabschätzung, Float64)

Eine 15-min-Reihe: 35040 × 8 Byte ≈ 280 kB.

| Variante | Größenordnung |
|---|---|
| PV + Last, 15 Jahre, einmal pro Jahr | ≈ 2 MB |
| 5 Batterie-Reihen × 15 Jahre × 26 Größen | ≈ 134 MB |
| 5 Batterie-Reihen × 15 Jahre × 1 gewählte Größe | ≈ 5 MB |
| plus PV+Last, eine Größe | ≈ 7 MB |

Deshalb ist `hourlyBatterySizes` vorgesehen. Es wird **keine** Float32-Kompression und kein Streaming in Phase 3 eingeführt.

### Vorbereitung Zyklen (nicht implementiert)

Rainflow, Teiltiefenanalyse und Degradation sind **nicht** implementiert.

Vorbereitete Daten:

- Jahres-SoC-Durchsatz: `batteryChargedStoredKwh`, `batteryDischargedFromSocKwh`
- bestehendes Modellmaß: `equivalentFullCyclesAc = totalDischargedKwh / C` (AC-Abgabe / nutzbare Kapazität) — unverändert
- optionale Stunden-SoC-Trajektorie für späteres Rainflow

**Nenner für künftige Equivalent Full Cycles:** In diesem Batteriemodell ist der zellnähere Durchsatz `batteryDischargedFromSocKwh / usableCapacityKwh`. Die aktuelle `cyclesPerYear`-Definition nutzt die **AC-Abgabe** nach η_dis und unterschätzt deshalb den Pack-Durchsatz (`fromSoc = AC / η_dis`). Phase 3 ändert diese Definition **nicht**.

### Vorbereitung dynamische Tarife (nicht implementiert)

Mit `includeHourly = true` stehen je Stunde Netzbezug, Einspeisung, Batterieladung, Batterieentladung und SoC zur Verfügung. Das reicht für einen späteren wirtschaftlichen Stundenmotor. Dynamische Tarife selbst sind nicht implementiert.

### Vorbereitung Speicherung von Berechnungen

Registrierung und Datenbank sind nicht Teil von Phase 3. `PhysicalKernelResult` ist so geschnitten, dass Input → Kernel → Compact-Payload → DB später ohne Umbau der Physikschicht möglich ist. `meta.modelVersion` und `meta.kernelSchemaVersion` sollen in einem Jahr erkennen lassen, mit welcher Modell- und Ergebnisform ein Lauf erzeugt wurde.

---

## Batterieparameter des Produktionsmodells

| Parameter | Produktionswert | Einheit | Bedeutung |
|---|---:|---|---|
| Zeitauflösung | 0,25 | Stunde | 35040 Intervalle pro modelliertem Jahr |
| Nutzbare Kapazität | 5–30 | kWh | Simulierter Bereich, Schrittweite 1 kWh |
| Nominale Rohkapazität | nicht modelliert | – | Eingabe ist die nutzbare Kapazität |
| Depth of Discharge | 1.0 | Anteil | 100 % der angegebenen nutzbaren Kapazität |
| PV → Speicher Wirkungsgrad | 0.98 | – | Erste Stufe des Ladepfads |
| Zellwirkungsgrad Laden | 0.99 | – | Chemische Ladeeffizienz |
| Zellwirkungsgrad Entladen | 0.99 | – | Chemische Entladeeffizienz |
| Speicher → AC Wirkungsgrad | 0.98 | – | Ausgangspfad zum AC-Bus |
| Kombinierter Ladewirkungsgrad | 0.9702 | – | 0.98 × 0.99 |
| Kombinierter Entladewirkungsgrad | 0.9702 | – | 0.99 × 0.98 |
| Nomineller Roundtrip-Wirkungsgrad | 0.94128804 | – | Produkt aller vier Wandlungsstufen |
| Selbstentladung | 0.01 | pro Monat | 1 % pro Monat, abhängig vom aktuellen SoC |
| Systemverbrauch Standby | 15 | W | Konstant in jedem Simulationsschritt |
| Standby-Jahresenergie | 131.4 | kWh/a | 15 W × 8760 h (unabhängig vom Zeitschritt) |
| Efficiency model | `hybrid` | – | Getrennte Lade- und Entladestufen |
| Anfangs-SoC ohne Reserve | 0 | kWh | Kaltstart jedes Wetterjahres |
| Anfangs-SoC mit Reserve \(R\) | \(\mathrm{minSoc} \times C\) | kWh | `minSoc = clamp(R/C, 0, maxSoc)`; geschützte Startenergie |
| Standard-Notstromreserve | 0 | kWh | Optional über das Formular veränderbar |
| Modellversion | `1.1.0` | – | `BATTERY_MODEL_VERSION` in `packages/pv-core/src/battery.ts` |

### Roundtrip-Produkt (nur Wandlung)

```
η_roundtrip =
0.98 × 0.99 × 0.99 × 0.98
= 0.94128804
= 94.128804 %
```

Klarstellungen:

- Dieses Roundtrip-Produkt enthält **nur** die vier Wandlungsstufen.
- Selbstentladung ist **nicht** Bestandteil dieses Produkts.
- Standby-/Systemverbrauch ist **nicht** Bestandteil dieses Produkts.
- Das Legacy-Feld `roundtripEfficiency = 0.94` wird von der Hybrid-Berechnung **nicht** verwendet.
- Die Produktion nutzt die vier expliziten Hybrid-Wirkungsgradstufen (`efficiencyModel: "hybrid"`).

### Selbstentladung (stündlich)

```
retention_per_hour =
(1 − 0.01)^(1 / 730)
```

Das Modell verwendet den Monatsmittelwert:

```
730 Stunden/Monat = 8760 / 12
```

(entspricht `(365 × 24) / 12` im Code). Die Selbstentladung wird auf die **aktuell gespeicherte** Energie angewendet (`soc *= retentionPerHour` vor Ladung/Entladung der Stunde).

---

## Lade- und Entladeleistungsgrenzen

| Nutzbare Speicherkapazität | Maximale Ladeleistung | Maximale Entladeleistung |
|---|---:|---:|
| ≤ 5 kWh | 2.5 kW | 2.5 kW |
| > 5 und < 10 kWh | 3.5 kW | 3.5 kW |
| 10–15 kWh | 5.0 kW | 5.0 kW |
| > 15 kWh | 6.0 kW | 6.0 kW |

Im Produktions-Sweep bedeutet das:

- 5 kWh → 2.5 kW
- 6–9 kWh → 3.5 kW
- 10–15 kWh → 5.0 kW
- 16–30 kWh → 6.0 kW

Weitere Regeln:

- Lade- und Entladegrenze sind **identisch**.
- Die Notstromreserve ändert die Leistungsgrenze **nicht**.
- Bei Δt = 1 h begrenzt eine kW-Leistungsgrenze numerisch die in einem Intervall übertragene kWh-Menge.
- Die Ladegrenze wird **vor** den Ladewirkungsgraden auf die vorgesehene PV-Überschuss-Energie angewendet.
- Die Entladegrenze wird auf die **nach** Entladewirkungsgraden gelieferte AC-Energie angewendet.
- Unter der gemeinsamen Entladegrenze hat der Haushaltsbedarf Vorrang vor dem Auxiliary-Systembedarf.

---

## Produktions-Konfigurationspfad

Aufrufkette der Produktion:

```
calculateSpeicherResult
  → simulateMultiYearSpeicherGrenz   (PVGIS-I/O)
    → runPhysicalKernel             (packages/pv-core)
      → calculateBatterySimulation
  → toSpeicherGrenzPayload          (kompakte Mittelwerte, ohne years/hourly)
```

Implementierungsdetails:

- Die Produktion übergibt **keine** benutzerdefinierte Batteriespezifikation.
- Daher wird `DEFAULT_BATTERY_SPEC` verwendet.
- `backupReserveKwh` ist die einzige batterierelevante Produktions-Überschreibung.
- Die Produktion setzt `includeHourly: false`.
- Wärmepumpe, optionale EV-Heimladung und mehrere Dachflächen ändern Last-/PV-Profile, **nicht** Batteriewirkungsgrade oder Leistungsparameter.
- Die Wirkungsgrade sind für jede simulierte Kapazität **identisch**.
- Mit der Kapazität variieren nur Leistungsgrenzen und der relative Reserveanteil
  (`minSoc = clamp(reserveKwh / usableCapacityKwh, 0, maxSoc)`).

### Quellcode-Referenzen

- `packages/pv-core/src/battery.ts`
- `packages/pv-core/src/batteryPowerLimit.ts`
- `packages/pv-core/src/physicalKernel.ts`
- `apps/speicher-physik/src/lib/multiYearSimulation.ts`
- `apps/speicher-physik/src/lib/calculateSpeicherResult.ts`
- `apps/speicher-physik/src/lib/speicherChartData.ts`
- `apps/speicher-physik/src/lib/speicherRecommendation.ts`
- `apps/speicher-physik/src/lib/deriveSpeicherBusinessMetrics.ts`

---

## Modellierter und nicht modellierter Umfang

### Im Modell berücksichtigt

- stündliche AC-Bus-Bilanz
- direkter PV→Haushalt-Verbrauch
- separater Auxiliary-Systembedarf
- vierstufige Batterie-Wandlungsverluste
- Selbstentladung
- konstanter Systemverbrauch 15 W
- größenabhängige Lade-/Entladegrenzen
- optionale statische Notstromreserve
- Netzbezug- und Netzeinspeisungs-Ledger
- mehrere PV-Dachflächen
- optionale Wärmepumpenlast
- optionale EV-Heimladelast (generiertes zustandsbehaftetes Profil; siehe Abschnitt 2.4)
- Wetterjahre 2006–2020
- einheitliche Jahresskalierung der Template-Lastprofile (BDEW, WPuQ-Robustheit, ThermBuild); EV v1 ist die generierte Ausnahme

### Nicht im Modell berücksichtigt

- Netzladung der Batterie
- dynamische Stromtarife (Stundenreihen vorbereitet, Tariflogik nicht implementiert)
- Batterie-Zyklenanalyse / Rainflow / Degradation (Daten vorbereitet, nicht implementiert)
- gleichzeitiges Laden und Entladen
- herstellerspezifische Wirkungsgradkennlinien
- temperaturabhängige Wirkungsgrade oder Kapazität
- Degradation innerhalb des simulierten Jahres
- Mindestleistung des Wechselrichters
- Standby-Ein-/Ausschaltzustände
- Einspeisebegrenzung
- EEG-Abrechnungsregeln
- exaktes physikalisches Stromzählerverhalten
- vollständiges Insel-/Notstrom-Umschaltverhalten
- zyklische jährliche SoC-Konvergenz
- SoC-Übertrag von Jahr zu Jahr
- geräte-, wetter- oder occupancy-abhängige Umformung gemessener Lastprofil-Templates (BDEW, WPuQ, ThermBuild: nur uniforme Jahresskalierung; siehe [Load Profile Scaling Principle](#load-profile-scaling-principle)). EV v1 ist davon ausgenommen und wird als generiertes zustandsbehaftetes Profil aus expliziten Nutzereingaben erzeugt (Abschnitt 2.4).

---

## Modellversion und Reproduzierbarkeit

Aktueller Stand:

- Kanonische Konstante: `BATTERY_MODEL_VERSION = "1.1.0"` in
  `packages/pv-core/src/battery.ts` (einzige Produktions-Literalquelle).
- Die Version wird mit Simulationsergebnissen zurückgegeben:
  - `BatterySimulationResult.batteryModelVersion`
  - `PhysicalKernelResult.batteryModelVersion` / `PhysicalKernelResult.meta.modelVersion`
  - `PhysicalKernelResult.meta.kernelSchemaVersion` (Form des Kernel-Objekts)
  - `SpeicherGrenzPayload.batteryModelVersion`
  - `VerifiedResult.batteryModelVersion` / `CalculateSpeicherResultOutput.verifiedResult.batteryModelVersion`
- Mehrjahressimulation prüft, dass alle Einzelresultate dieselbe Version tragen.
- Die öffentliche Methodikseite (`docs/physics-model.md` / `/technische-details`)
  exponiert **nicht** die vollständige Parametertabelle und nicht zwingend die Modellversion.

Version-Bump ist erforderlich bei Änderungen an:

- Wirkungsgrad-Defaults
- Leistungsgrenzen-Kurve
- Fluss-Prioritäten
- Behandlung von Anfangs-/End-SoC
- Behandlung der Jahresgrenze
- Selbstentladungs-Methode
- Verlustbilanz-Definitionen
- Degradations- oder Temperaturmodell

Reine Dokumentations-Formulierungsänderungen erfordern **keinen** Modellversions-Bump.

---

## Bekannte Punkte nach Modellversion 1.0.0

1. Das Legacy-Feld `roundtripEfficiency = 0.94` wird vom Hybrid-Modell nicht genutzt und kann mit dem exakten Produkt 0.94128804 verwechselt werden.
2. Jahresläufe starten kalt und schließen die jährliche SoC-Grenze nicht:
   - kein Warm-up;
   - keine zyklische Konvergenz;
   - kein Jahr-zu-Jahr-SoC-Übertrag;
   - keine Korrektur der Form `final SoC − initial SoC`.
3. Berechnungsergebnisse werden serverseitig nur im In-Memory-`verifiedResultStore` gehalten
   (kein dauerhaftes Persistieren der Modellversion in einer Datenbank).
   `PhysicalKernelResult` ist auf spätere Persistenz vorbereitet, speichert aber in Phase 3 nichts.
4. Dedizierte Regressionstests decken nun ab:
   - eingefrorene `DEFAULT_BATTERY_SPEC`
   - exaktes Roundtrip-Produkt
   - energieerhaltende Backup-Reserve-Initialisierung
   - vollständige Leistungs-Tabelle 5–30 kWh
   - `BATTERY_MODEL_VERSION` in Einzel- und Mehrjahresresultaten
   - Beibehaltung der Jahresledger im Physical Kernel
   - optionale Stundenreihen (`includeHourly` / `hourlyBatterySizes`)
   - kompaktes `SpeicherGrenzPayload` ohne Kernel-Jahre/Stundenreihen
