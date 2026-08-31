import type { MethodologyCategory, MethodologyCategoryId } from "./types";

/**
 * Display order for Methodik & Quellen (website + PDF).
 * Extend here when adding a new category section.
 */
export const METHODOLOGY_CATEGORY_ORDER: readonly MethodologyCategoryId[] = [
  "weather",
  "load_profiles",
  "battery_simulation",
  "battery_manufacturers",
  "research",
  "standards",
  "economics",
] as const;

export const METHODOLOGY_CATEGORIES: readonly MethodologyCategory[] = [
  {
    id: "weather",
    title: "Wetter & Strahlung",
    description:
      "Offizielle Wetter- und Strahlungsdatenquellen für die PV-Erzeugungssimulation.",
  },
  {
    id: "load_profiles",
    title: "Lastprofile",
    description:
      "Standardisierte Verbrauchsprofile für Haushaltslasten in Deutschland sowie gemessene Wärmepumpen-Referenzprofile.",
  },
  {
    id: "battery_simulation",
    title: "Batteriesimulation",
    description:
      "Methodik der zeitlichen Auflösung und Mehrjahressimulation des Speichers.",
  },
  {
    id: "battery_manufacturers",
    title: "Batteriehersteller",
    description:
      "Offizielle Herstellerseiten und Produktdokumentation (keine Empfehlung).",
  },
  {
    id: "research",
    title: "Forschung",
    description:
      "Wissenschaftliche Referenzstellen zur Einordnung von Autarkie und Speichersystemen.",
  },
  {
    id: "standards",
    title: "Normen (VDI / DIN)",
    description:
      "Vorbereitete Kategorie für VDI- und DIN-Normen. Einträge folgen, sobald sie in der Produktionslogik referenziert werden.",
  },
  {
    id: "economics",
    title: "Wirtschaftlichkeit",
    description:
      "Vorbereitete Kategorie für Tarife, Förderungen und ökonomische Annahmen. Noch ohne Einträge.",
  },
] as const;

export function getMethodologyCategory(
  id: MethodologyCategoryId,
): MethodologyCategory {
  const found = METHODOLOGY_CATEGORIES.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unknown methodology category: ${id}`);
  }
  return found;
}
