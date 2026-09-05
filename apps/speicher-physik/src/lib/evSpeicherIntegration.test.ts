import { describe, expect, it, vi } from "vitest";
import { EvProfileError } from "@ev-profile/loader";
import { STEPS_PER_NON_LEAP_YEAR_15 } from "../../../../packages/pv-core";
import { createUserLoadProfile15MinForYear } from "../../../../packages/bdew-profile";
import { calculateSpeicherResult } from "./calculateSpeicherResult";
import * as multiYearSimulation from "./multiYearSimulation";
import { WPUQ_COHORT_SIZE } from "./wpuqCohort";
import {
  loadWpuqCohort,
  scaleProfileToAnnualKwh,
} from "./wpuqCohort";
import { mergeHouseholdLoadComponents } from "@/load/merge";
import * as evAdapter from "@/load/resolveEvLoadComponent";
import { buildHeatPumpLoadComponent } from "@/load/resolveHeatPumpLoadComponent";
import { commuterEvInput, infeasibleEvInput, sum } from "@/test/evFixtures";

function syntheticPv15(): number[] {
  const out = new Array<number>(STEPS_PER_NON_LEAP_YEAR_15);
  for (let i = 0; i < STEPS_PER_NON_LEAP_YEAR_15; i++) {
    const hourOfDay = Math.floor(i / 4) % 24;
    out[i] = hourOfDay >= 8 && hourOfDay < 16 ? 0.15 : 0;
  }
  return out;
}

const BASE_INPUT = {
  annualConsumptionKWh: 4000,
  pvSystemKwP: 10,
  latitude: 48.14,
  longitude: 11.58,
  tiltDeg: 35,
  azimuthDeg: 180,
  batterySizes: [5, 10] as const,
};

describe("SpeicherGrenze EV integration", () => {
  it(
    "legacy: enabled:false keeps household-only results and null EV meta",
    async () => {
      const pv = syntheticPv15();
      const disabled = await calculateSpeicherResult({
        ...BASE_INPUT,
        ev: { enabled: false },
        getPvForYear: () => pv,
        years: [2019],
      });

      expect(disabled.ev).toBeNull();
      expect(disabled.heatPump).toBeNull();
      expect(disabled.robustness.householdAnnualKwh).toBe(
        BASE_INPUT.annualConsumptionKWh
      );
      expect(disabled.speicherGrenz.averageLoadKwhAnnual).toBeCloseTo(4000, 6);
    },
    60_000
  );

  it(
    "creates EV inside the weather-year loop and does not reuse years[0]",
    async () => {
      const pv = syntheticPv15();
      const years = [2018, 2019];
      const spy = vi.spyOn(evAdapter, "resolveEvLoadComponentForYear");
      const evInput = commuterEvInput();

      const result = await calculateSpeicherResult({
        ...BASE_INPUT,
        ev: evInput,
        getPvForYear: () => pv,
        years,
      });

      const calledYears = spy.mock.calls.map((call) => call[0].year).sort();
      expect(calledYears).toEqual([2018, 2019]);
      expect(spy.mock.calls[0][0].evInput.annualKm).toBe(evInput.annualKm);
      expect(spy.mock.calls[1][0].evInput.annualKm).toBe(evInput.annualKm);

      const profile2018 = spy.mock.results[0]?.value.component.profile;
      const profile2019 = spy.mock.results[1]?.value.component.profile;
      expect(profile2018).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
      expect(profile2019).toHaveLength(STEPS_PER_NON_LEAP_YEAR_15);
      expect(profile2018).not.toEqual(profile2019);

      expect(result.ev).not.toBeNull();
      expect(result.ev?.years).toEqual(years);
      expect(result.ev?.byYear[2018]?.year).toBe(2018);
      expect(result.ev?.byYear[2019]?.year).toBe(2019);
      expect(result.ev?.byYear[2018]?.homeChargedKwh).toBeGreaterThan(0);
      expect(result.ev?.averageHomeChargedKwh).toBeCloseTo(
        (result.ev!.byYear[2018].homeChargedKwh +
          result.ev!.byYear[2019].homeChargedKwh) /
          2,
        9
      );
      expect(result.speicherGrenz.averageLoadKwhAnnual).toBeCloseTo(
        BASE_INPUT.annualConsumptionKWh + result.ev!.averageHomeChargedKwh,
        6
      );
      expect(result.robustness.cohortSize).toBe(WPUQ_COHORT_SIZE);
      expect(result.robustness.householdAnnualKwh).toBe(
        BASE_INPUT.annualConsumptionKWh
      );

      spy.mockRestore();
    },
    180_000
  );

  it(
    "merged annual load includes household + HP + EV home charging",
    async () => {
      const pv = syntheticPv15();
      const houseAnnual = 4000;
      const hpAnnual = 2000;
      const result = await calculateSpeicherResult({
        ...BASE_INPUT,
        annualConsumptionKWh: houseAnnual,
        heatPumpEnabled: true,
        heatPumpConsumptionKWh: hpAnnual,
        ev: commuterEvInput(),
        getPvForYear: () => pv,
        years: [2018],
      });

      expect(result.heatPump).not.toBeNull();
      expect(result.ev).not.toBeNull();
      expect(result.speicherGrenz.averageLoadKwhAnnual).toBeCloseTo(
        houseAnnual + hpAnnual + result.ev!.averageHomeChargedKwh,
        6
      );
    },
    120_000
  );

  it("infeasible EV fails before PVGIS / weather work", async () => {
    const pvgis = vi.spyOn(multiYearSimulation, "loadHourlyPvByYear");
    await expect(
      calculateSpeicherResult({
        ...BASE_INPUT,
        ev: infeasibleEvInput(),
        years: [2018],
      })
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof EvProfileError &&
        error.kind === "infeasible" &&
        error.code === "DRIVING_UNSERVED"
      );
    });
    expect(pvgis).not.toHaveBeenCalled();
    pvgis.mockRestore();
  });
});

