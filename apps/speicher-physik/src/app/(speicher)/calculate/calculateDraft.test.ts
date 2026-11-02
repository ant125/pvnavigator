import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearCalculateDraft, readCalculateDraft, writeCalculateDraft } from "./calculateDraft";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
});

afterEach(() => {
  clearCalculateDraft();
  vi.unstubAllGlobals();
});

describe("calculate draft", () => {
  it("round-trips the entered address without putting it in a URL", () => {
    writeCalculateDraft({
      formData: {
        street: "Nebenstraße",
        houseNumber: "4",
        postalCode: "80331",
        city: "München",
        annualConsumptionKwh: 4200,
        pvSurfaces: [{ systemSizeKwP: Number.NaN, tiltDeg: 30, azimuthDeg: 180 }],
      },
      kwpInputStrings: [""],
      azimuthInputStrings: ["180"],
      tiltInputStrings: ["30"],
    });
    const draft = readCalculateDraft();
    expect(draft?.formData.street).toBe("Nebenstraße");
    expect(draft?.formData.postalCode).toBe("80331");
    expect(draft?.formData.annualConsumptionKwh).toBe(4200);
    expect(draft?.kwpInputStrings).toEqual([""]);
    expect(Number.isNaN(draft?.formData.pvSurfaces?.[0]?.systemSizeKwP)).toBe(true);
    expect(store.get("pvn.speicher.calculateDraft.v1")).not.toContain("http");
  });
});