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
| Öffentliche, vereinfachte Methodik | `docs/physics-model.md` (gerendert unter `/technische-details`) |
| Offizielle Quellen (SSOT) | `packages/pv-methodology` → `/methodik-quellen` |

- Implementiertes Verhalten ist letztlich durch den referenzierten Produktions-Quellcode definiert.
- Abweichungen zwischen Code und Dokumentation sind als Defekte zu behandeln und zu auditieren.

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
- Wärmepumpe: Luft/Wasser über gemessene 15-Minuten-Referenzprofile (ThermBuild), gleichmäßig auf die eingegebene Jahres-kWh skaliert. Wasser/Wasser ist nicht in der Produktion.
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

👉 Wichtig:

Dieses Profil ist ein statistisches Durchschnittsprofil und kein individuelles Messprofil.

Das bedeutet:

- Tages- und Jahresverlauf sind realistisch modelliert

- Individuelle Abweichungen (z. B. Home Office, Wärmepumpe, E-Auto) sind möglich

👉 Die Abweichung der Simulation hängt stark davon ab,

wie gut das Standardlastprofil dem tatsächlichen Verbrauchsverhalten entspricht.

---

### 2.3 Wärmepumpe

Falls eine Luft/Wasser-Wärmepumpe aktiviert ist, wird der zusätzliche Stromverbrauch separat modelliert und dem Haushaltsverbrauch hinzugefügt.

Annahmen:

Der eingegebene Jahresstromverbrauch der Wärmepumpe wird als zusätzliche Lastreihe in 15-Minuten-Schritten modelliert. Für Luft/Wasser verwendet die Produktion gemessene elektrische Referenzprofile aus der ThermBuild-Messkampagne. Das Profil wird gleichmäßig auf den angegebenen Jahresstromverbrauch skaliert. Es handelt sich nicht um den Lastgang der Wärmepumpe des Nutzers.

Wasser/Wasser-Wärmepumpen sind in der aktuellen Berechnung nicht enthalten.

👉 Wichtig:

Die Wärmepumpe verändert das Lastprofil deutlich, insbesondere durch:

höheren Verbrauch in Zeiten geringer PV-Erzeugung

Dadurch steigt der Bedarf an gespeicherter Energie.

👉 Einschränkungen:

Kein dynamisches Temperaturmodell

Keine Abbildung von realen Steuerstrategien

Das Referenzprofil bildet nicht die individuelle Wärmepumpe des Nutzers ab.

Offizielle Quelle und öffentliche Formulierung: Methodik & Quellen (`thermbuild-fordatis-486`).

---

### Mehrjährige Mittelung

PV-Ertrag, Eigenverbrauch ohne Speicher und die Batteriesimulationen für Speichergrößen von 5 bis 30 kWh werden für dieselben Wetterjahre 2006 bis 2020 berechnet. Die ausgewiesenen Jahresenergiewerte sind arithmetische Mittelwerte dieser fünfzehn Jahre.

Autarkiegrad und Eigenverbrauchsquote sind Quotienten aus diesen Mittelwerten der Energiegrößen — **nicht** Mittelwerte von jährlichen Prozentwerten.

Ist eine Wärmepumpe aktiviert, ist ihr Verbrauch Bestandteil der modellierten Haushaltslast.

Alle physikalischen Kennzahlen beziehen sich auf die **technische Speichergrenze**. Die planerische Anfangskapazität (75 %-Restkapazitäts-Anpassung) dient nur der Kaufempfehlung und wird **nicht** zur Berechnung der physikalischen Kennzahlen verwendet.

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

PV-Energie, die im selben Stundenintervall unmittelbar den Haushaltsverbrauch einschließlich einer optionalen Wärmepumpe deckt.

`EV₀ = Σ min(PV, Last)`

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

Netzenergie zur Deckung des verbleibenden Haushaltsverbrauchs einschließlich einer optionalen Wärmepumpe.

`Netzbezug Haushalt = modellierter Haushaltsverbrauch − Eigenverbrauch mit Speicher`

Netzenergie für den Systemverbrauch des Speichersystems ist **nicht** enthalten.

### Modellierte Netzeinspeisung

Im Modell verbleibender PV-Überschuss nach direktem Haushaltsverbrauch, Systemverbrauch und Batterieladung.

Der Wert stammt aus dem expliziten Netzeinspeisungs-Ledger der Simulation (Mehrjahresmittel an der technischen Speichergrenze). Es handelt sich **nicht** um eine EEG-Abrechnungsgröße und **nicht** um eine exakte Vorhersage des physikalischen Stromzählers. Eine Rekonstruktion als „PV-Jahresertrag − Eigenverbrauch“ wird nicht verwendet.

### Autarkiegrad

`Autarkiegrad = Eigenverbrauch / modellierter Haushaltsverbrauch × 100 %`

- Der Haushaltsverbrauch enthält eine optionale Wärmepumpe.
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
- Wärmepumpe und mehrere Dachflächen ändern Last-/PV-Profile, **nicht** Batteriewirkungsgrade oder Leistungsparameter.
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
- Wetterjahre 2006–2020

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
