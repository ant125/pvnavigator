import { describe, expect, it } from "vitest";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";
import { calculateSpeicherResult } from "./calculateSpeicherResult";
import { WPUQ_COHORT_SIZE } from "./wpuqCohort";
import { WPUQ_WW_ROBUSTNESS_SIZE } from "./wpuqWwRobustnessCohort";
import { scaleUniformEnergy } from "@heatpump-profile/loader";
import { loadWpuqWwRobustnessCohort } from "./wpuqWwRobustnessCohort";

function syntheticPv15(): number[] {
  const out = new Array<number>(STEPS_PER_NON_LEAP_YEAR_15);
  for (let i = 0; i < STEPS_PER_NON_LEAP_YEAR_15; i++) {
    const hourOfDay = Math.floor(i / 4) % 24;
    out[i] = hourOfDay >= 8 && hourOfDay < 16 ? 0.15 : 0;
  }
  return out;
}

function sum(arr: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

describe("customer Wasser/Wasser robustness pipeline", () => {
  it("is null when heat pump is off or not Wasser/Wasser", async () => {
    const pv = syntheticPv15();
    const off = await calculateSpeicherResult({
      annualConsumptionKWh: 4000,
      pvSystemKwP: 10,
      latitude: 48.14,
      longitude: 11.58,
      tiltDeg: 35,
      azimuthDeg: 180,
      getPvForYear: () => pv,
      years: [2019],
      batterySizes: [5, 10],
    });
    expect(off.wasserWasserRobustness).toBeNull();

    const luft = await calculateSpeicherResult({
      annualConsumptionKWh: 4000,
      pvSystemKwP: 10,
      latitude: 48.14,
      longitude: 11.58,
      tiltDeg: 35,
      azimuthDeg: 180,
      heatPumpEnabled: true,
      heatPumpConsumptionKWh: 2000,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_and_dhw",
      getPvForYear: () => pv,
      years: [2019],
      batterySizes: [5, 10],
    });
    expect(luft.heatPump?.resolvedTechnology).toBe("luftwasser");
    expect(luft.wasserWasserRobustness).toBeNull();
  }, 120_000);

  it(
    "runs exactly 24 WW profiles, keeps SFH38 production, preserves HP annual kWh",
    async () => {
      const houseAnnual = 4000;
      const hpAnnual = 2500;
      const pv = syntheticPv15();
      let pvCalls = 0;
      const getPvForYear = () => {
        pvCalls += 1;
        return pv;
      };

      const result = await calculateSpeicherResult({
        annualConsumptionKWh: houseAnnual,
        pvSystemKwP: 10,
        latitude: 48.14,
        longitude: 11.58,
        tiltDeg: 35,
        azimuthDeg: 180,
        heatPumpEnabled: true,
        heatPumpConsumptionKWh: hpAnnual,
        heatPumpTechnology: "wasserwasser",
        heatPumpDhwService: "space_heat_and_dhw",
        getPvForYear,
        years: [2019],
        batterySizes: [5, 10, 15],
      });

      // Production path unchanged: SFH38 catalogue profile.
      expect(result.heatPump?.resolvedTechnology).toBe("wasserwasser");
      expect(result.heatPump?.profileId).toBe(
        "ww-heating-dhw-wpuq-2019-sfh38-v1"
      );
      expect(result.speicherGrenz.averageLoadKwhAnnual).toBeCloseTo(
        houseAnnual + hpAnnual,
        6
      );

      // Household robustness still runs independently.
      expect(result.robustness.cohortSize).toBe(WPUQ_COHORT_SIZE);

      const ww = result.wasserWasserRobustness;
      expect(ww).not.toBeNull();
      expect(ww!.cohortSize).toBe(WPUQ_WW_ROBUSTNESS_SIZE);
      expect(ww!.profiles).toHaveLength(WPUQ_WW_ROBUSTNESS_SIZE);
      expect(ww!.heatPumpAnnualKwh).toBe(hpAnnual);
      expect(new Set(ww!.profiles.map((p) => p.profileId)).size).toBe(
        WPUQ_WW_ROBUSTNESS_SIZE
      );
      expect(new Set(ww!.profiles.map((p) => p.houseId)).size).toBe(
        WPUQ_WW_ROBUSTNESS_SIZE
      );

      for (const profile of ww!.profiles) {
        expect(profile.profileId).toMatch(/^ww-wpuq-2019-sfh\d{2}-v1$/);
        expect(profile.houseId).toMatch(/^SFH\d+$/);
        expect(profile.eigenverbrauchKwh).toBeGreaterThan(0);
        expect(Number.isFinite(profile.technicalSpeichergrenzeKwh)).toBe(true);
      }

      const agg = ww!.aggregates.eigenverbrauchKwh;
      expect(agg.min).toBeLessThanOrEqual(agg.median);
      expect(agg.median).toBeLessThanOrEqual(agg.max);
      expect(agg.min).toBeLessThanOrEqual(agg.mean);
      expect(agg.mean).toBeLessThanOrEqual(agg.max);

      // Primary + 27 household + 24 WW = 52 PV year lookups with injected PV.
      expect(pvCalls).toBe(1 + WPUQ_COHORT_SIZE + WPUQ_WW_ROBUSTNESS_SIZE);

      // Scaling invariant on the packed weights (same math the runner uses).
      const cohort = loadWpuqWwRobustnessCohort();
      for (const entry of cohort.profiles) {
        const { profile } = scaleUniformEnergy(
          Array.from(entry.weights),
          hpAnnual
        );
        expect(profile).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
        expect(sum(profile)).toBeCloseTo(hpAnnual, 8);
      }
    },
    180_000
  );
});
