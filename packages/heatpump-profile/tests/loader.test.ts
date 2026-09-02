import { describe, expect, it } from "vitest";
import { getHeatPumpCatalogueEntry } from "../src/catalogue";
import { loadHeatPumpProfile } from "../src/loader";
import {
  HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR,
  type HeatPumpCatalogueEntry,
} from "../src/types";

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function requireEntry(profileId: string) {
  const entry = getHeatPumpCatalogueEntry(profileId);
  if (!entry) throw new Error(`missing catalogue row ${profileId}`);
  return entry;
}

describe("loadHeatPumpProfile", () => {
  it.each([
    "lw-heating-only-thermbuild-o5-v1",
    "lw-heating-dhw-thermbuild-n2-v1",
  ] as const)("%s: loads the immutable envelope without scaling", (profileId) => {
    const entry = requireEntry(profileId);
    const envelope = loadHeatPumpProfile(entry);

    expect(envelope.profileId).toBe(profileId);
    expect(envelope.steps).toBe(HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR);
    expect(envelope.weights).toHaveLength(HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR);
    expect(Math.abs(sum(envelope.weights) - 1)).toBeLessThanOrEqual(1e-12);
    expect(envelope.measuredAnnualElectricalKwh).toBeGreaterThan(0);
    expect(envelope.methodologySourceId).toBe(entry.methodologySourceId);
    expect(envelope.license).toBe(entry.license);
    expect(envelope.technology).toBe(entry.technology);
    expect(envelope.dhwService).toBe(entry.dhwService);
    expect(envelope.calendarAlignment.length).toBeGreaterThan(0);
    expect(envelope.seasonalShares.winter).toBeGreaterThanOrEqual(0);
    for (const w of envelope.weights) {
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not mutate catalogue metadata on the loaded envelope", () => {
    const entry = requireEntry("lw-heating-only-thermbuild-o5-v1");
    const envelope = loadHeatPumpProfile(entry);
    expect(envelope.quality).toBe("lab-prototype");
    expect(envelope.timeStepHours).toBe(0.25);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.calendarAlignment).toMatch(/consecutive_days/);
    expect(envelope.seasonalShares).toEqual(
      expect.objectContaining({
        winter: expect.any(Number),
        spring: expect.any(Number),
        summer: expect.any(Number),
        autumn: expect.any(Number),
      })
    );
    const shareSum =
      envelope.seasonalShares.winter +
      envelope.seasonalShares.spring +
      envelope.seasonalShares.summer +
      envelope.seasonalShares.autumn;
    expect(Math.abs(shareSum - 1)).toBeLessThanOrEqual(1e-5);
  });

  it("throws when no asset is bundled for the catalogue row", () => {
    const fake: HeatPumpCatalogueEntry = {
      profileId: "lw-missing-asset-v1",
      technology: "luftwasser",
      dhwService: "space_heat_only",
      quality: "lab-prototype",
      methodologySourceId: "thermbuild-fordatis-486",
      license: "CC-BY-SA-4.0",
      defaultFor: null,
    };
    expect(() => loadHeatPumpProfile(fake)).toThrow(/No production asset/);
  });
});
