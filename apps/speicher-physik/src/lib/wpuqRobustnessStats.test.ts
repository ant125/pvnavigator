import { describe, expect, it } from "vitest";
import {
  buildEngineeringConclusion,
  buildWpuqRobustnessPayload,
  metricRange,
  percentile,
  sizeFrequency,
  type WpuqHouseKpis,
} from "./wpuqRobustnessStats";

function house(
  houseId: string,
  size: number,
  ev: number
): WpuqHouseKpis {
  return {
    houseId,
    technicalSpeichergrenzeKwh: size,
    eigenverbrauchKwh: ev,
    eigenverbrauchsquotePct: ev / 100,
    autarkiePct: ev / 50,
    netzbezugKwh: 5000 - ev,
    einspeisungKwh: 10000 - ev,
  };
}

describe("percentile", () => {
  it("interpolates linearly", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([10, 20, 30], 0)).toBe(10);
    expect(percentile([10, 20, 30], 100)).toBe(30);
  });
});

describe("sizeFrequency", () => {
  it("sorts by count then size, from current results only", () => {
    expect(sizeFrequency([9, 9, 9, 10, 10, 8])).toEqual([
      { sizeKwh: 9, householdCount: 3 },
      { sizeKwh: 10, householdCount: 2 },
      { sizeKwh: 8, householdCount: 1 },
    ]);
  });
});

describe("metricRange", () => {
  it("computes median, P25–P75 and min/max from the given values", () => {
    const range = metricRange([10, 20, 30, 40]);
    expect(range.min).toBe(10);
    expect(range.max).toBe(40);
    expect(range.median).toBe(25);
    expect(range.p25).toBe(17.5);
    expect(range.p75).toBe(32.5);
  });
});

describe("buildWpuqRobustnessPayload", () => {
  it("does not hardcode KPIs and writes a cautious conclusion when size varies", () => {
    const houses = [
      house("SFH1", 9, 4300),
      house("SFH2", 9, 4310),
      house("SFH3", 10, 4200),
    ];
    const payload = buildWpuqRobustnessPayload({
      houses,
      householdAnnualKwh: 5000,
      bdewTechnicalSizeKwh: 9,
    });

    expect(payload.cohortSize).toBe(3);
    expect(payload.sizeUnchangedCount).toBe(2);
    expect(payload.ranges.eigenverbrauchKwh.median).toBe(4300);
    expect(payload.conclusionParagraphs[0]).toContain(
      "bei 2 von 3 realen Haushaltsprofilen unverändert"
    );
    expect(payload.conclusionParagraphs.join(" ")).not.toMatch(/garantiert|optimal|beste/i);
  });
});

describe("buildEngineeringConclusion", () => {
  it("calls the recommendation robust only when a majority keeps the same size", () => {
    const majority = buildEngineeringConclusion({
      cohortSize: 27,
      sizeUnchangedCount: 23,
    });
    expect(majority.some((p) => p.includes("robust"))).toBe(true);

    const minority = buildEngineeringConclusion({
      cohortSize: 27,
      sizeUnchangedCount: 10,
    });
    expect(minority.some((p) => p.includes("robust"))).toBe(false);
    expect(minority.join(" ")).toContain("stärker vom Lastgang");
  });
});
