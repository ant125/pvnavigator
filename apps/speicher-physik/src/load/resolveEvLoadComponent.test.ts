import { describe, expect, it } from "vitest";
import { EvProfileError } from "@ev-profile/loader";
import { commuterEvInput, infeasibleEvInput, sum } from "@/test/evFixtures";
import {
  buildEvCalculationMeta,
  preflightEvLoadForYears,
  resolveEnabledEvConfig,
  resolveEvLoadComponentForYear,
} from "./resolveEvLoadComponent";

describe("resolveEnabledEvConfig", () => {
  it("returns null when EV is absent or disabled", () => {
    expect(resolveEnabledEvConfig(undefined)).toBeNull();
    expect(resolveEnabledEvConfig({ enabled: false })).toBeNull();
  });

  it("does not fabricate missing enabled fields", () => {
    expect(() =>
      resolveEnabledEvConfig({ enabled: true } as never)
    ).toThrow(/missing required fields/);
  });

  it("returns the package config without a year", () => {
    const input = commuterEvInput();
    const config = resolveEnabledEvConfig(input);
    expect(config).not.toBeNull();
    expect(config).not.toHaveProperty("enabled");
    expect(config).not.toHaveProperty("year");
    expect(config?.annualKm).toBe(15000);
  });
});

describe("resolveEvLoadComponentForYear", () => {
  it("wraps home charging as a 35040-step load component", () => {
    const result = resolveEvLoadComponentForYear({
      evInput: commuterEvInput(),
      year: 2018,
    });
    expect(result.component.name).toBe("ev");
    expect(result.component.profile).toHaveLength(35040);
    expect(result.meta.year).toBe(2018);
    expect(result.component.yearlyConsumption).toBe(result.meta.homeChargedKwh);
    expect(
      Math.abs(sum(result.component.profile) - result.component.yearlyConsumption)
    ).toBeLessThanOrEqual(1e-6);
  });

  it("creates a different series for years with different weekday calendars", () => {
    const evInput = commuterEvInput();
    const y2018 = resolveEvLoadComponentForYear({ evInput, year: 2018 });
    const y2019 = resolveEvLoadComponentForYear({ evInput, year: 2019 });
    expect(y2018.component.profile).not.toEqual(y2019.component.profile);
    expect(y2018.meta.year).toBe(2018);
    expect(y2019.meta.year).toBe(2019);
    expect(y2018.meta.annualDrivingDemandKwh).toBe(
      y2019.meta.annualDrivingDemandKwh
    );
  });
});

describe("preflightEvLoadForYears", () => {
  it("accepts a feasible commuter configuration", () => {
    expect(() =>
      preflightEvLoadForYears({
        evInput: commuterEvInput(),
        years: [2018, 2019],
      })
    ).not.toThrow();
  });

  it("fails an infeasible configuration via the package API", () => {
    try {
      preflightEvLoadForYears({
        evInput: infeasibleEvInput(),
        years: [2018],
      });
      throw new Error("expected preflight to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(EvProfileError);
      expect((error as EvProfileError).kind).toBe("infeasible");
      expect((error as EvProfileError).code).toBe("DRIVING_UNSERVED");
    }
  });
});

describe("buildEvCalculationMeta", () => {
  it("aggregates home and workplace energy as multi-year means", () => {
    const evInput = commuterEvInput();
    const y2018 = resolveEvLoadComponentForYear({ evInput, year: 2018 });
    const y2019 = resolveEvLoadComponentForYear({ evInput, year: 2019 });
    const meta = buildEvCalculationMeta(
      { 2018: y2018.meta, 2019: y2019.meta },
      [2018, 2019],
      evInput
    );

    expect(meta.typicalDailyKm).toEqual({ WD: 40, SA: 20, SU: 10 });
    expect(meta.annualDrivingDemandKwh).toBe(y2018.meta.annualDrivingDemandKwh);
    expect(meta.annualDrivingDemandKwh).toBe(y2019.meta.annualDrivingDemandKwh);
    expect(meta.averageHomeChargedKwh).toBeCloseTo(
      (y2018.meta.homeChargedKwh + y2019.meta.homeChargedKwh) / 2,
      12
    );
    expect(meta.averageWorkplaceAcceptedKwh).toBeCloseTo(
      (y2018.meta.workplaceAcceptedKwh + y2019.meta.workplaceAcceptedKwh) / 2,
      12
    );
    expect(meta.averageWorkplaceRejectedKwh).toBeCloseTo(
      (y2018.meta.workplaceRejectedKwh + y2019.meta.workplaceRejectedKwh) / 2,
      12
    );
  });
});
