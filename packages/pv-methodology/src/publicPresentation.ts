import { getMethodologyCategory } from "./categories";
import {
  METHODOLOGY_PAGE_SUBTITLE,
  METHODOLOGY_PAGE_TITLE,
} from "./methodologyChapters";
import { getMethodologySourceById } from "./registry";
import type { MethodologySource } from "./types";

/**
 * Public presentation layer for Methodik & Quellen.
 *
 * The registry remains the only place for official URLs.
 * This module only decides how sources are grouped and worded for users.
 * It does not change registry entries or production physics.
 */

export type PublicMethodologyLink = {
  /** Registry source id (for traceability; not shown in UI). */
  sourceId: string;
  label: string;
  url: string;
};

export type PublicMethodologyEntry = {
  id: string;
  title: string;
  organization: string | null;
  description: string;
  bullets: readonly string[];
  links: readonly PublicMethodologyLink[];
};

export type PublicMethodologySection = {
  id: string;
  title: string;
  description: string;
  /** Stable icon key for the public page (mapped to a monochrome Lucide icon). */
  icon: PublicMethodologySectionIcon;
  entries: readonly PublicMethodologyEntry[];
};

export type PublicMethodologySectionIcon =
  | "weather"
  | "load"
  | "simulation"
  | "capacity"
  | "research";

export const PUBLIC_METHODOLOGY_INTRO = {
  headline: METHODOLOGY_PAGE_TITLE,
  paragraphs: [METHODOLOGY_PAGE_SUBTITLE],
} as const;

export const PUBLIC_METHODOLOGY_VERSIONING = {
  title: "Versionierung",
  paragraphs: [
    "Änderungen der Berechnungsmethodik werden dokumentiert und versioniert.",
    "Neue technische Annahmen werden erst nach Aufnahme in dieses Quellenverzeichnis produktiv verwendet.",
  ],
} as const;

/** Manufacturer / warranty ids kept in the registry but not shown publicly. */
const PUBLIC_HIDDEN_SOURCE_IDS = new Set([
  "sonnen-batterie-10-performance",
  "enphase-iq-battery-5p-warranty",
  "tesla-powerwall-2-warranty-europe",
]);

const PUBLIC_MANUFACTURER_IDS = [
  "huawei-luna",
  "byd-battery-box",
  "tesla-powerwall",
] as const;

function requireSource(id: string): MethodologySource {
  const source = getMethodologySourceById(id);
  if (!source) {
    throw new Error(`Missing methodology source for public presentation: ${id}`);
  }
  return source;
}

function linkFrom(id: string, label?: string): PublicMethodologyLink | null {
  const source = requireSource(id);
  if (!source.url) return null;
  return {
    sourceId: source.id,
    label: label ?? source.title,
    url: source.url,
  };
}

function linksFrom(
  ids: readonly string[],
  labels?: Record<string, string>,
): PublicMethodologyLink[] {
  return ids
    .map((id) => linkFrom(id, labels?.[id]))
    .filter((l): l is PublicMethodologyLink => l !== null);
}

/**
 * Public sections for the website. Empty registry categories are omitted.
 * URLs are always resolved from the registry.
 */
