/**
 * Merge hourly load components (8760h each) by summing per hour.
 */

const HOURS_PER_YEAR = 8760;

export type LoadComponent = {
  name: string;
  yearlyConsumption: number;
  profile: number[];
};

export function mergeLoadProfiles(components: LoadComponent[]): number[] {
  if (components.length === 0) {
    throw new Error("mergeLoadProfiles: at least one component is required");
  }

  const merged = new Array<number>(HOURS_PER_YEAR).fill(0);

  for (const c of components) {
    if (c.profile.length !== HOURS_PER_YEAR) {
      throw new Error(
        `mergeLoadProfiles: component "${c.name}" has length ${c.profile.length}, expected ${HOURS_PER_YEAR}`
      );
    }
    for (let h = 0; h < HOURS_PER_YEAR; h++) {
      const v = c.profile[h];
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(
          `mergeLoadProfiles: component "${c.name}" invalid value at hour ${h}`
        );
      }
      merged[h] += v;
    }
  }

  return merged;
}
