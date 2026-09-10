import { describe, expect, it } from "vitest";
import { runPhysicalKernel } from "../../../../packages/pv-core";

/**
 * Characterization only: a huge household load vs a small PV yield leaves
 * almost no surplus. Eigenverbrauch then saturates across battery sizes.
 * That is valid physics — do not "fix" the kernel to force a slope.
 */
describe("high-load Eigenverbrauch saturation (characterization)", () => {
  it("does not invent a battery-size slope when surplus is ~0", () => {
    const hours = 8760;
    const load = new Array<number>(hours).fill(10);
    const pv = new Array<number>(hours).fill(0);
    for (let h = 0; h < hours; h++) {
      const hourOfDay = h % 24;
      if (hourOfDay >= 10 && hourOfDay < 14) pv[h] = 0.3;
    }

    const kernel = runPhysicalKernel({
      years: [2018],
      batterySizes: [5, 10, 30],
      getLoadForYear: () => load,
      getPvForYear: () => pv,
    });

    expect(kernel.averageGridExportKwh[5]).toBe(0);
    expect(kernel.average[5]).toBeCloseTo(kernel.average[30], 8);
    expect(kernel.averageBatteryChargedKwh[5]).toBeLessThan(5);
  });
});
