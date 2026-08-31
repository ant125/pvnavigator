import {
  findDefaultHeatPumpProfile,
  getHeatPumpCatalogueEntry,
} from "./catalogue";
import type {
  HeatPumpFallback,
  HeatPumpTechnology,
  ResolveHeatPumpProfileInput,
  ResolvedHeatPumpProfile,
} from "./types";

/**
 * Resolve a catalogue row from user-facing selection.
 *
 * Knows only catalogue metadata. Dataset internals (TwinHouse, BSE, WPuQ
 * house ids, fill recipes) do not belong here.
 */
export function resolveHeatPumpProfile(
  input: ResolveHeatPumpProfileInput
): ResolvedHeatPumpProfile {
  const { technology, dhwService, profileId } = input;
  if (dhwService !== "space_heat_only" && dhwService !== "space_heat_and_dhw") {
    throw new Error(`Unsupported heat-pump dhwService: ${String(dhwService)}`);
  }

  const { resolvedTechnology, fallback } = mapTechnology(technology);

  if (profileId !== undefined) {
    return resolveExplicitProfileId(
      profileId,
      technology,
      resolvedTechnology,
      dhwService,
      fallback
    );
  }

  const entry = findDefaultHeatPumpProfile(resolvedTechnology, dhwService);
  if (!entry) {
    throw new Error(
      `No heat-pump catalogue default for technology=${resolvedTechnology} dhwService=${dhwService}`
    );
  }

  return {
    entry,
    fallback,
    requestedTechnology: technology,
    resolvedTechnology,
  };
}

function mapTechnology(technology: ResolveHeatPumpProfileInput["technology"]): {
  resolvedTechnology: HeatPumpTechnology;
  fallback: HeatPumpFallback;
} {
  if (technology === "luftwasser" || technology === "wasserwasser") {
    return { resolvedTechnology: technology, fallback: false };
  }
  if (technology === "unknown") {
    return {
      resolvedTechnology: "luftwasser",
      fallback: "unknown-uses-luftwasser",
    };
  }
  throw new Error(`Unsupported heat-pump technology: ${String(technology)}`);
}

function resolveExplicitProfileId(
  profileId: string,
  requestedTechnology: ResolveHeatPumpProfileInput["technology"],
  resolvedTechnology: HeatPumpTechnology,
  dhwService: ResolveHeatPumpProfileInput["dhwService"],
  fallback: HeatPumpFallback
): ResolvedHeatPumpProfile {
  const entry = getHeatPumpCatalogueEntry(profileId);
  if (!entry) {
    throw new Error(`Unknown heat-pump profileId: ${profileId}`);
  }
  if (entry.technology !== resolvedTechnology) {
    throw new Error(
      `heat-pump profileId ${profileId} is ${entry.technology}, not ${resolvedTechnology}`
    );
  }
  if (entry.dhwService !== dhwService) {
    throw new Error(
      `heat-pump profileId ${profileId} is ${entry.dhwService}, not ${dhwService}`
    );
  }
  return {
    entry,
    fallback,
    requestedTechnology,
    resolvedTechnology,
  };
}
