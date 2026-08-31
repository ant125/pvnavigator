import type { HeatPumpCatalogueEntry, HeatPumpDhwService, HeatPumpTechnology } from "./types";

/**
 * Production heat-pump profile catalogue.
 *
 * This is the only place that decides which series exist and which row is
 * the default for a (technology, dhwService) pair. Loaders must not select.
 *
 * Adding a dataset is a new row. It does not change an existing default.
 */
export const HEAT_PUMP_CATALOGUE: readonly HeatPumpCatalogueEntry[] = [
  {
    profileId: "lw-heating-only-thermbuild-o5-v1",
    technology: "luftwasser",
    dhwService: "space_heat_only",
    quality: "lab-prototype",
    methodologySourceId: "thermbuild-fordatis-486",
    license: "CC-BY-SA-4.0",
    defaultFor: {
      technology: "luftwasser",
      dhwService: "space_heat_only",
    },
  },
  {
    profileId: "lw-heating-dhw-thermbuild-n2-v1",
    technology: "luftwasser",
    dhwService: "space_heat_and_dhw",
    quality: "lab-prototype",
    methodologySourceId: "thermbuild-fordatis-486",
    license: "CC-BY-SA-4.0",
    defaultFor: {
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
    },
  },
];

const BY_ID = new Map(
  HEAT_PUMP_CATALOGUE.map((entry) => [entry.profileId, entry])
);

assertCatalogueInvariants(HEAT_PUMP_CATALOGUE);

export function getHeatPumpCatalogue(): readonly HeatPumpCatalogueEntry[] {
  return HEAT_PUMP_CATALOGUE;
}

export function getHeatPumpCatalogueEntry(
  profileId: string
): HeatPumpCatalogueEntry | undefined {
  return BY_ID.get(profileId);
}

export function findDefaultHeatPumpProfile(
  technology: HeatPumpTechnology,
  dhwService: HeatPumpDhwService
): HeatPumpCatalogueEntry | undefined {
  return HEAT_PUMP_CATALOGUE.find(
    (entry) =>
      entry.defaultFor?.technology === technology &&
      entry.defaultFor.dhwService === dhwService
  );
}

function assertCatalogueInvariants(
  entries: readonly HeatPumpCatalogueEntry[]
): void {
  const ids = new Set<string>();
  const defaults = new Set<string>();
  for (const entry of entries) {
    if (!entry.profileId) {
      throw new Error("heatpump-profile catalogue entry is missing profileId");
    }
    if (ids.has(entry.profileId)) {
      throw new Error(
        `heatpump-profile catalogue has duplicate profileId ${entry.profileId}`
      );
    }
    ids.add(entry.profileId);
    if (!entry.methodologySourceId) {
      throw new Error(
        `heatpump-profile catalogue ${entry.profileId} is missing methodologySourceId`
      );
    }
    if (!entry.license) {
      throw new Error(
        `heatpump-profile catalogue ${entry.profileId} is missing license`
      );
    }
    if (entry.defaultFor) {
      if (entry.defaultFor.technology !== entry.technology) {
        throw new Error(
          `heatpump-profile catalogue ${entry.profileId}: defaultFor.technology must match the series`
        );
      }
      if (entry.defaultFor.dhwService !== entry.dhwService) {
        throw new Error(
          `heatpump-profile catalogue ${entry.profileId}: defaultFor.dhwService must match the series`
        );
      }
      const key = `${entry.defaultFor.technology}:${entry.defaultFor.dhwService}`;
      if (defaults.has(key)) {
        throw new Error(
          `heatpump-profile catalogue has two defaults for ${key}`
        );
      }
      defaults.add(key);
    }
  }
}
