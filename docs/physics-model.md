# Technische Details der Berechnung

Diese Seite beschreibt die technischen Grundlagen der Berechnung.

---

## 1. Überblick

Diese Berechnung basiert auf einem physikalischen Simulationsmodell

für Photovoltaik-Erzeugung und Batteriespeicher.

Die Simulation erfolgt stündlich (8760 Stunden pro Jahr).

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

- Zeitauflösung: stündlich (8760 Werte pro Jahr)

- Mehrjährige Simulation (z. B. 2016–2020)

👉 Die Berechnung erfolgt physikalisch basierend auf realen Klimadaten,

nicht auf vereinfachten Durchschnittswerten.

👉 Wichtige Einschränkungen:

- Wetterdaten sind historisch und nicht prognostisch

- Lokale Verschattung (z. B. Bäume, Gebäude) wird nicht berücksichtigt

- Individuelle Anlagenverluste können abweichen

👉 Die Ergebnisse stellen eine realistische Ertragsabschätzung dar,

aber keine exakte Vorhersage der tatsächlichen Produktion.

---

### 2.2 Lastprofil (Stromverbrauch)

- Quelle: BDEW Standardlastprofil H0

- Entwickelt vom Bundesverband der Energie- und Wasserwirtschaft (Deutschland)

- Repräsentiert ein typisches Haushaltsverbrauchsverhalten

👉 Wichtig:

Dieses Profil ist ein statistisches Durchschnittsprofil und kein individuelles Messprofil.

Das bedeutet:

- Tages- und Jahresverlauf sind realistisch modelliert

- Individuelle Abweichungen (z. B. Home Office, Wärmepumpe, E-Auto) sind möglich

👉 Die Genauigkeit der Simulation hängt stark davon ab,

wie gut das Standardlastprofil dem tatsächlichen Verbrauchsverhalten entspricht.

---

### 2.3 Wärmepumpe

Falls eine Wärmepumpe aktiviert ist, wird der zusätzliche Stromverbrauch

separat modelliert und dem Haushaltsverbrauch hinzugefügt.

Annahmen:

Der zusätzliche Verbrauch wird gleichmäßig über typische Heizperioden verteilt

Erhöhter Strombedarf tritt vor allem in den Wintermonaten auf

👉 Wichtig:

Die Wärmepumpe verändert das Lastprofil deutlich, insbesondere durch:

höheren Verbrauch in Zeiten geringer PV-Erzeugung

Dadurch steigt der Bedarf an gespeicherter Energie.

👉 Einschränkungen:

Kein dynamisches Temperaturmodell

Keine Abbildung von realen Steuerstrategien

Keine Unterscheidung zwischen verschiedenen Wärmepumpentypen

👉 Die Modellierung stellt eine vereinfachte, aber realistische Näherung dar.

---

## 3. Simulationslogik

Für jede Stunde wird ein AC-Bus-Modell verwendet:

- PV-Erzeugung deckt zuerst den Haushaltsverbrauch

- verbleibende PV-Erzeugung deckt den technischen Systemverbrauch des Speichersystems

- weiterer PV-Überschuss lädt die Batterie

- verbleibender Überschuss wird ins Netz eingespeist

- bei einem Defizit entlädt die Batterie zuerst zur Deckung des Haushaltsverbrauchs

- anschließend kann die Batterie den technischen Systemverbrauch decken

- verbleibender Bedarf wird aus dem Netz bezogen

Der technische Systemverbrauch wird separat erfasst. Er erhöht weder den ausgewiesenen Haushaltsverbrauch noch den Eigenverbrauch oder den Autarkiegrad.

---

## 4. Batteriemodell

Berücksichtigte Effekte:

- Modernes LiFePO4-Heimspeichersystem mit Hybridwechselrichter und DC-gekoppeltem Ladepfad (PV-Überschuss zuerst in den Speicher; Entladung über den Wechselrichter auf den AC-Haushaltsbus)

- modellierte Verlustpfade mit getrennter Bilanz: **PV → Speicher**, **Zellverluste beim Laden**, **Zellverluste beim Entladen**, **Speicher → AC-Bus** — der effektive Gesamt-Roundtrip liegt weiterhin in der Größenordnung von etwa 94 %, wird aber aus mehreren Einzelwirkungsgraden abgeleitet

