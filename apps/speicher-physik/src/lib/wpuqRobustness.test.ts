import { describe, expect, it } from "vitest";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";
import { calculateSpeicherResult } from "./calculateSpeicherResult";
import { WPUQ_COHORT_SIZE } from "./wpuqCohort";

function syntheticPv15(): number[] {
  const out = new Array<number>(STEPS_PER_NON_LEAP_YEAR_15);
  for (let i = 0; i < STEPS_PER_NON_LEAP_YEAR_15; i++) {
    const hourOfDay = Math.floor(i / 4) % 24;
    out[i] = hourOfDay >= 8 && hourOfDay < 16 ? 0.15 : 0;
  }
  return out;
}

describe("customer WPuQ robustness pipeline", () => {
  it(
    "runs exactly 27 extra simulations on injected PV with scaled household load only",
    async () => {
      const annual = 4321;
      const pv = syntheticPv15();
      let pvCalls = 0;
      const getPvForYear = () => {
        pvCalls += 1;
        return pv;
      };
      const progressStages: string[] = [];
      const smartmeterCounts: number[] = [];

      const result = await calculateSpeicherResult({
        annualConsumptionKWh: annual,
        pvSystemKwP: 10,
        latitude: 48.14,
        longitude: 11.58,
        tiltDeg: 35,
        azimuthDeg: 180,
        getPvForYear,
        years: [2019],
        batterySizes: [5, 10, 15],
        onProgress: (event) => {
          progressStages.push(event.stage);
          if (event.stage === "smartmeter") {
            smartmeterCounts.push(event.completed);
          }
        },
      });

      expect(result.robustness.cohortSize).toBe(WPUQ_COHORT_SIZE);
      expect(result.robustness.houses).toHaveLength(WPUQ_COHORT_SIZE);
      expect(result.robustness.householdAnnualKwh).toBe(annual);
      expect(pvCalls).toBe(1 + WPUQ_COHORT_SIZE);

      const houseIds = result.robustness.houses.map((h) => h.houseId);
      expect(new Set(houseIds).size).toBe(WPUQ_COHORT_SIZE);

      for (const house of result.robustness.houses) {
        expect(house.eigenverbrauchKwh).toBeGreaterThan(0);
        expect(house.autarkiePct).toBeGreaterThan(0);
        expect(house.netzbezugKwh).toBeGreaterThanOrEqual(0);
        expect(house.einspeisungKwh).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(house.technicalSpeichergrenzeKwh)).toBe(true);
      }

      expect(result.robustness.sizeFrequency.reduce((s, r) => s + r.householdCount, 0)).toBe(
        WPUQ_COHORT_SIZE
      );
      expect(result.robustness.ranges.eigenverbrauchKwh.min).toBeLessThanOrEqual(
        result.robustness.ranges.eigenverbrauchKwh.max
      );
      expect(result.wasserWasserRobustness).toBeNull();
      expect(result.speicherGrenz.averageLoadKwhAnnual).toBeCloseTo(annual, 6);
      expect(result.speicherGrenz.averagePvYieldKwhAnnual).toBeCloseTo(
        pv.reduce((s, x) => s + x, 0),
        6
      );

      expect(progressStages.filter((s) => s === "pvgis")).toEqual(["pvgis"]);
      expect(progressStages.filter((s) => s === "consumption")).toEqual([
        "consumption",
      ]);
      expect(progressStages.filter((s) => s === "physics")).toEqual(["physics"]);
      expect(smartmeterCounts).toEqual(
        Array.from({ length: WPUQ_COHORT_SIZE + 1 }, (_, i) => i)
      );
      expect(progressStages.indexOf("physics")).toBeLessThan(
        progressStages.indexOf("smartmeter")
      );
    },
    60_000
  );
});
