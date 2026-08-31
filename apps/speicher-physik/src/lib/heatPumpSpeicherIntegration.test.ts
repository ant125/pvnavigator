import { describe, expect, it, vi } from "vitest";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";
import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import { calculateSpeicherResult } from "./calculateSpeicherResult";
import {
  loadWpuqCohort,
  scaleProfileToAnnualKwh,
  WPUQ_COHORT_SIZE,
} from "./wpuqCohort";
import { mergeHouseholdWithHeatPump } from "@/load/merge";
import * as heatPumpAdapter from "@/load/resolveHeatPumpLoadComponent";
import { buildHeatPumpLoadComponent } from "@/load/resolveHeatPumpLoadComponent";

function syntheticPv15(): number[] {
  const out = new Array<number>(STEPS_PER_NON_LEAP_YEAR_15);
  for (let i = 0; i < STEPS_PER_NON_LEAP_YEAR_15; i++) {
    const hourOfDay = Math.floor(i / 4) % 24;
    out[i] = hourOfDay >= 8 && hourOfDay < 16 ? 0.15 : 0;
  }
  return out;
}

describe("SpeicherGrenze heat-pump integration", () => {
  it(
    "D/F/G: legacy HP input conserves energy, selects N2, and builds HP once",
    async () => {
      const houseAnnual = 4000;
      const hpAnnual = 2000;
      const pv = syntheticPv15();
      const spy = vi.spyOn(heatPumpAdapter, "buildHeatPumpLoadComponent");

      const result = await calculateSpeicherResult({
        annualConsumptionKWh: houseAnnual,
        pvSystemKwP: 10,
        latitude: 48.14,
        longitude: 11.58,
        tiltDeg: 35,
        azimuthDeg: 180,
        heatPumpEnabled: true,
        heatPumpConsumptionKWh: hpAnnual,
        getPvForYear: () => pv,
        years: [2019],
        batterySizes: [5, 10],
      });

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();

      expect(result.heatPump).not.toBeNull();
      expect(result.heatPump?.usedLegacyDefaults).toBe(true);
      expect(result.heatPump?.requestedTechnology).toBe("unknown");
      expect(result.heatPump?.dhwService).toBe("space_heat_and_dhw");
      expect(result.heatPump?.profileId).toBe(
        "lw-heating-dhw-thermbuild-n2-v1"
      );
      expect(result.heatPump?.fallback).toBe("unknown-uses-luftwasser");
      expect(result.heatPump?.usedSyntheticFallback).toBe(false);
      expect(result.heatPump?.methodologySourceId).toBe(
        "thermbuild-fordatis-486"
      );
      expect(result.speicherGrenz.averageLoadKwhAnnual).toBeCloseTo(
        houseAnnual + hpAnnual,
        6
      );
      expect(result.robustness.cohortSize).toBe(WPUQ_COHORT_SIZE);
      expect(result.robustness.householdAnnualKwh).toBe(houseAnnual);
    },
    60_000
  );

  it("G: all 27 WPuQ households reuse the exact same HP series", () => {
    const houseAnnual = 4000;
    const hpAnnual = 2500;
    const hp = buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_only",
      annualElectricalKwh: hpAnnual,
      year: 2019,
    });
    const cohort = loadWpuqCohort();
    expect(cohort.profiles).toHaveLength(WPUQ_COHORT_SIZE);

    const hpShape = hp.component.profile;
    const expectedMerged = houseAnnual + hpAnnual;
    for (const profile of cohort.profiles) {
      const household = scaleProfileToAnnualKwh(
        profile.intervalEnergyKwh,
        houseAnnual,
        profile.houseId
      );
      const merged = mergeHouseholdWithHeatPump({
        householdProfile: household,
        householdAnnualKwh: houseAnnual,
        heatPump: hp.component,
      });
      expect(merged).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
      let mergedSum = 0;
      for (let i = 0; i < merged.length; i++) {
        const hpPart = merged[i] - household[i];
        if (Math.abs(hpPart - hpShape[i]) > 1e-12) {
          throw new Error(
            `${profile.houseId}: HP slot ${i} is ${hpPart}, expected ${hpShape[i]}`
          );
        }
        mergedSum += merged[i];
      }
      expect(Math.abs(mergedSum - expectedMerged)).toBeLessThanOrEqual(
        expectedMerged * 1e-9
      );
    }

    const houseA = createUserLoadProfile15MinForYear(houseAnnual, 2019);
    const houseB = scaleProfileToAnnualKwh(
      cohort.profiles[0].intervalEnergyKwh,
      houseAnnual,
      cohort.profiles[0].houseId
    );
    expect(houseA).not.toEqual(houseB);
  });
});
