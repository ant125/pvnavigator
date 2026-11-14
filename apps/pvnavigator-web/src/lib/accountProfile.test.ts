import { describe, expect, it } from "vitest";

import { parseAccountProfileFields, profileNeedsCompletion, accountProfileFromRow } from "./accountProfile";

describe("account profile", () => {
  it("accepts a private person and drops a company name", () => {
    expect(parseAccountProfileFields({
      accountKind: "privat",
      givenName: " Ada ",
      familyName: "Lovelace",
      companyName: "Ignored",
    })).toEqual({
      accountKind: "privat",
      givenName: "Ada",
      familyName: "Lovelace",
      companyName: null,
    });
  });

  it("accepts an Unternehmen with its contact", () => {
    expect(parseAccountProfileFields({
      accountKind: "unternehmen",
      givenName: "Grace",
      familyName: "Hopper",
      companyName: " Analytical Engines GmbH ",
    })?.companyName).toBe("Analytical Engines GmbH");
  });

  it("rejects a missing type, a company without a name, and an e-mail used as a type", () => {
    expect(parseAccountProfileFields({
      accountKind: "firma@example.com",
      givenName: "Ada",
      familyName: "Lovelace",
      companyName: "",
    })).toBeNull();
    expect(parseAccountProfileFields({
      accountKind: "unternehmen",
      givenName: "Grace",
      familyName: "Hopper",
      companyName: " ",
    })).toBeNull();
    expect(parseAccountProfileFields({
      accountKind: null,
      givenName: "Ada",
      familyName: "Lovelace",
      companyName: "",
    })).toBeNull();
  });

  it("treats an empty stored profile as incomplete and a saved type as complete", () => {
    expect(profileNeedsCompletion(accountProfileFromRow(null))).toBe(true);
    expect(profileNeedsCompletion(accountProfileFromRow({
      account_kind: null,
      given_name: null,
      family_name: null,
      company_name: null,
    }))).toBe(true);
    expect(profileNeedsCompletion(accountProfileFromRow({
      account_kind: "unternehmen",
      given_name: "Grace",
      family_name: "Hopper",
      company_name: "Analytical Engines GmbH",
    }))).toBe(false);
  });
});
