import { describe, expect, it } from "vitest";

import {
  afterBoundaryEigenverbrauch,
  boundaryLabelLeft,
  formatAfterBoundaryEigenverbrauch,
  formatTechnicalBoundaryLabel,
  placeBoundaryLabel,
} from "./speicherChartCaption";

describe("afterBoundaryEigenverbrauch", () => {
  it("uses the last simulated point to the right and keeps the unrounded difference", () => {
    const gain = afterBoundaryEigenverbrauch(
      [
        { size: 0, eigenverbrauch: 900 },
        { size: 5, eigenverbrauch: 1000 },
        { size: 8, eigenverbrauch: 1400.2 },
        { size: 12, eigenverbrauch: 1480.4 },
        { size: 18, eigenverbrauch: 1510.6 },
      ],
      8,
    );

    expect(gain?.boundaryKwh).toBe(8);
    expect(gain?.lastSizeKwh).toBe(18);
    expect(gain?.additionalEigenverbrauchKwh).toBeCloseTo(110.4, 6);
    expect(formatAfterBoundaryEigenverbrauch(gain!)).toBe(
      "Von 8 auf 18\u00A0kWh: zusätzlich 110\u00A0kWh Solarstrom pro Jahr selbst genutzt.",
    );
    expect(formatAfterBoundaryEigenverbrauch(gain!)).not.toContain("110,4");
    expect(formatAfterBoundaryEigenverbrauch(gain!)).not.toContain("30");
  });

  it("rounds half up only in the sentence", () => {
    const gain = afterBoundaryEigenverbrauch(
      [
        { size: 6, eigenverbrauch: 2200.4 },
        { size: 7, eigenverbrauch: 2230.9 },
      ],
      6,
    );

    expect(gain?.additionalEigenverbrauchKwh).toBeCloseTo(30.5, 6);
    expect(formatAfterBoundaryEigenverbrauch(gain!)).toBe(
      "Von 6 auf 7\u00A0kWh: zusätzlich 31\u00A0kWh Solarstrom pro Jahr selbst genutzt.",
    );
  });

  it("hides the sentence when nothing was simulated beyond the boundary", () => {
    expect(
      afterBoundaryEigenverbrauch(
        [
          { size: 5, eigenverbrauch: 2100 },
          { size: 7, eigenverbrauch: 2280 },
        ],
        7,
      ),
    ).toBeNull();
  });

  it("does not invent a value when the boundary is not a simulated point", () => {
    expect(
      afterBoundaryEigenverbrauch(
        [
          { size: 5, eigenverbrauch: 2100 },
          { size: 10, eigenverbrauch: 2400 },
        ],
        8,
      ),
    ).toBeNull();
  });

  it("ignores a non-positive boundary", () => {
    expect(
      afterBoundaryEigenverbrauch(
        [
          { size: 5, eigenverbrauch: 2100 },
          { size: 10, eigenverbrauch: 2400 },
        ],
        0,
      ),
    ).toBeNull();
  });
});

describe("formatTechnicalBoundaryLabel", () => {
  it("names the boundary and its capacity", () => {
    expect(formatTechnicalBoundaryLabel(12)).toBe(
      "Technische Speichergrenze · 12\u00A0kWh",
    );
  });
});

describe("placeBoundaryLabel", () => {
  const labelWidth = 212;
  const boundsLeft = 64;
  const boundsRight = 460;

  function box(markerX: number) {
    const placement = placeBoundaryLabel({
      markerX,
      labelWidth,
      boundsLeft,
      boundsRight,
    });
    const left = boundaryLabelLeft(placement, labelWidth);
    return { ...placement, left, right: left + labelWidth };
  }

  it("centres the caption when the marker is in the middle", () => {
    const placed = box(260);
    expect(placed.textAnchor).toBe("middle");
    expect(placed.x).toBe(260);
    expect(placed.left).toBeGreaterThanOrEqual(boundsLeft);
    expect(placed.right).toBeLessThanOrEqual(boundsRight);
  });

  it("hangs the caption to the right of a marker near the left edge", () => {
    const placed = box(boundsLeft);
    expect(placed.textAnchor).toBe("start");
    expect(placed.left).toBeGreaterThanOrEqual(boundsLeft);
    expect(placed.right).toBeLessThanOrEqual(boundsRight);
  });

  it("hangs the caption to the left of a marker near the right edge", () => {
    const placed = box(boundsRight);
    expect(placed.textAnchor).toBe("end");
    expect(placed.left).toBeGreaterThanOrEqual(boundsLeft);
    expect(placed.right).toBeLessThanOrEqual(boundsRight);
  });

  it("stays inside a narrow mobile plot when the caption is almost as wide", () => {
    const placed = placeBoundaryLabel({
      markerX: 250,
      labelWidth: 218,
      boundsLeft: 56,
      boundsRight: 284,
    });
    const left = boundaryLabelLeft(placed, 218);
    expect(left).toBeGreaterThanOrEqual(56);
    expect(left + 218).toBeLessThanOrEqual(284);
  });
});
