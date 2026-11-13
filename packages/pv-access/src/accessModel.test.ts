import { describe, expect, it } from "vitest";

import {
  PAID_PLANS,
  PRIVATE_USE_LABEL,
  paidPlanById,
  SUBSCRIPTION_ADDRESS_LIMIT,
  SUBSCRIPTION_PRICE_CENTS,
  SUBSCRIPTION_PRICE_CURRENCY,
  VAT_INCLUDED_LABEL,
  accessDeniedMessage,
  paidPlanIdFromKey,
  paidPlanLabel,
  parseAccessDecision,
  parseAccessDeniedError,
  reportAccessKind,
  reportRequiresPrivateUseMarking,
} from "./accessModel";

describe("report access kind", () => {
  it("does not restrict any stored report to private use", () => {
    expect(reportRequiresPrivateUseMarking("free")).toBe(false);
    expect(reportRequiresPrivateUseMarking("paid")).toBe(false);
    expect(reportRequiresPrivateUseMarking(null)).toBe(false);
    expect(reportRequiresPrivateUseMarking(undefined)).toBe(false);
    expect(reportRequiresPrivateUseMarking("something-else")).toBe(false);
    expect(reportAccessKind(null)).toBe("legacy");
    expect(PRIVATE_USE_LABEL).toBe("Nur zur privaten Nutzung");
    expect(SUBSCRIPTION_ADDRESS_LIMIT).toBe(50);
    expect(SUBSCRIPTION_PRICE_CENTS).toBe(2975);
    expect(SUBSCRIPTION_PRICE_CURRENCY).toBe("eur");
    expect(PAID_PLANS.abo.addressLimit).toBe(50);
    expect(PAID_PLANS.abo.netCents).toBe(2500);
    expect(PAID_PLANS.abo.vatCents).toBe(475);
    expect(PAID_PLANS.abo.grossCents).toBe(2975);
    expect(PAID_PLANS.abo.priceLabel).toBe("29,75 €");
    expect(PAID_PLANS.pro.addressLimit).toBe(200);
    expect(PAID_PLANS.pro.netCents).toBe(5000);
    expect(PAID_PLANS.pro.grossCents).toBe(5950);
    expect(PAID_PLANS.pro.priceLabel).toBe("59,50 €");
    expect(PAID_PLANS.starter.addressLimit).toBe(10);
    expect(PAID_PLANS.starter.netCents).toBe(800);
    expect(PAID_PLANS.starter.vatCents).toBe(152);
    expect(PAID_PLANS.starter.grossCents).toBe(952);
    expect(PAID_PLANS.starter.priceLabel).toBe("9,52 €");
    expect(PAID_PLANS.starter.netLabel).toBe("8,00 €");
    expect(PAID_PLANS.starter.planKey).toBe("pvnavigator_starter");
    expect(PAID_PLANS.starter.priceEnvVar).toBe("STRIPE_PRICE_STARTER_ID");
    expect(paidPlanLabel("pvnavigator_monthly")).toBe("ABO");
    expect(paidPlanLabel(PAID_PLANS.pro.planKey)).toBe("PRO");
    expect(paidPlanLabel(PAID_PLANS.starter.planKey)).toBe("STARTER");
    expect(paidPlanIdFromKey(PAID_PLANS.abo.planKey)).toBe("abo");
    expect(paidPlanIdFromKey(PAID_PLANS.starter.planKey)).toBe("starter");
    expect(paidPlanIdFromKey("pvnavigator_monthly")).toBe("abo");
    expect(paidPlanIdFromKey("pvnavigator_custom")).toBeNull();
    expect(paidPlanIdFromKey("")).toBeNull();
    expect(paidPlanIdFromKey(null)).toBeNull();
    expect(paidPlanLabel("pvnavigator_custom")).toBeNull();
    expect(paidPlanById("starter")).toBe("starter");
    expect(paidPlanById("abo")).toBe("abo");
    expect(paidPlanById("pro")).toBe("pro");
    expect(paidPlanById("pvnavigator_starter")).toBeNull();
    expect(VAT_INCLUDED_LABEL).toBe("inkl. 19 % MwSt.");
    expect(VAT_INCLUDED_LABEL).not.toMatch(/§\s*19/);
  });
});

describe("parseAccessDecision", () => {
  it("reads the RPC JSON", () => {
    const decision = parseAccessDecision({
      allowed: true,
      tier: "paid",
      reason: "subscription_new_address",
      subscription: {
        period_id: "p1",
        period_end: "2026-11-01T00:00:00+00:00",
        address_limit: 50,
        used_addresses: 3,
      },
      free_address_label: null,
    });
    expect(decision).toEqual({
      allowed: true,
      tier: "paid",
      reason: "subscription_new_address",
      subscription: {
        periodId: "p1",
        periodEnd: "2026-11-01T00:00:00+00:00",
        addressLimit: 50,
        usedAddresses: 3,
      },
      freeAddressLabel: null,
    });
  });

  it("rejects unknown shapes", () => {
    expect(parseAccessDecision(null)).toBeNull();
    expect(parseAccessDecision({ allowed: "yes", reason: "free_address" })).toBeNull();
    expect(parseAccessDecision({ allowed: true, reason: "made_up" })).toBeNull();
  });
});

describe("parseAccessDeniedError", () => {
  it("extracts the reason from the RPC error message", () => {
    expect(parseAccessDeniedError("PVN_ACCESS_DENIED:free_address_mismatch")).toBe(
      "free_address_mismatch",
    );
    expect(parseAccessDeniedError("PVN_ACCESS_DENIED: subscription_limit_reached")).toBe(
      "subscription_limit_reached",
    );
    expect(parseAccessDeniedError("duplicate key value")).toBeNull();
    expect(parseAccessDeniedError(null)).toBeNull();
  });
});

describe("accessDeniedMessage", () => {
  it("explains the pinned free address in German", () => {
    const message = accessDeniedMessage({
      reason: "free_address_mismatch",
      freeAddressLabel: "Musterstraße 12, 80331 München",
      subscription: null,
    });
    expect(message).toContain("eine Adresse pro Konto");
    expect(message).toContain("„Musterstraße 12, 80331 München“");
    expect(message).toContain("STARTER, ABO oder PRO");
    expect(message).not.toContain("vorbereitet");
    expect(message).not.toMatch(/kaufen|bezahlen|Checkout/i);
  });

  it("explains an exhausted subscription quota without the free address", () => {
    const message = accessDeniedMessage({
      reason: "subscription_limit_reached",
      freeAddressLabel: "Musterstraße 12, 80331 München",
      subscription: {
        periodId: "p1",
        periodEnd: "2026-11-01T00:00:00+00:00",
        addressLimit: 50,
        usedAddresses: 50,
      },
    });
    expect(message).toContain("50 Adressen");
    expect(message).toContain("ausgeschöpft");
    expect(message).toContain("Nur neue Adressen");
    expect(message).not.toContain("kostenlose Adresse");
    expect(message).not.toContain("Musterstraße");
  });
});
