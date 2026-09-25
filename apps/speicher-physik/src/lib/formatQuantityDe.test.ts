import { describe, expect, it } from "vitest";

import {
  formatQuantityDe,
  formatQuantityWithUnit,
} from "./formatQuantityDe";

const NNBSP = "\u202F";
const NBSP = "\u00A0";

describe("formatQuantityDe", () => {
  it("groups from four digits with a narrow no-break space and keeps the comma", () => {
    expect(formatQuantityDe(2937)).toBe(`2${NNBSP}937`);
    expect(formatQuantityDe(10900)).toBe(`10${NNBSP}900`);
    expect(formatQuantityDe(35040)).toBe(`35${NNBSP}040`);
    expect(formatQuantityDe(999)).toBe("999");
    expect(formatQuantityDe(990.9, 1)).toBe("990,9");
    expect(formatQuantityDe(70.5, 1)).toBe("70,5");
  });

  it("does not round an integer that is already the display value", () => {
    expect(formatQuantityDe(16)).toBe("16");
    expect(formatQuantityDe(4000)).toBe(`4${NNBSP}000`);
    expect(formatQuantityDe(4000.4)).toBe(`4${NNBSP}000,4`);
  });

  it("uses toFixed only when fraction digits replace an existing display rounding", () => {
    expect(formatQuantityDe(990.94, 1)).toBe("990,9");
    expect(formatQuantityDe(10.6, 0)).toBe("11");
  });

  it("keeps the unit with the number", () => {
    expect(formatQuantityWithUnit(2937, "kWh")).toBe(`2${NNBSP}937${NBSP}kWh`);
    expect(formatQuantityWithUnit(70.5, "s", 1)).toBe(`70,5${NBSP}s`);
  });
});
