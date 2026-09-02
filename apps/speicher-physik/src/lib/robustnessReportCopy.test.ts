import { describe, expect, it } from "vitest";
import {
  BDEW_STANDARDPROFIL_HINT,
  HOUSEHOLD_CONCLUSION_SENSITIVE,
  HOUSEHOLD_CONCLUSION_STABLE,
  HOUSEHOLD_CONCLUSION_UNCHANGED,
  HOUSEHOLD_ROBUSTNESS_QUESTION,
  WW_CONCLUSION_SENSITIVE,
  WW_CONCLUSION_STABLE,
  WW_HEAT_PUMP_DIFFER_EXPLANATION,
  WW_ROBUSTNESS_QUESTION,
  anonymizedProfileLabel,
  customerFacingTextHasInternalIds,
  formatReportRangeKwh,
  formatReportRangePct,
  householdDefaultViewText,
  householdRobustnessConclusion,
  householdRobustnessExplanation,
  recommendationSizeStability,
  shouldShowWwRobustnessSection,
  wwDefaultViewText,
  wwRobustnessConclusion,
  wwRobustnessExplanation,
} from "./robustnessReportCopy";

const HOUSEHOLD_RANGE = {
  technicalSizeKwh: 10,
  technicalSizeMinKwh: 9,
  technicalSizeMaxKwh: 10,
  eigenverbrauchsquotePct: 42.4,
  eigenverbrauchsquoteMinPct: 38.1,
  eigenverbrauchsquoteMaxPct: 47.2,
  autarkiePct: 35.6,
  autarkieMinPct: 31.0,
  autarkieMaxPct: 40.4,
};

describe("robustness section visibility", () => {
  it("A: no heat pump → household question only", () => {
    expect(shouldShowWwRobustnessSection(null)).toBe(false);
    expect(HOUSEHOLD_ROBUSTNESS_QUESTION).toMatch(/Haushalt/);
    expect(HOUSEHOLD_ROBUSTNESS_QUESTION).not.toMatch(/Wasser\/Wasser/);
  });

  it("B: Luft/Wasser → household question only (WW payload is null)", () => {
    expect(shouldShowWwRobustnessSection(null)).toBe(false);
  });

  it("C: Wasser/Wasser → household + WW question when payload is present", () => {
    expect(
      shouldShowWwRobustnessSection({ cohortSize: 24, sizeUnchangedCount: 22 })
    ).toBe(true);
    expect(WW_ROBUSTNESS_QUESTION).toMatch(/Wasser\/Wasser/);
  });
});

describe("data-driven ranges (D)", () => {
  it("formats min/max from the payload, not hardcoded numbers", () => {
    expect(formatReportRangeKwh(8.2, 12.4)).toBe("8–12 kWh");
    expect(formatReportRangeKwh(10, 10)).toBe("10 kWh");
    expect(formatReportRangePct(33.4, 41.4)).toBe("33–41 %");
    expect(formatReportRangePct(40, 40)).toBe("40 %");

    const text = householdDefaultViewText({
      cohortSize: 27,
      sizeUnchangedCount: 23,
      ...HOUSEHOLD_RANGE,
    });
    expect(text).toContain("9–10 kWh");
    expect(text).toContain("38–47 %");
    expect(text).toContain("31–40 %");
    expect(text).toContain("42 %");
    expect(text).toContain("36 %");
    expect(text).not.toContain("8–12 kWh");
  });
});

describe("conclusions follow calculated stability", () => {
  it("calls the size unchanged only when every profile keeps it", () => {
    expect(
      householdRobustnessConclusion({ cohortSize: 27, sizeUnchangedCount: 27 })
    ).toBe(HOUSEHOLD_CONCLUSION_UNCHANGED);
    expect(
      wwRobustnessConclusion({ cohortSize: 24, sizeUnchangedCount: 24 })
    ).toMatch(/unverändert/);
  });

  it("calls the size largely stable when a majority keeps it", () => {
    expect(recommendationSizeStability({ cohortSize: 27, sizeUnchangedCount: 23 })).toBe(
      "majority"
    );
    expect(
      householdRobustnessConclusion({ cohortSize: 27, sizeUnchangedCount: 23 })
    ).toBe(HOUSEHOLD_CONCLUSION_STABLE);
    expect(
      wwRobustnessConclusion({ cohortSize: 24, sizeUnchangedCount: 18 })
    ).toBe(WW_CONCLUSION_STABLE);
  });

  it("does not claim stability when the size moves for most profiles", () => {
    expect(
      householdRobustnessConclusion({ cohortSize: 27, sizeUnchangedCount: 10 })
    ).toBe(HOUSEHOLD_CONCLUSION_SENSITIVE);
    expect(
      wwRobustnessConclusion({ cohortSize: 24, sizeUnchangedCount: 8 })
    ).toBe(WW_CONCLUSION_SENSITIVE);
    expect(HOUSEHOLD_CONCLUSION_SENSITIVE).not.toMatch(/stabil/);
    expect(WW_CONCLUSION_SENSITIVE).not.toMatch(/stabil/);
  });
});

