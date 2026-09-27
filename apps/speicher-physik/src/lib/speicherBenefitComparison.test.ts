import { describe, expect, it } from "vitest";

import { deriveSpeicherBusinessMetrics } from "./deriveSpeicherBusinessMetrics";
import {
  buildSpeicherBenefitComparison,
  niceEnergyScaleMaxKwh,
} from "./speicherBenefitComparison";

describe("niceEnergyScaleMaxKwh", () => {
  it("ceilings 6 508 kWh to the next convenient 7 000", () => {
    expect(niceEnergyScaleMaxKwh(6508)).toBe(7000);
    expect(niceEnergyScaleMaxKwh(6508.6)).toBe(7000);
  });

  it("keeps a value that already sits on a convenient mark", () => {
    expect(niceEnergyScaleMaxKwh(7000)).toBe(7000);
    expect(niceEnergyScaleMaxKwh(1000)).toBe(1000);
    expect(niceEnergyScaleMaxKwh(2500)).toBe(2500);
    expect(niceEnergyScaleMaxKwh(1500)).toBe(1500);
  });

  it("steps up when the value is just above a mark", () => {
    expect(niceEnergyScaleMaxKwh(7000.1)).toBe(8000);
    expect(niceEnergyScaleMaxKwh(1000.1)).toBe(1500);
  });

  it("returns 0 for non-positive input so callers do not divide", () => {
    expect(niceEnergyScaleMaxKwh(0)).toBe(0);
    expect(niceEnergyScaleMaxKwh(-10)).toBe(0);
    expect(niceEnergyScaleMaxKwh(Number.NaN)).toBe(0);
    expect(niceEnergyScaleMaxKwh(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("buildSpeicherBenefitComparison", () => {
  it("sizes both energy bars on one scale from the unrounded kWh", () => {
    const model = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: 3109.4,
      eigenverbrauchMitKwh: 6508.6,
      autarkieOhneUnroundedPct: 31.4,
      autarkieMitUnroundedPct: 64.6,
    });

    expect(model.scaleMaxKwh).toBe(7000);
    expect(model.ohne.fillPercent).toBeCloseTo((3109.4 / 7000) * 100, 8);
    expect(model.mit.fillPercent).toBeCloseTo((6508.6 / 7000) * 100, 8);
    expect(model.ohne.fillPercent).not.toBe((3109 / 7000) * 100);
    expect(model.gainKwhRounded).toBe(3399);
    expect(Math.round(6508.6) - Math.round(3109.4)).toBe(3400);
  });

  it("rounds the grid share from the unrounded Autarkie, not from 100 minus the label", () => {
    const model = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: 1000,
      eigenverbrauchMitKwh: 2000,
      autarkieOhneUnroundedPct: 20,
      autarkieMitUnroundedPct: 64.5,
    });

    expect(model.autarkieMit.displayPct).toBe(65);
    expect(model.autarkieMit.solarPercent).toBe(64.5);
    expect(model.gridShareWithStorageRoundedPct).toBe(36);
    expect(100 - model.autarkieMit.displayPct!).toBe(35);
  });

  it("draws Autarkie 0 % and 100 % without inventing a remainder or a gap", () => {
    const empty = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: 0,
      eigenverbrauchMitKwh: 0,
      autarkieOhneUnroundedPct: 0,
      autarkieMitUnroundedPct: 0,
    });
    const full = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: 0,
      eigenverbrauchMitKwh: 4000,
      autarkieOhneUnroundedPct: 0,
      autarkieMitUnroundedPct: 100,
    });

    expect(empty.scaleMaxKwh).toBe(0);
    expect(empty.ohne.fillPercent).toBe(0);
    expect(empty.mit.fillPercent).toBe(0);
    expect(empty.gainKwhRounded).toBe(0);
    expect(Number.isFinite(empty.ohne.fillPercent)).toBe(true);
    expect(empty.autarkieMit.solarPercent).toBe(0);
    expect(empty.autarkieMit.displayPct).toBe(0);
    expect(empty.gridShareWithStorageRoundedPct).toBe(100);

    expect(full.autarkieMit.solarPercent).toBe(100);
    expect(full.autarkieMit.displayPct).toBe(100);
    expect(full.gridShareWithStorageRoundedPct).toBe(0);
    expect(full.mit.fillPercent).toBe(100);
  });

  it("does not replace missing results with zero", () => {
    const model = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: undefined,
      eigenverbrauchMitKwh: null,
      autarkieOhneUnroundedPct: undefined,
      autarkieMitUnroundedPct: null,
    });

    expect(model.scaleMaxKwh).toBeNull();
    expect(model.ohne.raw).toBeNull();
    expect(model.mit.raw).toBeNull();
    expect(model.ohne.fillPercent).toBeNull();
    expect(model.mit.fillPercent).toBeNull();
    expect(model.gainKwhRounded).toBeNull();
    expect(model.autarkieOhne.displayPct).toBeNull();
    expect(model.autarkieMit.solarPercent).toBeNull();
    expect(model.gridShareWithStorageRoundedPct).toBeNull();
  });

  it("keeps a real zero when the other scenario is present", () => {
    const model = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: 0,
      eigenverbrauchMitKwh: 5000,
      autarkieOhneUnroundedPct: 0,
      autarkieMitUnroundedPct: 50,
    });

    expect(model.scaleMaxKwh).toBe(5000);
    expect(model.ohne.raw).toBe(0);
    expect(model.ohne.fillPercent).toBe(0);
    expect(model.mit.fillPercent).toBe(100);
    expect(model.gainKwhRounded).toBe(5000);
    expect(model.autarkieOhne.displayPct).toBe(0);
  });

  it("ignores a missing scenario when choosing the energy scale", () => {
    const model = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: null,
      eigenverbrauchMitKwh: 2280,
      autarkieOhneUnroundedPct: null,
      autarkieMitUnroundedPct: 57,
    });

    expect(model.scaleMaxKwh).toBe(2500);
    expect(model.ohne.fillPercent).toBeNull();
    expect(model.mit.fillPercent).toBeCloseTo((2280 / 2500) * 100, 8);
    expect(model.gainKwhRounded).toBeNull();
    expect(model.gridShareWithStorageRoundedPct).toBe(43);
  });

  it("matches the rounded KPIs already published by the business metrics", () => {
    const metrics = deriveSpeicherBusinessMetrics({
      verifiedResult: {
        energy: { year: { selfConsumptionWithoutStorage: 2520, pvYieldKwhAnnual: 8000 } },
      },
      speicherGrenz: {
        batterySizes: [6],
        average: { 6: 3230 },
        averageLoadKwhAnnual: 5000,
        averageBatteryChargedKwh: {},
        averageBatteryDischargedKwh: {},
        averageDirectPvToHouseholdKwh: {},
        averageDirectPvToAuxiliaryKwh: {},
        averageBatteryToHouseholdKwh: {},
        averageBatteryToAuxiliaryKwh: {},
        averageGridToHouseholdKwh: {},
        averageGridToAuxiliaryKwh: {},
        averageGridExportKwh: {},
        averageAuxiliaryConsumptionKwh: {},
        averageChargeLossKwh: {},
        averageDischargeLossKwh: {},
        averageChargeLossPvToBatteryKwh: {},
        averageChargeLossChemicalKwh: {},
        averageDischargeLossChemicalKwh: {},
        averageDischargeLossBatteryToAcKwh: {},
        averageSocStartKwh: {},
        averageSocEndKwh: {},
        averageSocEndPct: {},
        averageEnergyBalanceErrorKwh: {},
        averageSelfDischargeLossKwh: {},
        averageSelfConsumptionWithoutStorageKwh: 2520,
        averagePvYieldKwhAnnual: 8000,
        batteryModelVersion: "test",
      },
      annualConsumptionKwh: 5000,
      heatPumpEnabled: false,
      heatPumpConsumptionKwh: undefined,
      backupReserveKwh: 0,
      totalKwPConfigured: 10,
    });

    const model = buildSpeicherBenefitComparison({
      eigenverbrauchOhneKwh: metrics.eigenverbrauchOhneSpeicher,
      eigenverbrauchMitKwh: metrics.eigenverbrauchMitSpeicher,
      autarkieOhneUnroundedPct: metrics.autarkieOhneUnroundedPct,
      autarkieMitUnroundedPct: metrics.autarkieMitUnroundedPct,
    });

    expect(model.gainKwhRounded).toBe(metrics.deltaEigenverbrauch);
    expect(model.autarkieOhne.displayPct).toBe(metrics.autarkieOhnePct);
    expect(model.autarkieMit.displayPct).toBe(metrics.autarkieMitPct);
    expect(model.autarkieMit.solarPercent).toBe(metrics.autarkieMitUnroundedPct);
  });
});
