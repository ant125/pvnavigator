import { describe, expect, it } from "vitest";

import { PAID_PLANS } from "@pv-access/core";

import type { TariffViewer } from "@/lib/accessSummary";

import {
  canImmediateProUpgrade,
  claimSingleSubmit,
  claimUpgradeSubmit,
  immediateUpgradeOffer,
  immediateUpgradeDialogCopy,
  resetUpgradeSubmit,
} from "./upgradeDialogCopy";

const periodEnd = "2026-11-14T00:00:00.000Z";

function aboViewer(
  extra: Partial<Extract<TariffViewer, { kind: "current_paid" }>> = {},
): TariffViewer {
  return {
    kind: "current_paid",
    plan: "abo",
    planKey: PAID_PLANS.abo.planKey,
    usedAddresses: 35,
    addressLimit: 50,
    cancelAtPeriodEnd: false,
    subscriptionCanceled: false,
    periodEnd,
    paymentProblem: false,
    canManage: true,
    scheduledPlan: null,
    scheduledAt: null,
    ...extra,
  };
}

describe("immediate PRO upgrade offer", () => {
  it("offers the switch for an active ABO period", () => {
    expect(canImmediateProUpgrade(aboViewer())).toBe(true);
  });

  it("offers the switch when cancellation is scheduled", () => {
    expect(canImmediateProUpgrade(aboViewer({ cancelAtPeriodEnd: true }))).toBe(true);
  });

  it("offers the switch for a canceled ABO period that is still valid", () => {
    expect(canImmediateProUpgrade(aboViewer({ subscriptionCanceled: true }))).toBe(true);
  });

  it("keeps the legacy monthly plan key on its own rule", () => {
    expect(canImmediateProUpgrade(aboViewer({ planKey: "pvnavigator_monthly" }))).toBe(false);
  });

  it("does not offer the switch for PRO", () => {
    expect(
      canImmediateProUpgrade(
        aboViewer({ plan: "pro", planKey: PAID_PLANS.pro.planKey, addressLimit: 200 }),
      ),
    ).toBe(false);
  });

  it("describes each immediate upgrade once, from the tariff catalog", () => {
    const terms = [
      "Der neue Abrechnungszeitraum beginnt nach erfolgreicher Zahlung.",
      "Verbleibende Tage und ungenutzte Adressen Ihres bisherigen Tarifs werden nicht übertragen.",
      "Es erfolgt keine anteilige Verrechnung oder Rückerstattung.",
    ];
    const abo = immediateUpgradeDialogCopy({ current: "starter", target: "abo" });
    expect(abo.title).toBe("Zu ABO wechseln");
    expect(abo.currentLine).toBe(
      `${PAID_PLANS.starter.label} — ${PAID_PLANS.starter.priceLabel}/Monat, ${PAID_PLANS.starter.addressLimit} Adressen`,
    );
    expect(abo.nextLine).toBe(
      `${PAID_PLANS.abo.label} — ${PAID_PLANS.abo.priceLabel}/Monat, ${PAID_PLANS.abo.addressLimit} Adressen`,
    );
    expect(abo.dueLine).toBe(`Jetzt zu zahlen: ${PAID_PLANS.abo.priceLabel}`);
    expect(abo.confirmLabel).toBe(`Jetzt für ${PAID_PLANS.abo.priceLabel} zu ABO wechseln`);
    expect(abo.paragraphs).toEqual(terms);

    const pro = immediateUpgradeDialogCopy({ current: "starter", target: "pro" });
    expect(pro.currentLine).toBe(abo.currentLine);
    expect(pro.nextLine).toBe(
      `${PAID_PLANS.pro.label} — ${PAID_PLANS.pro.priceLabel}/Monat, ${PAID_PLANS.pro.addressLimit} Adressen`,
    );
    expect(pro.dueLine).toBe(`Jetzt zu zahlen: ${PAID_PLANS.pro.priceLabel}`);
    expect(pro.confirmLabel).toBe(`Jetzt für ${PAID_PLANS.pro.priceLabel} zu PRO wechseln`);
    expect(pro.paragraphs).toEqual(terms);

    const fromAbo = immediateUpgradeDialogCopy({ current: "abo", target: "pro" });
    expect(fromAbo.currentLine).toBe(
      `${PAID_PLANS.abo.label} — ${PAID_PLANS.abo.priceLabel}/Monat, ${PAID_PLANS.abo.addressLimit} Adressen`,
    );
    expect(fromAbo.nextLine).toBe(pro.nextLine);
    expect(fromAbo.dueLine).toBe(pro.dueLine);
    expect(fromAbo.paragraphs).toEqual(terms);
    expect(JSON.stringify(fromAbo)).not.toContain("Vollständige Zahlung");
    expect(JSON.stringify(fromAbo)).not.toContain("zunächst verwenden");
  });

  it("ignores a second confirmation while the first submit is in flight", () => {
    const lock = { current: false };
    expect(claimSingleSubmit(lock)).toBe(true);
    expect(claimSingleSubmit(lock)).toBe(false);
    expect(lock.current).toBe(true);
  });

  it("offers STARTER both immediate targets and keeps ABO on PRO only", () => {
    const starter = aboViewer({
      plan: "starter",
      planKey: PAID_PLANS.starter.planKey,
      addressLimit: 10,
      usedAddresses: 2,
    });
    expect(immediateUpgradeOffer(starter)).toEqual({ current: "starter", targets: ["abo", "pro"] });
    expect(
      immediateUpgradeOffer(aboViewer({ plan: "starter", planKey: PAID_PLANS.starter.planKey, subscriptionCanceled: true })),
    ).toEqual({ current: "starter", targets: ["abo", "pro"] });
    expect(immediateUpgradeOffer(aboViewer())).toEqual({ current: "abo", targets: ["pro"] });
    expect(canImmediateProUpgrade(aboViewer())).toBe(true);
    expect(immediateUpgradeOffer(aboViewer({ plan: "pro", planKey: PAID_PLANS.pro.planKey }))).toBeNull();
    expect(immediateUpgradeOffer({ kind: "current_free" })).toBeNull();
    expect(immediateUpgradeOffer({ kind: "guest" })).toBeNull();
  });

  it("refuses a second upgrade submit while the first is in flight", () => {
    resetUpgradeSubmit();
    expect(claimUpgradeSubmit()).toBe(true);
    expect(claimUpgradeSubmit()).toBe(false);
    resetUpgradeSubmit();
  });
});
