import type { MethodologySource } from "./types";

/**
 * Single source of truth for every official engineering source cited by PVNavigator.
 *
 * To register a new assumption:
 * 1. Add a source object below (or in a focused file that you re-export into this array).
 * 2. Reference the source `id` from docs / UI / future PDF — never paste raw URLs elsewhere.
 * 3. Only then wire the number into production physics / economics code.
 */
export const METHODOLOGY_SOURCES: readonly MethodologySource[] = [
  // ── Weather ──────────────────────────────────────────────────────────────
  {
    id: "pvgis-jrc",
    category: "weather",
    title: "PVGIS (Photovoltaic Geographical Information System)",
    organization: "European Commission – Joint Research Centre (JRC)",
    description:
      "Offizielle EU-JRC-Plattform für PV-Ertragsabschätzung. PVNavigator bezieht stündliche Erzeugungsserien über die PVGIS-API (seriescalc) und gleicht sie auf Europe/Berlin an.",
    url: "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en",
    official: true,
    sourceType: "documentation",
    version: "PVGIS 5.2 API",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "pvgis-sarah2",
    category: "weather",
    title: "PVGIS-SARAH2 Solar Radiation Data",
    organization: "European Commission – Joint Research Centre (JRC) / CM SAF",
    description:
      "Satellitenbasierte Strahlungsdatenbank SARAH-2, in PVNavigator als raddatabase=PVGIS-SARAH2 für die Produktionsphysik verwendet.",
    url: "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/general-information/geospatial-data-download/sarah-2-solar-radiation-data_en",
    official: true,
    sourceType: "dataset",
    version: "SARAH-2 (PVGIS)",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "weather-years-2006-2020",
    category: "weather",
    title: "15 Wetterjahre (2006–2020)",
    organization: "PVNavigator / PVGIS-SARAH2",
    description:
      "Die physikalische Mehrjahressimulation nutzt die historischen Wetterjahre 2006 bis 2020 inklusive. Jedes Jahr wird unabhängig simuliert; es gibt keine monatliche Mittelwertbildung über die Jahre.",
    url: "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-user-manual_en",
    official: true,
    sourceType: "methodology",
    version: "2006–2020",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },

  // ── Load profiles ────────────────────────────────────────────────────────
  {
    id: "bdew-h25",
    category: "load_profiles",
    title: "BDEW Standardlastprofil H25",
    organization: "BDEW Bundesverband der Energie- und Wasserwirtschaft e.V.",
    description:
      "Aktualisiertes Haushalts-Standardlastprofil 2025. PVNavigator skaliert das H25-Profil auf den angegebenen Jahresverbrauch.",
    url: "https://www.bdew.de/energie/standardlastprofile-strom/",
    official: true,
    sourceType: "documentation",
    version: "2025",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "bdew-h25-quarter-hour",
    category: "load_profiles",
    title: "BDEW H25 – 15-Minuten-Auflösung",
    organization: "BDEW Bundesverband der Energie- und Wasserwirtschaft e.V.",
    description:
      "Die offiziellen BDEW-2025-Profile liefern nativ 96 Viertelstundenwerte pro Typtag. Die Produktionsphysik verwendet diese 15-Minuten-Auflösung ohne Stundenaggregation der Last.",
    url: "https://www.bdew.de/energie/standardlastprofile-strom/",
    official: true,
    sourceType: "dataset",
    version: "H25 / 96 slots/day",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "thermbuild-fordatis-486",
    category: "load_profiles",
    title: "ThermBuild TwinHouse Wärmepumpenmessungen",
    organization: "Fraunhofer IBP / Fordatis",
    description:
      "Laborgemessene 15-Minuten-Stromaufnahme von Luft/Wasser-Wärmepumpen (TwinHouse, Fraunhofer IBP). PVNavigator skaliert die Klassenprototypen Heizen ohne WW (O5) und Heizen plus WW (N2) auf den angegebenen Jahresstromverbrauch der Wärmepumpe. Der Haushaltsstrom bleibt BDEW H25.",
    url: "https://fordatis.fraunhofer.de/handle/fordatis/486",
    official: true,
    sourceType: "dataset",
    version: "Fordatis 486 / DOI 10.24406/fordatis/445",
    addedAt: "2026-08-31",
    updatedAt: "2026-08-31",
  },

  // ── Battery simulation (own methodology) ─────────────────────────────────
  {
    id: "sim-35040-steps",
    category: "battery_simulation",
    title: "35.040 Simulationsschritte pro Jahr",
    organization: "PVNavigator",
    description:
      "Jedes modellierte Jahr besteht aus genau 35.040 Intervallen à 15 Minuten (Δt = 0,25 h). Die Batteriesimulation läuft auf diesem Raster, nicht auf Monatsmitteln.",
    url: null,
    official: false,
    sourceType: "methodology",
    version: "v1",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "sim-15-minute",
    category: "battery_simulation",
    title: "15-Minuten-Simulation",
    organization: "PVNavigator",
    description:
      "PV-Erzeugung (stündlich von PVGIS, energieerhaltend auf 15 Minuten verteilt) und Haushaltslast (nativ 15 Minuten) werden in jedem Viertelstundenintervall mit dem Speicher abgeglichen.",
    url: null,
    official: false,
    sourceType: "methodology",
    version: "v1",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "sim-no-monthly-averaging",
    category: "battery_simulation",
    title: "Keine monatliche Mittelwertbildung",
    organization: "PVNavigator",
    description:
      "Eigenverbrauch, Autarkie und Speicherflüsse entstehen aus der vollständigen Zeitschrittsimulation. Es werden keine typischen Monatstage oder monatlichen Durchschnittsprofile als Ersatz für die Jahresreihe verwendet.",
    url: null,
    official: false,
    sourceType: "methodology",
    version: "v1",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "sim-independent-weather-years",
    category: "battery_simulation",
    title: "Unabhängige Wetterjahre",
    organization: "PVNavigator",
    description:
      "Jedes Wetterjahr 2006–2020 wird separat simuliert. Kennzahlen werden anschließend über die Jahre aggregiert; die Jahre werden nicht zu einem künstlichen Klimamitteljahr vermischt.",
    url: null,
    official: false,
    sourceType: "methodology",
    version: "v1",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },

  // ── Battery manufacturers ────────────────────────────────────────────────
  {
    id: "huawei-luna",
    category: "battery_manufacturers",
    title: "Huawei LUNA2000 Smart String ESS",
    organization: "Huawei Technologies",
    description:
      "Offizielle Herstellerseite zum residenzialen LUNA2000-Energiespeicher. Dient als dokumentierter Herstellerkontext, nicht als Produktempfehlung.",
    url: "https://solar.huawei.com/eu",
    official: true,
    sourceType: "manufacturer",
    version: null,
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "byd-battery-box",
    category: "battery_manufacturers",
    title: "BYD Battery-Box",
    organization: "BYD Company Ltd.",
    description:
      "Offizielle Produktseite der BYD Battery-Box (Premium HVS/HVM u. a.). Herstellerkontext für Speichersysteme, keine Empfehlung.",
    url: "https://www.bydbatterybox.com/",
    official: true,
    sourceType: "manufacturer",
    version: null,
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "tesla-powerwall",
    category: "battery_manufacturers",
    title: "Tesla Powerwall",
    organization: "Tesla, Inc.",
    description:
      "Offizielle Tesla-Produktseite Powerwall. Herstellerkontext für Heimspeicher, keine Empfehlung.",
    url: "https://www.tesla.com/powerwall",
    official: true,
    sourceType: "manufacturer",
    version: null,
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "sonnen-batterie-10-performance",
    category: "battery_manufacturers",
    title: "sonnenBatterie 10 performance",
    organization: "sonnen GmbH",
    description:
      "Offizielle Produktseite. Beispiel für herstellerspezifische Restkapazitäts- und Zyklenangaben im Kontext der planerischen Alterungsreserve.",
    url: "https://www.sonnen.de/stromspeicher/sonnenbatterie-10-performance",
    official: true,
    sourceType: "manufacturer",
    version: null,
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "enphase-iq-battery-5p-warranty",
    category: "battery_manufacturers",
    title: "Enphase IQ Battery 5P – Garantie (DE/AT)",
    organization: "Enphase Energy",
    description:
      "Offizielle Garantiedokumentation. Beispiel für abweichende Laufzeiten, Durchsatzbedingungen und Restkapazitätsschwellen.",
    url: "https://enphase.com/de-de/download/iq-battery-5p-de-de-austria-2024-10-25-warranty",
    official: true,
    sourceType: "warranty",
    version: "2024-10-25",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "tesla-powerwall-2-warranty-europe",
    category: "battery_manufacturers",
    title: "Tesla Powerwall 2 – European Warranty (historisch)",
    organization: "Tesla, Inc.",
    description:
      "Historisches, produkt- und dokumentenspezifisches Garantiebeispiel für europäische Powerwall-2-Installationen.",
    url: "https://www.tesla.com/sites/default/files/pdfs/powerwall/Powerwall_2_DC_Warranty_Europe_1-1_English.pdf",
    official: true,
    sourceType: "warranty",
    version: "1.1",
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },

  // ── Research ─────────────────────────────────────────────────────────────
  {
    id: "htw-berlin-unabhaengigkeitsrechner",
    category: "research",
    title: "HTW Berlin Unabhängigkeitsrechner",
    organization: "HTW Berlin – Hochschule für Technik und Wirtschaft Berlin",
    description:
      "Wissenschaftlicher Online-Rechner zu Autarkiegrad und Eigenverbrauchsanteil von PV-Batteriesystemen. Referenz zur Einordnung, kein Identitätsanspruch an unsere Simulation.",
    url: "https://solar.htw-berlin.de/rechner/unabhaengigkeitsrechner/",
    official: true,
    sourceType: "research",
    version: null,
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "fraunhofer-ise",
    category: "research",
    title: "Fraunhofer ISE",
    organization: "Fraunhofer-Institut für Solare Energiesysteme ISE",
    description:
      "Eines der weltweit größten Solarforschungsinstitute. Institutionelle Referenz für PV-, Speicher- und Systemforschung.",
    url: "https://www.ise.fraunhofer.de/",
    official: true,
    sourceType: "research",
    version: null,
    addedAt: "2026-08-29",
    updatedAt: "2026-08-29",
  },
  {
    id: "wpuq-scientific-data",
    category: "research",
    title: "WPuQ Smart-Meter-Datensatz",
    organization: "Schlemminger et al., Scientific Data (2022)",
    description:
      "Wissenschaftliche Publikation zu gemessenen Smart-Meter-Lastgängen deutscher Einfamilienhäuser. PVNavigator nutzt 27 vollständige NO_PV-Haushalte des Messjahres 2019 für die Robustheitsprüfung der Speicherempfehlung.",
    url: "https://www.nature.com/articles/s41597-022-01156-1",
    official: true,
    sourceType: "research",
    version: "Sci Data 9, 56 (2022)",
    addedAt: "2026-08-30",
    updatedAt: "2026-08-30",
  },

  // standards: intentionally empty until production logic cites VDI/DIN
  // economics: intentionally empty until tariff / cost assumptions are registered
] as const;

export function getMethodologySourceById(
  id: string,
): MethodologySource | undefined {
  return METHODOLOGY_SOURCES.find((s) => s.id === id);
}

export function getMethodologySourcesByCategory(
  category: MethodologySource["category"],
): MethodologySource[] {
  return METHODOLOGY_SOURCES.filter((s) => s.category === category);
}
