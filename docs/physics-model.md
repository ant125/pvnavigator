# Technische Details der Berechnung

Diese Seite beschreibt die technischen Grundlagen der Berechnung.

---

## 1. Überblick

Diese Berechnung basiert auf einem physikalischen Simulationsmodell

für Photovoltaik-Erzeugung und Batteriespeicher.

### Zeitauflösung und Kalender

Die Simulation erfolgt in 15-Minuten-Schritten. Jedes modellierte Jahr besteht aus genau 35.040 Intervallen mit einer Dauer von jeweils 15 Minuten (Δt = 0,25 h).

PVGIS liefert stündliche Erzeugungswerte; diese werden energieerhaltend auf 15-Minuten-Schritte verteilt. Es wird keine 15-Minuten-PVGIS-API verwendet.

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

Nach der zeitlichen Ausrichtung auf das gemeinsame Raster mit 8760 Stunden werden die Erzeugungsreihen aller Dachflächen stundenweise addiert. Anschließend wird die zusammengefasste Stundenenergie energieerhaltend auf 15-Minuten-Schritte verteilt. Erst diese Viertelstundenreihe wird mit dem Lastprofil und dem Batteriespeicher simuliert.

Der gesamte PV-Jahresertrag und die installierte Gesamtleistung ergeben sich aus allen Dachflächen. Der spezifische Ertrag wird als gesamter PV-Jahresertrag geteilt durch die Summe der installierten kWp berechnet.

Weitere Annahmen:

- Die PVGIS-Systemverluste von 14 % werden für jede Dachfläche angewendet.
- Lokale Verschattung wird derzeit nicht modelliert.
- Alle Dachflächen verwenden die Wetterjahre 2006–2020.

Es wird **keine** mittlere Dachneigung und **kein** mittlerer Azimut über die Flächen gebildet. Jede Fläche behält ihre eigenen Eingaben für Neigung und Ausrichtung.

---

### 2.2 Lastprofil (Stromverbrauch)

- Quelle: BDEW Standardlastprofil H0

- Entwickelt vom Bundesverband der Energie- und Wasserwirtschaft (Deutschland)

- Repräsentiert ein typisches Haushaltsverbrauchsverhalten

### BDEW-Lastprofil H0

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

Der eingegebene Jahresstromverbrauch der Wärmepumpe wird als zusätzliche Lastreihe in 15-Minuten-Schritten modelliert. Für Luft/Wasser verwendet die Simulation ein gemessenes elektrisches Referenzprofil. Das Profil wird gleichmäßig auf den angegebenen Jahresstromverbrauch skaliert. Es handelt sich nicht um den Lastgang der Wärmepumpe des Nutzers.

Wasser/Wasser-Wärmepumpen sind in der aktuellen Berechnung nicht enthalten.

👉 Wichtig:

Die Wärmepumpe verändert das Lastprofil deutlich, insbesondere durch:

höheren Verbrauch in Zeiten geringer PV-Erzeugung

Dadurch steigt der Bedarf an gespeicherter Energie.

👉 Einschränkungen:

Kein dynamisches Temperaturmodell

Keine Abbildung von realen Steuerstrategien

Das Referenzprofil bildet nicht die individuelle Wärmepumpe des Nutzers ab.

Die methodische Dokumentation und die offizielle Quelle stehen unter Methodik & Quellen.

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

Bei 2 kWh Notstromreserve bleibt diese Energiemenge jederzeit im Speicher erhalten

und steht im Alltag nicht zur Verfügung.

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

👉 Die Notstromreserve wird als statischer Mindestladestand modelliert.

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

Konstanter modellierter Eigenbedarf des Speichersystems von 15 W. Dies entspricht rund 131 kWh pro Jahr (15 W durchgängig). Der Bedarf kann durch PV, Batterie oder Netz gedeckt werden.

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
   wird daraus abgeleitet:

   `Planerische Anfangskapazität = ⌈ technische Speichergrenze ÷ 0,75 ⌉`

   Dabei bedeutet 0,75 eine Planungsannahme von **75 % verbleibender nutzbarer
   Kapazität** (gleichbedeutend mit einer **25 %-Alterungsreserve**). Der
   Planungshorizont beträgt etwa **10 Jahre**. Das ist eine allgemeine
   Planungsannahme, **keine** Prognose der tatsächlichen Batteriedegradation,
   **kein** Ergebnis der 15-Minuten- oder mehrjährigen physikalischen Simulation
   und **keine** Garantie für ein bestimmtes Speichersystem. Alle technischen
   Kennzahlen werden weiterhin mit der technischen Speichergrenze berechnet.

3. **Wirtschaftlich optimale Speichergröße**  
   Wird in SpeicherGrenze **nicht** berechnet. Dafür wären unter anderem
   Anschaffungskosten, Strompreis, Einspeisevergütung und mögliche Förderungen
   erforderlich.

**Beispiel:** Technische Speichergrenze 9 kWh → planerische Anfangskapazität
12 kWh, weil ⌈ 9 ÷ 0,75 ⌉ = 12.

Das entspricht etwa **33 % mehr Anfangskapazität** gegenüber der technischen
Speichergrenze — **nicht** einfach „Speichergrenze + 25 %“.

👉 **Wichtig:** Die 75-%-Anpassung liegt außerhalb der Jahres- und
Mehrjahressimulation. Die tatsächliche Alterung hängt unter anderem von
Hersteller, Batteriechemie, Temperatur, Betriebsstrategie, Zyklenzahl,
Entladetiefe und Garantiebedingungen ab.

#### Herstellerkontext (Beispiele, keine Empfehlung)

Herstellergarantien zeigen, dass eine verbleibende Speicherkapazität häufig über
einen bestimmten Zeitraum, eine Zyklenzahl oder einen Energiedurchsatz definiert
wird. Die konkreten Bedingungen unterscheiden sich jedoch je nach Produkt.
Beispiele (sonnenBatterie 10 performance, Enphase IQ Battery 5P-Garantie,
Tesla Powerwall 2 European Warranty) sowie weitere Herstellerseiten
(Huawei LUNA, BYD Battery-Box, Tesla Powerwall) sind ausschließlich im zentralen
Register **Methodik & Quellen** (`@pv-methodology/registry`) hinterlegt und unter
`/methodik-quellen` öffentlich einsehbar.

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
