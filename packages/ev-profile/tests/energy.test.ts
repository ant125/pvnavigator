import { describe, expect, it } from "vitest";
import {
  createEvProfile,
  EV_ENERGY_ABS_TOL_KWH,
  EV_TIME_STEP_HOURS,
} from "../src/index";
import { buildEvModelDays } from "../src/calendar";
import { materializeHomeAvailability } from "../src/windows";
import { commuterInput, sum } from "./helpers";

describe("energy ledger and profile bounds", () => {
  it("satisfies conservation identities to a tight tolerance", () => {
    const result = createEvProfile(commuterInput());
    const { meta, profile } = result;
    expect(
      Math.abs(
        meta.workplaceDeclaredKwh -
          (meta.workplaceAcceptedKwh + meta.workplaceRejectedKwh)
      )
    ).toBeLessThanOrEqual(EV_ENERGY_ABS_TOL_KWH);
    expect(
      Math.abs(
        meta.annualDrivingDemandKwh -
          (meta.drivingServedKwh + meta.drivingUnservedKwh)
      )
    ).toBeLessThanOrEqual(EV_ENERGY_ABS_TOL_KWH);
    expect(
      Math.abs(
        meta.energyEndKwh -
          meta.energyStartKwh -
          (meta.workplaceAcceptedKwh + meta.homeChargedKwh - meta.drivingServedKwh)
      )
    ).toBeLessThanOrEqual(EV_ENERGY_ABS_TOL_KWH);
    expect(
      Math.abs(meta.homeChargedKwh + meta.workplaceAcceptedKwh - meta.drivingServedKwh)
    ).toBeLessThanOrEqual(EV_ENERGY_ABS_TOL_KWH);
    expect(Math.abs(sum(profile) - meta.homeChargedKwh)).toBeLessThanOrEqual(
      EV_ENERGY_ABS_TOL_KWH
    );
  });

  it("never charges outside availability or above the power ceiling", () => {
    const input = commuterInput();
    const result = createEvProfile(input);
    const availability = materializeHomeAvailability(
      buildEvModelDays(input.year),
      input.homeWindow
    );
    const maxSlot = input.maxHomeChargePowerKw * EV_TIME_STEP_HOURS;
    expect(result.profile).toHaveLength(35040);
    for (let i = 0; i < result.profile.length; i++) {
      const value = result.profile[i];
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(maxSlot + EV_ENERGY_ABS_TOL_KWH);
      if (!availability.mask[i]) {
        expect(value).toBe(0);
      }
    }
  });
});
