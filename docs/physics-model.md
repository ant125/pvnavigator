# PVNavigator – Technische Berechnungsgrundlagen

## 1. Überblick

Diese Berechnung basiert auf einem physikalischen Simulationsmodell
für Photovoltaik-Erzeugung und Batteriespeicher.

Die Simulation erfolgt stündlich (8760 Stunden pro Jahr).

---

## 2. Eingangsdaten

### PV-Erzeugung

- Quelle: PVGIS
- Zeitauflösung: stündlich
- Mehrjährige Referenz (z. B. 2016–2020)

### Lastprofil

- Quelle: BDEW H0 Standardprofil
- Normiert auf jährlichen Verbrauch

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

Diese Berechnung ist eine Erstabschätzung:

Abweichung: ±5–10%

---

## 8. Ziel

Abschätzung der optimalen Speichergröße.

Für detaillierte Wirtschaftlichkeitsanalysen siehe Premium-Version.
