import { describe, expect, it } from "vitest";
import {
  INITIAL_CALCULATION_PROGRESS,
  applyCalculationProgress,
  formatCalculationDurationDe,
  getCalculationProgressStages,
  isCalculationStageDone,
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

describe("getCalculationProgressStages", () => {
  it("omits ThermBuild unless a Luft/Wasser heat pump is selected", () => {
    expect(getCalculationProgressStages(false).map((stage) => stage.id)).toEqual(
      ["location", "pvgis", "consumption", "physics"]
    );
    expect(getCalculationProgressStages(true).map((stage) => stage.id)).toEqual(
      ["location", "pvgis", "heatpump", "consumption", "physics"]
    );
  });

  it("marks the ThermBuild row done with the consumption event", () => {
    let state = INITIAL_CALCULATION_PROGRESS;
    state = applyCalculationProgress(state, { stage: "location" });
    state = applyCalculationProgress(state, { stage: "pvgis" });

    expect(isCalculationStageDone("heatpump", state, false)).toBe(false);
    expect(isCalculationStageDone("consumption", state, false)).toBe(false);

    state = applyCalculationProgress(state, { stage: "consumption" });
    expect(isCalculationStageDone("heatpump", state, false)).toBe(true);
    expect(isCalculationStageDone("consumption", state, false)).toBe(true);
  });
});

describe("formatCalculationDurationDe", () => {
  it("formats measured milliseconds with a German decimal comma", () => {
    expect(formatCalculationDurationDe(27800)).toBe("27,8");
    expect(formatCalculationDurationDe(1000)).toBe("1,0");
  });
});