describe("customer-facing default view (E, F, G)", () => {
  it("E: frames the primary calculation as unchanged BDEW / WW reference", () => {
    const household = householdRobustnessExplanation(27).join(" ");
    expect(household).toMatch(/BDEW-H25/);
    expect(household).toMatch(/Hauptrechnung/);
    expect(household).toMatch(/27 gemessenen realen Haushaltsprofilen/);

    const ww = wwRobustnessExplanation(24).join(" ");
    expect(ww).toMatch(/Hauptrechnung/);
    expect(ww).toMatch(/24 weiteren gemessenen/);
    expect(ww).toMatch(/Haushaltsprofil/);
  });

  it("F: default copy has no internal house or profile IDs", () => {
    const household = householdDefaultViewText({
      cohortSize: 27,
      sizeUnchangedCount: 23,
      ...HOUSEHOLD_RANGE,
    });
    const ww = wwDefaultViewText({
      cohortSize: 24,
      sizeUnchangedCount: 20,
      technicalSizeKwh: 10,
      technicalSizeMinKwh: 10,
      technicalSizeMaxKwh: 12,
      eigenverbrauchsquotePct: 40,
      eigenverbrauchsquoteMinPct: 36,
      eigenverbrauchsquoteMaxPct: 44,
      autarkiePct: 33,
      autarkieMinPct: 29,
      autarkieMaxPct: 38,
    });

    expect(customerFacingTextHasInternalIds(household)).toBe(false);
    expect(customerFacingTextHasInternalIds(ww)).toBe(false);
    expect(household).not.toMatch(/SFH/i);
    expect(ww).not.toMatch(/SFH38/i);
    expect(ww).not.toMatch(/SFH4/i);
    expect(ww).not.toMatch(/cluster/i);
    expect(anonymizedProfileLabel(0)).toBe("Profil 1");
    expect(anonymizedProfileLabel(23)).toBe("Profil 24");
  });

  it("G: WW cause wording stays possible, not documented per house", () => {
    expect(WW_HEAT_PUMP_DIFFER_EXPLANATION).toMatch(/können/);
    expect(WW_HEAT_PUMP_DIFFER_EXPLANATION).toMatch(/Mögliche Einflüsse/);
    expect(WW_HEAT_PUMP_DIFFER_EXPLANATION).toMatch(
      /nicht für jedes Gebäude vollständig dokumentiert/
    );
    expect(WW_HEAT_PUMP_DIFFER_EXPLANATION).not.toMatch(/liefert für jedes/);
    expect(WW_HEAT_PUMP_DIFFER_EXPLANATION).not.toMatch(/Heizkurve jedes/);
  });

  it("does not open with Robustheitsprüfung, Validierung, P25 or Median", () => {
    expect(HOUSEHOLD_ROBUSTNESS_QUESTION.startsWith("Was ändert sich")).toBe(
      true
    );
    expect(WW_ROBUSTNESS_QUESTION.startsWith("Was ändert sich")).toBe(true);
    const combined = [
      HOUSEHOLD_ROBUSTNESS_QUESTION,
      ...householdRobustnessExplanation(27),
      WW_ROBUSTNESS_QUESTION,
      ...wwRobustnessExplanation(24),
    ].join("\n");
    expect(combined).not.toMatch(/Robustheitsprüfung/);
    expect(combined).not.toMatch(/Validierung/);
    expect(combined).not.toMatch(/\bP25\b/);
    expect(combined).not.toMatch(/\bMedian\b/);
  });

  it("BDEW hint stays short and does not invent a household count", () => {
    expect(BDEW_STANDARDPROFIL_HINT.length).toBeLessThan(280);
    expect(BDEW_STANDARDPROFIL_HINT).toMatch(/BDEW H25/);
    expect(BDEW_STANDARDPROFIL_HINT).toMatch(/Haushaltslastprofil/);
    expect(BDEW_STANDARDPROFIL_HINT).not.toMatch(/1000/);
    expect(BDEW_STANDARDPROFIL_HINT).not.toMatch(/\d+\s+Haushalt/);
  });
});
