import { describe, expect, it } from "vitest";
import {
  INITIAL_CALCULATION_PROGRESS,
  WW_ROBUSTNESS_PROFILE_COUNT,
  applyCalculationProgress,
  formatCalculationDurationDe,
  getCalculationProgressStages,
  isCalculationStageDone,
  isHouseholdValidationComplete,
  isWwValidationComplete,
  shouldShowWwValidationStage,
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
    expect(isHouseholdValidationComplete(state, false)).toBe(false);
    expect(state.wwCompleted).toBe(0);
    expect(state.wwTotal).toBe(0);

    state = applyCalculationProgress(state, {
      stage: "wwprofiles",
      completed: 7,
      total: WW_ROBUSTNESS_PROFILE_COUNT,
    });
    expect(state.wwCompleted).toBe(7);
    expect(state.wwTotal).toBe(24);
    expect(state.smartmeterCompleted).toBe(27);
    expect(isHouseholdValidationComplete(state, false)).toBe(true);
    expect(isWwValidationComplete(state, false)).toBe(false);

    state = applyCalculationProgress(state, {
      stage: "wwprofiles",
      completed: 24,
      total: 24,
    });
    expect(isWwValidationComplete(state, false)).toBe(true);
  });
});

describe("getCalculationProgressStages", () => {
  it("omits the heat-pump row unless a production heat pump is selected", () => {
    expect(getCalculationProgressStages(false).map((stage) => stage.id)).toEqual(
      ["location", "pvgis", "consumption", "physics"]
    );
    expect(
      getCalculationProgressStages("luftwasser").map((stage) => stage.id)
    ).toEqual(["location", "pvgis", "heatpump", "consumption", "physics"]);
    expect(
      getCalculationProgressStages("wasserwasser").map((stage) => stage.id)
    ).toEqual(["location", "pvgis", "heatpump", "consumption", "physics"]);
  });

  it("uses ThermBuild wording for Luft/Wasser and Wasser/Wasser wording for WW", () => {
    const luft = getCalculationProgressStages("luftwasser").find(
      (stage) => stage.id === "heatpump"
    );
    const wasser = getCalculationProgressStages("wasserwasser").find(
      (stage) => stage.id === "heatpump"
    );
    expect(luft?.active).toBe("ThermBuild-Wärmepumpenprofil wird geladen");
    expect(wasser?.active).toBe("Wasser/Wasser-Wärmepumpenprofil wird geladen");
    expect(wasser?.active).not.toMatch(/WPuQ/i);
    expect(wasser?.done).not.toMatch(/WPuQ/i);
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

describe("WW validation stage visibility", () => {
  it("shows the WW loading stage only for Wasser/Wasser", () => {
    expect(shouldShowWwValidationStage(false)).toBe(false);
    expect(shouldShowWwValidationStage("luftwasser")).toBe(false);
    expect(shouldShowWwValidationStage("wasserwasser")).toBe(true);
  });
});
