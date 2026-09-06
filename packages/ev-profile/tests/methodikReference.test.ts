import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createEvProfile,
  EV_ENERGY_ABS_TOL_KWH,
  EV_SLOTS_PER_DAY,
  EV_TIME_STEP_HOURS,
  METHODIK_EV_REFERENCE_INPUT,
} from "../src/index";
import { buildEvModelDays } from "../src/calendar";
import { materializeHomeAvailability } from "../src/windows";
import { evClock, evWindowBounded, profileFingerprint, sum } from "./helpers";

const csvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/public/methodik/examples/ev-home-charging-profile-example.csv"
);

describe("Methodik v1 public reference", () => {
  it("rejects start === end instead of inferring a full day", () => {
    expect(() =>
      createEvProfile({
        ...METHODIK_EV_REFERENCE_INPUT,
        homeWindow: {
          ...METHODIK_EV_REFERENCE_INPUT.homeWindow,
          SA: evWindowBounded(evClock(10, 0), evClock(10, 0)),
        },
      })
    ).toThrow(/start === end/);
  });

  it("is deterministic, conserves energy, and never charges outside the window", () => {
    const first = createEvProfile(METHODIK_EV_REFERENCE_INPUT);
    const second = createEvProfile(METHODIK_EV_REFERENCE_INPUT);
    expect(profileFingerprint(first.profile)).toBe(
      profileFingerprint(second.profile)
    );
    expect(first.meta.annualDrivingDemandKwh).toBe(3150);
    expect(
      Math.abs(
        first.meta.annualDrivingDemandKwh -
          (first.meta.drivingServedKwh + first.meta.drivingUnservedKwh)
      )
    ).toBeLessThanOrEqual(EV_ENERGY_ABS_TOL_KWH);
    expect(
      Math.abs(
        first.meta.workplaceDeclaredKwh -
          (first.meta.workplaceAcceptedKwh + first.meta.workplaceRejectedKwh)
      )
    ).toBeLessThanOrEqual(EV_ENERGY_ABS_TOL_KWH);
    expect(Math.abs(sum(first.profile) - first.meta.homeChargedKwh)).toBeLessThanOrEqual(
      EV_ENERGY_ABS_TOL_KWH
    );

    const availability = materializeHomeAvailability(
      buildEvModelDays(METHODIK_EV_REFERENCE_INPUT.year),
      METHODIK_EV_REFERENCE_INPUT.homeWindow
    );
    const maxSlot =
      METHODIK_EV_REFERENCE_INPUT.maxHomeChargePowerKw * EV_TIME_STEP_HOURS;
    for (let i = 0; i < first.profile.length; i++) {
      if (!availability.mask[i]) {
        expect(first.profile[i]).toBe(0);
      }
      expect(first.profile[i]).toBeLessThanOrEqual(maxSlot + EV_ENERGY_ABS_TOL_KWH);
    }
  });

  it("does not create Saturday midnight charging for 10:00–16:00", () => {
    const result = createEvProfile(METHODIK_EV_REFERENCE_INPUT);
    const saturday = buildEvModelDays(2025).find(
      (day) => day.month === 1 && day.day === 11
    );
    expect(saturday?.dayType).toBe("SA");
    const offset = saturday!.dayIndex * EV_SLOTS_PER_DAY;
    expect(result.profile.slice(offset, offset + 40).every((value) => value === 0)).toBe(
      true
    );
    expect(result.profile.slice(offset + 40, offset + 64).some((value) => value > 0)).toBe(
      true
    );
    expect(result.profile.slice(offset + 64, offset + 96).every((value) => value === 0)).toBe(
      true
    );
  });

  it("matches the committed production reference CSV", () => {
    expect(existsSync(csvPath)).toBe(true);
    const result = createEvProfile(METHODIK_EV_REFERENCE_INPUT);
    const days = buildEvModelDays(METHODIK_EV_REFERENCE_INPUT.year);
    const expected = ["Date,Time,HomeCharging_kWh"];
    for (const day of days) {
      const iso = `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
      const offset = day.dayIndex * EV_SLOTS_PER_DAY;
      for (let slot = 0; slot < EV_SLOTS_PER_DAY; slot++) {
        const hour = Math.floor(slot / 4);
        const minute = (slot % 4) * 15;
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        expected.push(`${iso},${time},${result.profile[offset + slot]}`);
      }
    }
    expect(readFileSync(csvPath, "utf8")).toBe(`${expected.join("\n")}\n`);
    expect(result.meta.homeChargedKwh).toBeCloseTo(2618.795911849218, 8);
    expect(result.meta.workplaceAcceptedKwh).toBeCloseTo(531.2040881507498, 8);
    expect(result.meta.workplaceRejectedKwh).toBeCloseTo(908.7959118492504, 8);
    expect(result.meta.drivingUnservedKwh).toBe(0);
  });
});
