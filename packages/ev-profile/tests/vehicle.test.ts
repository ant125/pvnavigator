import { describe, expect, it } from "vitest";
import { createEvProfile, EvProfileError } from "../src/index";
import { commuterInput, evWindowUnavailable } from "./helpers";

describe("EV vehicle buffer", () => {
  it("never reports energy outside [0, capacity]", () => {
    const result = createEvProfile(commuterInput());
    expect(result.meta.energyStartKwh).toBeGreaterThanOrEqual(0);
    expect(result.meta.energyEndKwh).toBeGreaterThanOrEqual(0);
    expect(result.meta.energyStartKwh).toBeLessThanOrEqual(60);
    expect(result.meta.energyEndKwh).toBeLessThanOrEqual(60);
  });

  it("accounts for rejected workplace energy when the pack is full", () => {
    const result = createEvProfile(
      commuterInput({
        annualKm: 0,
        workplace: { enabled: true, kwhPerMonth: 40, chargingDaysPerMonth: 4 },
        homeWindow: {
          WD: evWindowUnavailable(),
          SA: evWindowUnavailable(),
          SU: evWindowUnavailable(),
        },
      })
    );
    expect(result.meta.workplaceDeclaredKwh).toBe(480);
    expect(result.meta.workplaceAcceptedKwh + result.meta.workplaceRejectedKwh).toBeCloseTo(
      480,
      9
    );
    expect(result.meta.workplaceRejectedKwh).toBeGreaterThan(0);
    expect(result.meta.energyStartKwh).toBeCloseTo(result.meta.energyEndKwh, 9);
    expect(result.meta.energyEndKwh).toBeCloseTo(60, 6);
  });

  it("fails when required driving energy cannot be served", () => {
    try {
      createEvProfile(
        commuterInput({
          usableBatteryCapacityKwh: 1,
          maxHomeChargePowerKw: 0,
          workplace: { enabled: false },
          homeWindow: {
            WD: evWindowUnavailable(),
            SA: evWindowUnavailable(),
            SU: evWindowUnavailable(),
          },
        })
      );
      expect.unreachable("expected unserved driving to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(EvProfileError);
      expect((error as EvProfileError).code).toBe("DRIVING_UNSERVED");
      expect((error as EvProfileError).kind).toBe("infeasible");
    }
  });
});
