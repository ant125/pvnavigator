import { describe, expect, it } from "vitest";
import { buildAddressString } from "./buildAddressString";

describe("buildAddressString", () => {
  it("builds a German-style address with default country", () => {
    expect(
      buildAddressString({
        street: "Musterstraße",
        houseNumber: "12",
        postalCode: "86150",
        city: "Augsburg",
      })
    ).toBe("Musterstraße 12, 86150 Augsburg, Deutschland");
  });

  it("trims whitespace from address parts", () => {
    expect(
      buildAddressString({
        street: "  Musterstraße ",
        houseNumber: " 12 ",
        postalCode: " 86150 ",
        city: " Augsburg ",
      })
    ).toBe("Musterstraße 12, 86150 Augsburg, Deutschland");
  });

  it("uses a custom country when provided", () => {
    expect(
      buildAddressString({
        street: "Main Street",
        houseNumber: "1",
        postalCode: "10115",
        city: "Berlin",
        country: "Germany",
      })
    ).toBe("Main Street 1, 10115 Berlin, Germany");
  });

  it("returns an empty string when any required field is missing", () => {
    expect(
      buildAddressString({
        street: "",
        houseNumber: "12",
        postalCode: "86150",
        city: "Augsburg",
      })
    ).toBe("");
  });
});
