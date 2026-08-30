/**
 * Methodik chapters for the public documentation page and the future PDF appendix.
 *
 * Engineering copy only. Official URLs stay in the registry.
 * Do not put website chrome, navigation hints, or "click here" phrasing here.
 */

export const METHODOLOGY_PAGE_TITLE = "Methodik";

export const METHODOLOGY_PAGE_SUBTITLE =
  "Wie PVNavigator rechnet und auf welchen wissenschaftlichen Grundlagen die Berechnung basiert.";

export const METHODOLOGY_SECTION_TITLE = "Methodik";

export const QUELLEN_SECTION_TITLE = "Quellen";

export const QUELLEN_SECTION_INTRO =
  "Die folgenden Quellen sind die dokumentierte Grundlage der Berechnung. Offizielle Nachweise stammen ausschließlich aus diesem Verzeichnis.";

export type MethodologyTable = {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  /** When set, the first column is a row header. */
  rowHeaders?: boolean;
};

export type MethodologyCallout = {
  title: string;
  body: string;
};

export type MethodologyChapter = {
  id: string;
  number: number;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  tables?: readonly MethodologyTable[];
  callouts?: readonly MethodologyCallout[];
  notes?: readonly string[];
  /** Optional figure key rendered by the documentation page. */
  figure?: "simulation" | "pv-expansion" | "validation";
};