describe("EV robustness composition", () => {
  it("household robustness varies the household only; EV follows the target year", () => {
    const houseAnnual = 4000;
    const hpAnnual = 1800;
    const hp = buildHeatPumpLoadComponent({
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: hpAnnual,
      year: 2018,
    }).component;
    const ev2018 = evAdapter.resolveEvLoadComponentForYear({
      evInput: commuterEvInput(),
      year: 2018,
    }).component;
    const ev2019 = evAdapter.resolveEvLoadComponentForYear({
      evInput: commuterEvInput(),
      year: 2019,
    }).component;
    expect(ev2018.profile).not.toEqual(ev2019.profile);

    const cohort = loadWpuqCohort();
    const houseA = scaleProfileToAnnualKwh(
      cohort.profiles[0].intervalEnergyKwh,
      houseAnnual,
      cohort.profiles[0].houseId
    );
    const houseB = scaleProfileToAnnualKwh(
      cohort.profiles[1].intervalEnergyKwh,
      houseAnnual,
      cohort.profiles[1].houseId
    );
    expect(houseA).not.toEqual(houseB);

    const mergedA2018 = mergeHouseholdLoadComponents({
      householdProfile: houseA,
      householdAnnualKwh: houseAnnual,
      extras: [hp, ev2018],
    });
    const mergedB2018 = mergeHouseholdLoadComponents({
      householdProfile: houseB,
      householdAnnualKwh: houseAnnual,
      extras: [hp, ev2018],
    });
    const mergedA2019 = mergeHouseholdLoadComponents({
      householdProfile: houseA,
      householdAnnualKwh: houseAnnual,
      extras: [hp, ev2019],
    });

    for (let i = 0; i < mergedA2018.length; i++) {
      expect(mergedA2018[i] - houseA[i]).toBeCloseTo(hp.profile[i] + ev2018.profile[i], 12);
      expect(mergedB2018[i] - houseB[i]).toBeCloseTo(hp.profile[i] + ev2018.profile[i], 12);
      expect(mergedA2019[i] - houseA[i]).toBeCloseTo(hp.profile[i] + ev2019.profile[i], 12);
    }
    expect(mergedA2018).not.toEqual(mergedB2018);
    expect(mergedA2018).not.toEqual(mergedA2019);
  });

  it("W/W robustness varies only the HP shape; EV stays the customer series for that year", () => {
    const houseAnnual = 4000;
    const house2018 = createUserLoadProfile15MinForYear(houseAnnual, 2018);
    const house2019 = createUserLoadProfile15MinForYear(houseAnnual, 2019);
    const hpA = buildHeatPumpLoadComponent({
      technology: "wasserwasser",
      dhwService: "space_heat_and_dhw",
      annualElectricalKwh: 2500,
      year: 2018,
    }).component;
    const hpB = {
      ...hpA,
      name: "heatPump",
      profile: hpA.profile.map((v, i) => (i % 96 === 0 ? v + 0.01 : v)),
    };
    hpB.profile[0] = Math.max(0, hpB.profile[0]);
    const ev2018 = evAdapter.resolveEvLoadComponentForYear({
      evInput: commuterEvInput(),
      year: 2018,
    }).component;
    const ev2019 = evAdapter.resolveEvLoadComponentForYear({
      evInput: commuterEvInput(),
      year: 2019,
    }).component;

    const a2018 = mergeHouseholdLoadComponents({
      householdProfile: house2018,
      householdAnnualKwh: houseAnnual,
      extras: [hpA, ev2018],
    });
    const b2018 = mergeHouseholdLoadComponents({
      householdProfile: house2018,
      householdAnnualKwh: houseAnnual,
      extras: [hpB, ev2018],
    });
    const a2019 = mergeHouseholdLoadComponents({
      householdProfile: house2019,
      householdAnnualKwh: houseAnnual,
      extras: [hpA, ev2019],
    });

    for (let i = 0; i < a2018.length; i++) {
      expect(a2018[i]).toBeCloseTo(
        house2018[i] + hpA.profile[i] + ev2018.profile[i],
        12
      );
      expect(b2018[i]).toBeCloseTo(
        house2018[i] + hpB.profile[i] + ev2018.profile[i],
        12
      );
      expect(a2019[i]).toBeCloseTo(
        house2019[i] + hpA.profile[i] + ev2019.profile[i],
        12
      );
    }
    expect(a2018).not.toEqual(b2018);
    expect(sum(a2018) - sum(house2018) - sum(hpA.profile)).toBeCloseTo(
      ev2018.yearlyConsumption,
      6
    );
  });
});