- Depth of Discharge (~90%)

- Leistungsbegrenzung (0.5C Regel)

- Selbstentladung der Batterie

- technischer Systemverbrauch des Speichersystems (z. B. Elektronik, BMS, Betriebsbereitschaft)

- getrennte Bilanzierung von Haushaltsverbrauch und Systemverbrauch

Die Selbstentladung reduziert den Ladezustand der Batterie über die Zeit und wird als Batterieverlust berücksichtigt.

Der technische Systemverbrauch des Speichersystems (z. B. Elektronik, BMS, Kommunikation und Betriebsbereitschaft) wird separat bilanziert. Er kann durch PV, Batterie oder Netz gedeckt werden, erhöht aber nicht den ausgewiesenen Haushaltsverbrauch, Eigenverbrauch oder Autarkiegrad.

Beispiel:  

10 kWh Batterie → max. 5 kW Lade-/Entladeleistung

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

- Ladung und Entladung erfolgen stündlich (8760 Stunden pro Jahr)

- Begrenzte Lade- und Entladeleistung (0.5C Regel)

- Wirkungsgrad wird berücksichtigt

- Nutzbare Kapazität ist durch Depth of Discharge begrenzt

Der Eigenverbrauch und der Autarkiegrad beziehen sich auf den Haushaltsverbrauch. Der technische Systemverbrauch des Speichersystems wird separat bilanziert und erhöht diese Kennzahlen nicht künstlich.

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

**Eigenverbrauch:**

Energie, die direkt oder über Batterie zur Deckung der Last genutzt wird.

---

## 7. Genauigkeit

Diese Berechnung ist eine Erstabschätzung.

Typische Abweichung:

👉 ±5–10%

---

## 8. Ziel

Abschätzung der optimalen Speichergröße.

Für detaillierte Wirtschaftlichkeitsanalysen siehe Premium-Version.

---

## 9. Interpretation der Ergebnisse

Die berechneten Werte dienen zur Orientierung bei der Auswahl der Speichergröße.

Wichtige Hinweise:

- Ein höherer Eigenverbrauch bedeutet nicht automatisch eine bessere Wirtschaftlichkeit  

- Große Speicher erhöhen den Eigenverbrauch, sind aber oft wirtschaftlich nicht sinnvoll  

- Die optimale Speichergröße liegt meist in dem Bereich, in dem zusätzliche Kapazität nur noch geringe Mehrwerte bringt

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

Die optimale Speichergröße ergibt sich immer aus dem Zusammenspiel aller Faktoren.

Es gibt keine universell „richtige“ Speichergröße ohne Berücksichtigung des individuellen Systems.

---

## 10. Empfehlung

Die optimale Speichergröße ist individuell und hängt ab von:

- Ihrem Stromverbrauch  

- der Größe der PV-Anlage  

- Ihrem Lastprofil  

👉 In dieser Analyse erkennen Sie die optimale Größe daran,  

dass der zusätzliche Eigenverbrauch mit wachsender Speichergröße deutlich abnimmt.

Das bedeutet:

- Am Anfang bringt zusätzlicher Speicher viel Nutzen  

- Ab einem bestimmten Punkt steigt der Eigenverbrauch nur noch geringfügig  

👉 Dieser Punkt stellt die technisch sinnvolle Speichergrenze dar.

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

Die Genauigkeit der Gesamtsimulation ergibt sich aus dem Zusammenspiel mehrerer Modellkomponenten:

### PV-Erzeugung (PVGIS)

- Hohe Genauigkeit durch physikalische Modellierung auf Basis realer Klimadaten

- Typische Abweichung: gering

### Lastprofil (BDEW)

- Statistisches Standardprofil

- Individuelle Abweichungen möglich

- Größter Unsicherheitsfaktor im Modell

### Batteriesimulation

- Physikalisch basiertes Modell mit praxisnahen Annahmen

- Vereinfachungen bei Steuerung und realem Systemverhalten

---

👉 Gesamteinschätzung:

Die Simulation liefert eine realistische Erstabschätzung mit typischer Genauigkeit von:

**±5–10%**

---

👉 Wichtig:

Die tatsächliche Genauigkeit hängt stark davon ab,

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

👉 Die Berechnung basiert auf transparenten technischen Annahmen und nachvollziehbaren Modellen.