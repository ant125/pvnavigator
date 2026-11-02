import { describe, expect, it } from "vitest";

import {
  buildAddressKey,
  formatAddressLabel,
  normalizeHouseNumberForKey,
  normalizeStreetForKey,
} from "./addressKey";

const base = {
  street: "Musterstraße",
  houseNumber: "12",
  postalCode: "80331",
  city: "München",
};

describe("buildAddressKey", () => {
  it("ignores case and whitespace differences", () => {
    const key = buildAddressKey(base);
    expect(key).toBe("v1|de|80331|muenchen|musterstrasse|12");
    expect(buildAddressKey({ ...base, street: "  musterSTRASSE " })).toBe(key);
    expect(buildAddressKey({ ...base, city: "MÜNCHEN" })).toBe(key);
    expect(buildAddressKey({ ...base, houseNumber: " 12 " })).toBe(key);
    expect(buildAddressKey({ ...base, postalCode: " 80331" })).toBe(key);
  });

  it("folds umlauts and the Str. abbreviation", () => {
    const key = buildAddressKey(base);
    expect(buildAddressKey({ ...base, street: "Musterstr." })).toBe(key);
    expect(buildAddressKey({ ...base, street: "Musterstr" })).toBe(key);
    expect(buildAddressKey({ ...base, street: "Muster Str." })).toBe(key);
    expect(buildAddressKey({ ...base, street: "Muster Straße" })).toBe(key);
    expect(buildAddressKey({ ...base, city: "Muenchen" })).toBe(key);
  });

  it("keeps different house numbers apart, including letter suffixes", () => {
    const plain = buildAddressKey(base);
    const a = buildAddressKey({ ...base, houseNumber: "12a" });
    const b = buildAddressKey({ ...base, houseNumber: "12b" });
    const thirteen = buildAddressKey({ ...base, houseNumber: "13" });
    const range = buildAddressKey({ ...base, houseNumber: "12-14" });
    expect(new Set([plain, a, b, thirteen, range]).size).toBe(5);
    // Only spelling differences of the same number collapse.
    expect(buildAddressKey({ ...base, houseNumber: "12 A" })).toBe(a);
    expect(buildAddressKey({ ...base, houseNumber: "12 - 14" })).toBe(range);
    expect(buildAddressKey({ ...base, houseNumber: "12/14" })).toBe(range);
  });

  it("keeps different streets, postal codes and cities apart", () => {
    const key = buildAddressKey(base);
    expect(buildAddressKey({ ...base, street: "Musterweg" })).not.toBe(key);
    expect(buildAddressKey({ ...base, postalCode: "80333" })).not.toBe(key);
    expect(buildAddressKey({ ...base, city: "Augsburg" })).not.toBe(key);
  });

  it("refuses incomplete addresses instead of producing a half key", () => {
    expect(buildAddressKey({ ...base, houseNumber: "" })).toBe("");
    expect(buildAddressKey({ ...base, street: "   " })).toBe("");
    expect(buildAddressKey({ ...base, postalCode: "abc" })).toBe("");
    expect(buildAddressKey({ ...base, city: "" })).toBe("");
  });
});

describe("normalizers", () => {
  it("normalizes streets", () => {
    expect(normalizeStreetForKey("Hauptstr.")).toBe("hauptstrasse");
    expect(normalizeStreetForKey("Am Alten Bahnhof")).toBe("am alten bahnhof");
    expect(normalizeStreetForKey("Hans - Böckler-Straße")).toBe("hans-boeckler-strasse");
    expect(normalizeStreetForKey("Straße des 17. Juni")).toBe("strasse des 17 juni");
  });

  it("normalizes house numbers", () => {
    expect(normalizeHouseNumberForKey("12 a")).toBe("12a");
    expect(normalizeHouseNumberForKey("12A")).toBe("12a");
    expect(normalizeHouseNumberForKey("3 – 5")).toBe("3-5");
  });
});

describe("formatAddressLabel", () => {
  it("builds the readable label from the entered fields", () => {
    expect(formatAddressLabel({ ...base, street: " Musterstraße " })).toBe(
      "Musterstraße 12, 80331 München",
    );
  });
});
