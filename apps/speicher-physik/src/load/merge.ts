/**
 * Merge load components index-by-index.
 *
 * All profiles must share the same length (8760 hourly or 35040 quarter-hour).
 * Mixing timesteps is an error. Output length equals input length.
 */

export type LoadComponent = {
  name: string;
  yearlyConsumption: number;
  profile: number[];
};

export function mergeLoadProfiles(components: LoadComponent[]): number[] {
  if (components.length === 0) {
    throw new Error("mergeLoadProfiles: at least one component is required");
  }

  const expectedLength = components[0].profile.length;
  if (expectedLength === 0) {
    throw new Error("mergeLoadProfiles: profile must be non-empty");
  }

  const merged = new Array<number>(expectedLength).fill(0);

  for (const c of components) {
    if (c.profile.length !== expectedLength) {
      throw new Error(
        `mergeLoadProfiles: component "${c.name}" has length ${c.profile.length}, expected ${expectedLength} (all components must share the same timestep length)`
      );
    }
    for (let i = 0; i < expectedLength; i++) {
      const v = c.profile[i];
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(
          `mergeLoadProfiles: component "${c.name}" invalid value at index ${i}`
        );
      }
      merged[i] += v;
    }
  }

  return merged;
}

/**
 * Household series plus any extra positive load components (heat pump, EV,
 * future). Merge math is index-wise and component-agnostic.
 */
export function mergeHouseholdLoadComponents(params: {
  householdProfile: number[];
  householdAnnualKwh: number;
  extras?: readonly LoadComponent[];
}): number[] {
  const extras = params.extras ?? [];
  return mergeLoadProfiles([
    {
      name: "house",
      yearlyConsumption: params.householdAnnualKwh,
      profile: params.householdProfile,
    },
    ...extras,
  ]);
}

/**
 * Compatibility wrapper: household plus an optional heat-pump component.
 * Prefer {@link mergeHouseholdLoadComponents} for new callers.
 */
export function mergeHouseholdWithHeatPump(params: {
  householdProfile: number[];
  householdAnnualKwh: number;
  heatPump: LoadComponent | null;
}): number[] {
  return mergeHouseholdLoadComponents({
    householdProfile: params.householdProfile,
    householdAnnualKwh: params.householdAnnualKwh,
    extras: params.heatPump ? [params.heatPump] : [],
  });
}