export const METHODOLOGY_CHAPTERS: readonly MethodologyChapter[] = [
  {
    id: "15-minuten-simulation",
    number: 1,
    title: "15-Minuten-Simulation",
    figure: "simulation",
    paragraphs: [
      "PVNavigator berechnet PV-Erzeugung, Haushaltsverbrauch und Batteriespeicher als physikalische Zeitschrittsimulation. Die Kennzahlen entstehen aus dieser Jahresreihe, nicht aus typischen Monatstagen oder gemittelten Lastgängen.",
      "Jedes modellierte Jahr besteht aus 35.040 Intervallen von je 15 Minuten. Die Rechnung verwendet 15 unabhängige Wetterjahre. Jedes Wetterjahr wird vollständig und getrennt simuliert. Es findet keine monatliche Mittelwertbildung statt.",
      "Die Batterie wird in jedem Viertelstundenintervall physikalisch bilanziert: Ladung, Entladung, Verluste und Ladezustand.",
      "Ein Stundenmodell mittelt Erzeugung und Verbrauch innerhalb der Stunde. Kurze Überschüsse und Defizite, die für die Batterie entscheidend sind, gehen dabei verloren. In 15-Minuten-Schritten bleibt sichtbar, wann der Speicher tatsächlich laden oder entladen kann. Das ergibt ein realistischeres Speichermodell als eine stündliche Rechnung.",
    ],
    tables: [
      {
        caption: "Simulationsraster",
        columns: ["Größe", "Wert"],
        rowHeaders: true,
        rows: [
          ["Zeitschritt", "15 Minuten (Δt = 0,25 h)"],
          ["Simulationsschritte je Jahr", "35.040"],
          ["Wetterjahre", "15, jeweils unabhängig"],
          ["Mittelung", "keine monatliche Mittelwertbildung"],
          ["Speicher", "physikalische Zeitschrittsimulation"],
        ],
      },
    ],
  },
  {
    id: "pv-erzeugung",
    number: 2,
    title: "PV-Erzeugung",
    figure: "pv-expansion",
    paragraphs: [
      "Die PV-Erzeugung stammt aus PVGIS der Europäischen Kommission (Joint Research Centre). Als Strahlungsdatenbank dient SARAH2.",
      "Die Berechnung berücksichtigt Standort und Dachgeometrie, also Neigung und Ausrichtung. Bei mehreren Dachflächen wird jede Fläche getrennt berechnet. Es wird kein künstlich geglätteter Erzeugungsverlauf verwendet.",
      "Die Simulation umfasst 15 historische Wetterjahre. Jedes Jahr bleibt ein eigenes Wetterjahr und wird nicht zu einem Klimamitteljahr vermischt.",
      "PVGIS liefert stündliche Energiewerte. Diese werden konservativ auf 15-Minuten-Simulationsschritte verteilt, sodass die Jahresenergie erhalten bleibt. Es wird keine 15-Minuten-PVGIS-Schnittstelle verwendet.",
    ],
    bullets: [
      "Datenquelle: PVGIS (EU Joint Research Centre)",
      "Strahlungsdatenbank: SARAH2",
      "Dachgeometrie: Neigung und Ausrichtung je Dachfläche",
      "15 Wetterjahre, jeweils unabhängig",
      "keine künstliche Glättung der Erzeugung",
    ],
  },
  {
    id: "haushaltsverbrauch",
    number: 3,
    title: "Haushaltsverbrauch",
    paragraphs: [
      "Für den zeitlichen Verlauf des Haushaltsverbrauchs verwendet PVNavigator das offizielle BDEW-Standardlastprofil H25.",
      "BDEW H25 ist das amtliche deutsche Standardlastprofil für Haushalte. Es beruht auf einer umfangreichen statistischen Auswertung realer Haushaltsmessungen. Es ist der akzeptierte technische Standard und wird in der professionellen Planungssoftware breit eingesetzt.",
      "Das Profil liegt in 15-Minuten-Auflösung vor und wird auf den angegebenen Jahresverbrauch skaliert. Einzelne Haushalte weichen von diesem Standardprofil naturgemäß ab.",
    ],
  },
  {
    id: "validierung",
    number: 4,
    title: "Validierung mit realen Smart-Meter-Daten",
    figure: "validation",
    paragraphs: [
      "Die Produktionsberechnung verwendet weiterhin das offizielle BDEW-Profil H25. BDEW wurde nicht ersetzt.",
      "Unabhängig davon wurde das technische Modell anhand des wissenschaftlichen Smart-Meter-Datensatzes WPuQ geprüft. Untersucht wurde, wie robust die Berechnung bleibt, wenn das offizielle BDEW-Profil durch gemessene Haushaltslastgänge ersetzt wird.",
      "Die Vergleichskennwerte gelten für ein festes Szenario: identische PV-Anlage, identisches Batteriemodell, identischer Jahresverbrauch. Variiert wurde ausschließlich die Form des Lastgangs.",
    ],
    tables: [
      {
        caption: "Validierungsaufbau",
        columns: ["Randbedingung", "Festlegung"],
        rowHeaders: true,
        rows: [
          ["Haushalte", "27 vollständige deutsche Einfamilienhäuser"],
          ["Messjahr", "vollständiges Kalenderjahr 2019"],
          ["Messung", "15-Minuten-Smart-Meter"],
          ["PV am Zähler", "keine"],
          ["PV-Anlage in der Simulation", "identisch"],
          ["Batteriemodell", "identisch"],
          ["Jahresverbrauch", "identisch"],
          ["Variiert", "nur die Form des Haushaltslastgangs"],
        ],
      },
      {
        caption: "Kennwerte der Validierung bei technischer Speichergröße 10 kWh",
        columns: ["Kennwert", "BDEW H25", "Vergleich mit 27 realen Haushalten"],
        rowHeaders: true,
        rows: [
          [
            "Technische Speichergröße",
            "10 kWh",
            "Bei der Mehrheit der Haushalte ebenfalls 10 kWh",
          ],
          [
            "Eigenverbrauchsquote",
            "41,8 %",
            "Typischer Bereich der realen Haushalte",
          ],
          [
            "Autarkie",
            "86,1 %",
            "Typischer Bereich der realen Haushalte",
          ],
        ],
      },
    ],
    callouts: [
      {
        title: "Technische Folgerung",
        body: "Die Untersuchung zeigte, dass die empfohlene technische Speichergröße gegenüber unterschiedlichen realen Verbrauchsprofilen weitgehend robust bleibt. Eigenverbrauch und Autarkie reagieren dagegen deutlich stärker auf das individuelle Nutzungsverhalten.",
      },
    ],
    notes: [
      "Diese Validierung beruht auf einer wissenschaftlichen Kohorte (WPuQ) und ist nicht als Abbildung jedes Haushalts in Deutschland gedacht.",
    ],
  },
  {
    id: "batteriespeicher",
    number: 5,
    title: "Batteriespeicher",
    paragraphs: [
      "Die Simulation rechnet mit der nutzbaren Speicherkapazität, also mit dem vom Hersteller ausgewiesenen nutzbaren Energieinhalt.",
      "Die Berechnung setzt eine neue Batterie bei Inbetriebnahme voraus. Innerhalb eines Simulationsjahres wird keine Kapazitätsalterung modelliert. Die physikalischen Kennzahlen beziehen sich daher auf den Zustand bei Inbetriebnahme.",
      "Batteriespeicher verlieren über die Betriebsjahre nutzbare Kapazität. Für die langfristige Planung ist daher eine Reserve gegenüber der heute technisch sinnvollen Größe zu berücksichtigen.",
    ],
    callouts: [
      {
        title: "Planungshinweis",
        body: "Die technische Speichergröße beschreibt die heute physikalisch sinnvolle nutzbare Kapazität. Für eine Auslegung über viele Betriebsjahre sollte zusätzlich eine Alterungsreserve eingeplant werden.",
      },
    ],
  },
  {
    id: "waermepumpe",
    number: 6,
    title: "Wärmepumpe",
    paragraphs: [
      "PVNavigator verwendet derzeit ein ingenieurtechnisches Wärmepumpenmodell. Der eingegebene Jahresstromverbrauch der Wärmepumpe wird als zusätzliche Lastreihe mit saisonaler Gewichtung abgebildet: höherer Verbrauch im Winter, geringerer Verbrauch im Sommer.",
      "Reale 15-Minuten-Wärmepumpenmessungen aus dem WPuQ-Projekt wurden bereits ausgewertet. Sie werden geprüft, ob und wo sie für eine künftige Produktionsnutzung wissenschaftlich geeignet sind. In der aktuellen Berechnung sind sie nicht eingesetzt.",
    ],
  },
];
