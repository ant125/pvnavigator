import { describe, expect, it } from "vitest";
import { createEvProfile, EV_MODEL_VERSION } from "../src/index";
import { commuterInput, profileFingerprint, sum } from "./helpers";

/**
 * Frozen commuter reference for EV v1. Update only when the methodology
 * itself changes — not for numerical-guard tweaks that stay within
 * documented implementation epsilon.
 */
const GOLDEN = {
  year: 2018,
  fingerprint: "b8645f45",
  annualDrivingDemandKwh: 2700,
  impliedAnnualKmFromTypicalDistances: 12000,
  impliedAnnualKmFromYearCalendar: 12000,
  normalizationFactor: 1.25,
  yearNormalizationFactor: 1.25,
  workplaceDeclaredKwh: 960,
  workplaceAcceptedKwh: 864,
  workplaceRejectedKwh: 96,
  homeChargedKwh: 1836,
  drivingServedKwh: 2700,
  energyStartKwh: 60,
  energyEndKwh: 60,
  solverPasses: 3,
  dayCounts: { WD: 261, SA: 52, SU: 52 },
  steps: 35040,
};

describe("EV v1 golden regression", () => {
  it("matches the stable commuter reference", () => {
    const result = createEvProfile(commuterInput({ year: GOLDEN.year }));
    expect(result.meta.modelVersion).toBe(EV_MODEL_VERSION);
    expect(result.meta.calendarRemap).toBe(true);
    expect(result.profile).toHaveLength(GOLDEN.steps);
    expect(result.meta.annualDrivingDemandKwh).toBe(GOLDEN.annualDrivingDemandKwh);
    expect(result.meta.impliedAnnualKmFromTypicalDistances).toBe(
      GOLDEN.impliedAnnualKmFromTypicalDistances
    );
    expect(result.meta.normalizationFactor).toBe(GOLDEN.normalizationFactor);
    expect(result.meta.workplaceDeclaredKwh).toBe(GOLDEN.workplaceDeclaredKwh);
    expect(result.meta.workplaceAcceptedKwh).toBe(GOLDEN.workplaceAcceptedKwh);
    expect(result.meta.workplaceRejectedKwh).toBe(GOLDEN.workplaceRejectedKwh);
    expect(result.meta.homeChargedKwh).toBe(GOLDEN.homeChargedKwh);
    expect(result.meta.drivingServedKwh).toBe(GOLDEN.drivingServedKwh);
    expect(result.meta.energyStartKwh).toBe(GOLDEN.energyStartKwh);
    expect(result.meta.energyEndKwh).toBe(GOLDEN.energyEndKwh);
    expect(result.meta.solverPasses).toBe(GOLDEN.solverPasses);
    expect(result.meta.dayCounts).toEqual(GOLDEN.dayCounts);
    expect(result.meta.impliedAnnualKmFromYearCalendar).toBe(
      GOLDEN.impliedAnnualKmFromYearCalendar
    );
    expect(result.meta.yearNormalizationFactor).toBe(GOLDEN.yearNormalizationFactor);
    expect(Math.abs(sum(result.profile) - result.meta.homeChargedKwh)).toBeLessThan(
      1e-9
    );
    expect(result.meta.energyEndKwh).toBeCloseTo(result.meta.energyStartKwh, 9);
    expect(profileFingerprint(result.profile)).toBe(GOLDEN.fingerprint);
    expect(result.meta.homeChargedKwh).toBeGreaterThan(0);
    expect(result.meta.workplaceAcceptedKwh).toBeGreaterThan(0);
  });
});