export function getPublicMethodologySections(): PublicMethodologySection[] {
  const weather = getMethodologyCategory("weather");
  const load = getMethodologyCategory("load_profiles");
  const simulation = getMethodologyCategory("battery_simulation");
  const research = getMethodologyCategory("research");

  const pvgis = requireSource("pvgis-jrc");
  const bdew = requireSource("bdew-h25");
  const thermbuild = requireSource("thermbuild-fordatis-486");
  const htw = requireSource("htw-berlin-unabhaengigkeitsrechner");
  const ise = requireSource("fraunhofer-ise");

  const sections: PublicMethodologySection[] = [
    {
      id: weather.id,
      title: weather.title,
      icon: "weather",
      description:
        "Die PV-Erzeugung basiert auf offiziellen europäischen Wetter- und Strahlungsdaten.",
      entries: [
        {
          id: "public-pvgis",
          title: "PVGIS mit SARAH2 (2006–2020)",
          organization: pvgis.organization,
          description:
            "Die Erzeugungssimulation nutzt PVGIS der Europäischen Kommission (JRC). Als Strahlungsdatenbank dient SARAH2. Es werden 15 historische Wetterjahre von 2006 bis 2020 unabhängig ausgewertet.",
          bullets: [
            "Datenquelle: PVGIS (EU Joint Research Centre)",
            "Strahlungsdatenbank: SARAH2",
            "Zeitraum: 15 Wetterjahre, 2006–2020",
            "Jedes Wetterjahr wird separat simuliert",
          ],
          links: linksFrom(
            ["pvgis-jrc", "pvgis-sarah2"],
            {
              "pvgis-jrc": "PVGIS (EU JRC)",
              "pvgis-sarah2": "SARAH2 Strahlungsdaten",
            },
          ),
        },
      ],
    },
    {
      id: load.id,
      title: load.title,
      icon: "load",
      description:
        "Der Haushaltsverbrauch folgt dem aktuellen BDEW-Standardlastprofil. Eine optionale Luft/Wasser-Wärmepumpe wird über ein gemessenes ThermBuild-Referenzprofil abgebildet.",
      entries: [
        {
          id: "public-bdew-h25",
          title: "BDEW Standardlastprofil H25",
          organization: bdew.organization,
          description:
            "Für den zeitlichen Verlauf des Haushaltsverbrauchs verwenden wir das BDEW-Profil H25. Das Profil liegt in 15-Minuten-Auflösung vor und wird auf den angegebenen Jahresverbrauch skaliert.",
          bullets: [
            "Profil: BDEW H25 (Haushalt)",
            "Auflösung: 15 Minuten (96 Werte pro Tag)",
            "Skalierung auf den individuellen Jahresverbrauch",
          ],
          links: linksFrom(["bdew-h25"], {
            "bdew-h25": "BDEW Standardlastprofile Strom",
          }),
        },
        {
          id: "public-thermbuild",
          title: "ThermBuild Wärmepumpenmessungen",
          organization: thermbuild.organization,
          description:
            "Für Luft/Wasser-Wärmepumpen verwendet die Simulation gemessene elektrische Lastprofile in 15-Minuten-Auflösung aus der ThermBuild-Messkampagne. Das Profil ist ein repräsentatives ingenieurtechnisches Referenzprofil und wird gleichmäßig auf den angegebenen Jahresstromverbrauch der Wärmepumpe skaliert. Es bildet nicht die individuelle Wärmepumpe des Nutzers ab.",
          bullets: [
            "Quelle: ThermBuild-Messkampagne, Fraunhofer",
            "Elektrisches Lastprofil, 15-Minuten-Auflösung",
            "Gleichmäßige Skalierung auf den Jahresstromverbrauch",
            "Referenzprofil, nicht der Lastgang der Nutzer-Wärmepumpe",
          ],
          links: linksFrom(["thermbuild-fordatis-486"], {
            "thermbuild-fordatis-486":
              "ThermBuild TwinHouse Wärmepumpenmessungen",
          }),
        },
      ],
    },
    {
      id: simulation.id,
      title: "Simulationsmethodik",
      icon: "simulation",
      description:
        "Die Speicherberechnung erfolgt als vollständige Zeitschrittsimulation – nicht über Monatsmittel.",
      entries: [
        {
          id: "public-simulation",
          title: "PVNavigator Simulationsmethodik",
          organization: "PVNavigator",
          description:
            "PV-Erzeugung, Verbrauch und Speicher werden in 15-Minuten-Schritten über jedes Wetterjahr hinweg abgeglichen. Die Kennzahlen entstehen aus dieser Simulation, nicht aus typischen Monatstagen oder Durchschnittsprofilen.",
          bullets: [
            "15-Minuten-Simulation (Δt = 0,25 h)",
            "35.040 Zeitschritte je Nichtschaltjahr",
            "Keine monatliche Mittelwertbildung",
            "Unabhängige Auswertung der Wetterjahre 2006–2020",
          ],
          links: [],
        },
      ],
    },
    {
      id: "usable-capacity-aging",
      title: "Nutzbare Speicherkapazität & Alterung",
      icon: "capacity",
      description:
        "Offizielle Herstellerunterlagen dienen als technische Referenz für nutzbare Speicherkapazität, Garantiebedingungen, Alterungsverhalten und Restkapazität nach Garantiezeit. Sie sind keine Produktempfehlung und kein Herstellervergleich.",
      entries: PUBLIC_MANUFACTURER_IDS.map((id) => {
        const source = requireSource(id);
        return {
          id: `public-${id}`,
          title: source.title,
          organization: source.organization,
          description:
            "Offizielle Herstellerdokumentation als neutrale Referenz zur Einordnung der genannten technischen Annahmen.",
          bullets: [] as string[],
          links: linksFrom([id], { [id]: "Offizielle Herstellerseite" }),
        };
      }),
    },
    {
      id: research.id,
      title: research.title,
      icon: "research",
      description:
        "Wissenschaftliche Referenzstellen zur Einordnung von Autarkie und Speichersystemen.",
      entries: [
        {
          id: "public-ise",
          title: ise.title,
          organization: ise.organization,
          description: ise.description,
          bullets: [],
          links: linksFrom(["fraunhofer-ise"], {
            "fraunhofer-ise": "Fraunhofer ISE",
          }),
        },
        {
          id: "public-htw",
          title: htw.title,
          organization: htw.organization,
          description: htw.description,
          bullets: [],
          links: linksFrom(["htw-berlin-unabhaengigkeitsrechner"], {
            "htw-berlin-unabhaengigkeitsrechner": "HTW Berlin Unabhängigkeitsrechner",
          }),
        },
      ],
    },
  ];

  // Hide empty categories (standards, economics) — they stay in the registry.
  return sections.filter((section) => section.entries.length > 0);
}

/** Ids currently hidden from the public page (registry unchanged). */
export function getPublicHiddenSourceIds(): readonly string[] {
  return [...PUBLIC_HIDDEN_SOURCE_IDS];
}
