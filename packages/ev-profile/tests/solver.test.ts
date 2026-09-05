import { describe, expect, it } from "vitest";
import { createEvProfile, EvProfileError } from "../src/index";
import { buildEvModelDays, countEvDayTypes } from "../src/calendar";
import { normalizeDrivingDistances } from "../src/normalize";
import { solveCyclicEvYear } from "../src/solver";
import { materializeHomeAvailability } from "../src/windows";
import { placeWorkplaceEvents, workplaceOfferByDay } from "../src/workplace";
import { commuterInput } from "./helpers";

function yearInputFrom(input: ReturnType<typeof commuterInput>) {
  const days = buildEvModelDays(input.year);
  const workplaceEvents = placeWorkplaceEvents(days, input.workplace);
  return {
    dailyKm: normalizeDrivingDistances(
      input.annualKm,
      input.typicalDailyKm,
      days,
      countEvDayTypes(days)
    ).dailyKm,
    consumptionKwhPer100Km: input.consumptionKwhPer100Km,
    usableBatteryCapacityKwh: input.usableBatteryCapacityKwh,
    maxHomeChargePowerKw: input.maxHomeChargePowerKw,
    availability: materializeHomeAvailability(days, input.homeWindow),
    workplaceOfferByDay: workplaceOfferByDay(days.length, workplaceEvents),
  };
}

describe("cyclic year solver", () => {
  it("reports start ≈ end and is deterministic", () => {
    const first = createEvProfile(commuterInput());
    const second = createEvProfile(commuterInput());
    expect(first.meta.energyEndKwh).toBeCloseTo(first.meta.energyStartKwh, 9);
    expect(first.profile).toEqual(second.profile);
    expect(first.meta).toEqual(second.meta);
  });

  it("does not depend on the discarded initial seed", () => {
    const input = yearInputFrom(commuterInput());
    const fromEmpty = solveCyclicEvYear(input, {
      initialEnergyKwh: 0,
      maxPasses: 64,
      energyAbsTolKwh: 1e-6,
    });
    const fromFull = solveCyclicEvYear(input, {
      initialEnergyKwh: 60,
      maxPasses: 64,
      energyAbsTolKwh: 1e-6,
    });
    expect(fromEmpty.pass.energyStartKwh).toBeCloseTo(
      fromEmpty.pass.energyEndKwh,
      9
    );
    expect(fromFull.pass.energyStartKwh).toBeCloseTo(
      fromFull.pass.energyEndKwh,
      9
    );
    expect(fromEmpty.pass.energyStartKwh).toBeCloseTo(
      fromFull.pass.energyStartKwh,
      6
    );
    expect(fromEmpty.pass.homeChargedKwh).toBeCloseTo(
      fromFull.pass.homeChargedKwh,
      6
    );
    expect(fromEmpty.pass.profile).toEqual(fromFull.pass.profile);
  });

  it("fails instead of publishing a cold-start profile", () => {
    const input = yearInputFrom(
      commuterInput({
        annualKm: 0,
        workplace: { enabled: true, kwhPerMonth: 20, chargingDaysPerMonth: 2 },
      })
    );
    try {
      solveCyclicEvYear(input, {
        initialEnergyKwh: 0,
        maxPasses: 1,
        energyAbsTolKwh: 1e-6,
      });
      expect.unreachable("expected solver guard to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(EvProfileError);
      expect((error as EvProfileError).code).toBe("SOLVER_NO_CONVERGENCE");
      expect((error as EvProfileError).kind).toBe("infeasible");
    }
  });
});
