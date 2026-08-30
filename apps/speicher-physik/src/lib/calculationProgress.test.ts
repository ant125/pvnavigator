import { describe, expect, it } from "vitest";
import {
  INITIAL_CALCULATION_PROGRESS,
  applyCalculationProgress,
  formatCalculationDurationDe,
} from "./calculationProgress";

describe("applyCalculationProgress", () => {
  it("advances only from backend events, not from a timer", () => {
    let state = INITIAL_CALCULATION_PROGRESS;
    expect(state.location).toBe(false);
    expect(state.physics).toBe(false);

    state = applyCalculationProgress(state, { stage: "location" });
    expect(state.location).toBe(true);
    expect(state.pvgis).toBe(false);

    state = applyCalculationProgress(state, { stage: "pvgis" });
    state = applyCalculationProgress(state, { stage: "consumption" });
    state = applyCalculationProgress(state, { stage: "physics" });
    expect(state.physics).toBe(true);
    expect(state.smartmeterCompleted).toBe(0);

    state = applyCalculationProgress(state, {
      stage: "smartmeter",
      completed: 18,
      total: 27,
    });
    expect(state.smartmeterCompleted).toBe(18);
    expect(state.smartmeterTotal).toBe(27);
  });
});

describe("formatCalculationDurationDe", () => {
  it("formats measured milliseconds with a German decimal comma", () => {
    expect(formatCalculationDurationDe(27800)).toBe("27,8");
    expect(formatCalculationDurationDe(1000)).toBe("1,0");
  });
});
