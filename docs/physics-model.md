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

## 3. Simulationslogik

Für jede Stunde gilt:

1. PV deckt zuerst die Last  

2. Überschuss → Batterie  

3. Defizit → Batterie entlädt  

---

## 4. Batteriemodell

Berücksichtigte Effekte:

- Wirkungsgrad (Roundtrip ~94%)

- Depth of Discharge (~90%)

- Leistungsbegrenzung (0.5C Regel)

Beispiel:  

10 kWh Batterie → max. 5 kW Lade-/Entladeleistung

👉 Das Modell bildet das reale Verhalten eines Heimspeichers vereinfacht, aber praxisnah ab.

---

### Details zur Simulation

Die Batteriesimulation basiert auf folgenden Annahmen:

- Ladung und Entladung erfolgen stündlich (8760 Stunden pro Jahr)

- Begrenzte Lade- und Entladeleistung (0.5C Regel)

- Wirkungsgrad wird berücksichtigt

- Nutzbare Kapazität ist durch Depth of Discharge begrenzt

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

Nicht berücksichtigt:

- Temperatur

- Alterung (Degradation)

- Wechselrichterverluste

- Netzbeschränkungen

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

👉 Es werden keine Marketing-Annahmen oder "geschönten Werte" verwendet.