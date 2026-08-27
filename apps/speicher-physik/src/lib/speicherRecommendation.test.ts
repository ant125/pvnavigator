import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLATEAU_DELTA_THRESHOLD_KWH,
  deriveRecommendedPlanningSize,
  deriveRecommendedTechnicalSize,
  getPhysicalKpiLookupSize,
  PLANNING_REMAINING_CAPACITY_FRACTION,
} from "./speicherRecommendation";

function chartPoints(
  deltas: Array<{ size: number; deltaEigenverbrauch: number }>
) {
  return deltas;
}

describe("deriveRecommendedTechnicalSize", () => {
  it("returns the previous size when the first delta is below 50", () => {
    const data = chartPoints([
      { size: 0, deltaEigenverbrauch: 0 },
      { size: 5, deltaEigenverbrauch: 120 },
      { size: 6, deltaEigenverbrauch: 45 },
      { size: 7, deltaEigenverbrauch: 30 },
    ]);
    expect(
      deriveRecommendedTechnicalSize({
        data,
        plateauDeltaThresholdKwh: DEFAULT_PLATEAU_DELTA_THRESHOLD_KWH,
      })
    ).toBe(5);
  });

  it("returns the final size when no delta is below 50", () => {
    const data = chartPoints([
      { size: 0, deltaEigenverbrauch: 0 },
      { size: 5, deltaEigenverbrauch: 120 },
      { size: 6, deltaEigenverbrauch: 80 },
      { size: 30, deltaEigenverbrauch: 55 },
    ]);
    expect(deriveRecommendedTechnicalSize({ data })).toBe(30);
  });

  it("returns 0 when the first battery point is below 50", () => {
    const data = chartPoints([
      { size: 0, deltaEigenverbrauch: 0 },
      { size: 5, deltaEigenverbrauch: 40 },
      { size: 6, deltaEigenverbrauch: 30 },
    ]);
    expect(deriveRecommendedTechnicalSize({ data })).toBe(0);
  });

  it("does not trigger at exactly 50 because the rule is strict < 50", () => {
    const data = chartPoints([
      { size: 0, deltaEigenverbrauch: 0 },
      { size: 5, deltaEigenverbrauch: 120 },
      { size: 6, deltaEigenverbrauch: 50 },
      { size: 7, deltaEigenverbrauch: 20 },
    ]);
    expect(deriveRecommendedTechnicalSize({ data })).toBe(6);
  });
});

describe("deriveRecommendedPlanningSize", () => {
  it("technical 9 kWh → planning 12 kWh", () => {
    expect(deriveRecommendedPlanningSize(9)).toBe(12);
  });

  it("technical 0 kWh → planning 0 kWh (no division)", () => {
    expect(deriveRecommendedPlanningSize(0)).toBe(0);
  });

  it("uses Math.ceil for non-integer division (8 / 0.75 = 10.666… → 11)", () => {
    expect(PLANNING_REMAINING_CAPACITY_FRACTION).toBe(0.75);
    expect(8 / PLANNING_REMAINING_CAPACITY_FRACTION).toBeCloseTo(10.666666, 5);
    expect(deriveRecommendedPlanningSize(8)).toBe(11);
    expect(deriveRecommendedPlanningSize(8)).toBe(
      Math.ceil(8 / PLANNING_REMAINING_CAPACITY_FRACTION)
    );
  });

  it.each([
    [0, 0],
    [6, 8],
    [8, 11],
    [9, 12],
    [10, 14],
    [22, 30],
    [23, 31],
    [30, 40],
  ])("technical %i kWh → planning %i kWh", (technical, planning) => {
    expect(deriveRecommendedPlanningSize(technical)).toBe(planning);
  });
});

describe("getPhysicalKpiLookupSize", () => {
  it("uses recommendedTechnicalSize, not recommendedPlanningSize", () => {
    const recommendedTechnicalSize = 9;
    const recommendedPlanningSize =
      deriveRecommendedPlanningSize(recommendedTechnicalSize);

    expect(recommendedPlanningSize).toBe(12);
    expect(getPhysicalKpiLookupSize(recommendedTechnicalSize)).toBe(9);
    expect(getPhysicalKpiLookupSize(recommendedTechnicalSize)).not.toBe(
      recommendedPlanningSize
    );
  });

  it("planning size does not enter physical KPI lookup", () => {
    const technical = 6;
    const planning = deriveRecommendedPlanningSize(technical);
    expect(planning).toBe(8);
    expect(getPhysicalKpiLookupSize(technical)).toBe(technical);
    expect(getPhysicalKpiLookupSize(technical)).not.toBe(planning);
  });
});
