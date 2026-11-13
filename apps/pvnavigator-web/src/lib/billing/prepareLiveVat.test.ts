import { describe, expect, it } from "vitest";

import { footerCarriesKleinunternehmer, isExclusiveMonthlyNet } from "./prepareLiveVat";

describe("exclusive monthly net price", () => {
  const price = {
    id: "price_new",
    active: true,
    currency: "eur",
    unit_amount: 2500,
    tax_behavior: "exclusive",
    livemode: true,
    recurring: { interval: "month", interval_count: 1 },
  };

  it("accepts only the live exclusive monthly net amount", () => {
    expect(isExclusiveMonthlyNet(price, 2500)).toBe(true);
    expect(isExclusiveMonthlyNet({ ...price, unit_amount: 2900 }, 2500)).toBe(false);
    expect(isExclusiveMonthlyNet({ ...price, tax_behavior: "unspecified" }, 2500)).toBe(false);
    expect(isExclusiveMonthlyNet({ ...price, livemode: false }, 2500)).toBe(false);
    expect(isExclusiveMonthlyNet({ ...price, active: false }, 2500)).toBe(false);
    expect(isExclusiveMonthlyNet({ ...price, recurring: { interval: "year", interval_count: 1 } }, 2500)).toBe(false);
  });
});

describe("kleinunternehmer footer", () => {
  it("matches the current invoice notice and nothing else", () => {
    expect(footerCarriesKleinunternehmer("Umsatzsteuerbefreit gemäß § 19 UStG.")).toBe(true);
    expect(footerCarriesKleinunternehmer("Kleinunternehmerregelung")).toBe(true);
    expect(footerCarriesKleinunternehmer("")).toBe(false);
    expect(footerCarriesKleinunternehmer(null)).toBe(false);
    expect(footerCarriesKleinunternehmer("inkl. 19 % MwSt.")).toBe(false);
  });
});
