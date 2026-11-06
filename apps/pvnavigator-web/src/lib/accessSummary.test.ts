import { describe, expect, it } from "vitest";

import { formatDateDe } from "@pv-access/core";

import {
  accessCardCopy,
  grantedPeriodPaymentLine,
  openSubscriptionCopy,
  billingPortalButtonLabel,
  blocksAnotherSubscription,
  canOpenBillingPortal,
  calculationAccessBadge,
  summarizeAccess,
  TARIFF_HINTS,
  tariffViewer,
  type AccessSummary,
  type StripeSubscriptionRow,
  type SubscriptionPeriodRow,
} from "./accessSummary";

const now = new Date("2026-10-12T20:00:00+02:00");

const active: SubscriptionPeriodRow = {
  id: "p-active",
  period_start: "2026-10-01T00:00:00+02:00",
  period_end: "2026-11-01T00:00:00+01:00",
  address_limit: 50,
};
const expired: SubscriptionPeriodRow = {
  id: "p-old",
  period_start: "2026-08-01T00:00:00+02:00",
  period_end: "2026-09-01T00:00:00+02:00",
  address_limit: 50,
};

describe("summarizeAccess", () => {
  it("shows the active period with its usage", () => {
    const summary = summarizeAccess({
      now,
      periods: [expired, active],
      usedAddressesByPeriod: { "p-active": 7, "p-old": 50 },
      freeAddress: null,
    });
    expect(summary).toEqual({
      kind: "subscription",
      planKey: "pvnavigator_monthly",
      usedAddresses: 7,
      addressLimit: 50,
      periodEnd: active.period_end,
      freeAddressLabel: null,
      scheduledPlanKey: null,
      scheduledEffectiveAt: null,
      billingStatus: null,
      cancelAtPeriodEnd: false,
      canManagePortal: false,
    });
  });

  it("falls back to free access once the period is over", () => {
    const summary = summarizeAccess({
      now,
      periods: [expired],
      usedAddressesByPeriod: { "p-old": 50 },
      freeAddress: { address_label: "Musterstraße 1, 80331 München", claimed_at: "2026-09-02T10:00:00Z" },
    });
    expect(summary).toEqual({
      kind: "free",
      freeAddressLabel: "Musterstraße 1, 80331 München",
      lastPeriodEnd: expired.period_end,
      billingStatus: null,
      cancelAtPeriodEnd: false,
      canManagePortal: false,
    });
  });

  it("treats the exact period end as no longer active", () => {
    const summary = summarizeAccess({
      now: new Date(active.period_end),
      periods: [active],
      usedAddressesByPeriod: {},
      freeAddress: null,
    });
    expect(summary.kind).toBe("free");
  });

  it("prefers the later-starting PRO period while the older ABO period still overlaps", () => {
    const abo: SubscriptionPeriodRow = {
      ...active,
      id: "abo",
      plan_key: "pvnavigator_abo",
      address_limit: 50,
      period_end: "2026-12-01T00:00:00+01:00",
    };
    const pro: SubscriptionPeriodRow = {
      id: "pro",
      plan_key: "pvnavigator_pro",
      period_start: "2026-10-12T18:00:00+02:00",
      period_end: "2026-10-20T00:00:00+02:00",
      address_limit: 200,
    };
    const summary = summarizeAccess({
      now,
      periods: [abo, pro],
      usedAddressesByPeriod: { abo: 12, pro: 0 },
      freeAddress: null,
    });
    expect(summary).toMatchObject({
      kind: "subscription",
      planKey: "pvnavigator_pro",
      addressLimit: 200,
      usedAddresses: 0,
      periodEnd: pro.period_end,
    });
  });

  it("keeps a STARTER period on its own key and 10-address limit", () => {
    const summary = summarizeAccess({
      now,
      periods: [{ ...active, id: "starter", plan_key: "pvnavigator_starter", address_limit: 10 }],
      usedAddressesByPeriod: { starter: 3 },
      freeAddress: null,
    });
    expect(summary).toMatchObject({
      kind: "subscription",
      planKey: "pvnavigator_starter",
      addressLimit: 10,
      usedAddresses: 3,
    });
    expect(accessCardCopy(summary).title).toBe("STARTER");
    expect(accessCardCopy(summary).lines[0]).toBe("3 von 10 Adressen in diesem Zeitraum genutzt");
    expect(accessCardCopy(summary).lines[1]).toBe("Noch 7 Adressen in diesem Zeitraum verfügbar.");
    expect(tariffViewer(true, summary)).toMatchObject({
      kind: "current_paid",
      plan: "starter",
      planKey: "pvnavigator_starter",
      addressLimit: 10,
    });
  });

  it("uses the later ABO or PRO period instead of the overlapping STARTER quota", () => {
    const starter: SubscriptionPeriodRow = {
      id: "starter",
      plan_key: "pvnavigator_starter",
      period_start: "2026-10-01T00:00:00+02:00",
      period_end: "2026-11-01T00:00:00+01:00",
      address_limit: 10,
    };
    const abo: SubscriptionPeriodRow = {
      id: "abo",
      plan_key: "pvnavigator_abo",
      period_start: "2026-10-12T18:00:00+02:00",
      period_end: "2026-11-12T18:00:00+01:00",
      address_limit: 50,
    };
    const aboSummary = summarizeAccess({
      now,
      periods: [starter, abo],
      usedAddressesByPeriod: { starter: 10, abo: 0 },
      freeAddress: null,
    });
    expect(aboSummary).toMatchObject({
      kind: "subscription",
      planKey: "pvnavigator_abo",
      addressLimit: 50,
      usedAddresses: 0,
    });
    expect(accessCardCopy(aboSummary).title).toBe("ABO");
    expect(tariffViewer(true, aboSummary)).toMatchObject({ plan: "abo", addressLimit: 50 });

    const proSummary = summarizeAccess({
      now,
      periods: [
        starter,
        {
          id: "pro",
          plan_key: "pvnavigator_pro",
          period_start: "2026-10-12T19:00:00+02:00",
          period_end: "2026-11-12T19:00:00+01:00",
          address_limit: 200,
        },
      ],
      usedAddressesByPeriod: { starter: 4, pro: 1 },
      freeAddress: null,
    });
    expect(proSummary).toMatchObject({
      kind: "subscription",
      planKey: "pvnavigator_pro",
      addressLimit: 200,
      usedAddresses: 1,
    });
    expect(accessCardCopy(proSummary).title).toBe("PRO");
  });

  it("does not read an unknown plan key as ABO", () => {
    const summary = summarizeAccess({
      now,
      periods: [{ ...active, plan_key: "pvnavigator_custom", address_limit: 10 }],
      usedAddressesByPeriod: { "p-active": 1 },
      freeAddress: null,
      billing: {
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
        current_period_end: active.period_end,
        scheduled_plan_key: "pvnavigator_other",
        scheduled_effective_at: "2026-11-01T00:00:00+01:00",
      },
    });
    expect(summary).toMatchObject({
      kind: "subscription",
      planKey: "pvnavigator_custom",
      addressLimit: 10,
      scheduledPlanKey: "pvnavigator_other",
    });
    const copy = accessCardCopy(summary);
    expect(copy.title).toBe("Bezahlter Zugang");
    expect(copy.title).not.toBe("ABO");
    expect(copy.lines.join("\n")).not.toContain("Wechsel zu ABO");
    expect(tariffViewer(true, summary)).toMatchObject({
      kind: "current_paid",
      plan: null,
      scheduledPlan: null,
    });
  });

  it("ignores a period that has not started", () => {
    const summary = summarizeAccess({
      now,
      periods: [{ ...active, id: "future", period_start: "2026-12-01T00:00:00+01:00", period_end: "2027-01-01T00:00:00+01:00" }],
      usedAddressesByPeriod: {},
      freeAddress: null,
    });
    expect(summary).toEqual({
      kind: "free",
      freeAddressLabel: null,
      lastPeriodEnd: null,
      billingStatus: null,
      cancelAtPeriodEnd: false,
      canManagePortal: false,
    });
  });
});

describe("accessCardCopy", () => {
  it("writes the subscription card in German without a payment flow", () => {
    const copy = accessCardCopy({
      kind: "subscription",
      planKey: "pvnavigator_monthly",
      usedAddresses: 7,
      addressLimit: 50,
      periodEnd: active.period_end,
      freeAddressLabel: null,
      scheduledPlanKey: null,
      scheduledEffectiveAt: null,
      billingStatus: "active",
      cancelAtPeriodEnd: false,
      canManagePortal: true,
    });
    expect(copy.title).toBe("ABO");
    expect(copy.lines[0]).toBe("7 von 50 Adressen in diesem Zeitraum genutzt");
    expect(copy.lines[1]).toBe("Noch 43 Adressen in diesem Zeitraum verfügbar.");
    expect(copy.lines[2]).toMatch(/^Bezahlter Zeitraum bis /);
    expect(copy.lines[3]).toMatch(/^Nächste Verlängerung am /);
    expect(copy.lines.join("\n")).not.toContain("Kostenlose Adresse");
    expect(copy.note).toBe(
      "Bereits verwendete Adressen können Sie beliebig oft mit anderen Einstellungen neu berechnen. Nur neue Adressen zählen zum Kontingent.",
    );
    expect(JSON.stringify(copy)).not.toMatch(/kaufen|bezahlen|Checkout|Stripe/i);
  });

  it("hides the pinned free address while a paid tariff is active", () => {
    const copy = accessCardCopy({
      kind: "subscription",
      planKey: "pvnavigator_starter",
      usedAddresses: 10,
      addressLimit: 10,
      periodEnd: active.period_end,
      freeAddressLabel: "Musterstraße 1, 80331 München",
      scheduledPlanKey: null,
      scheduledEffectiveAt: null,
      billingStatus: "active",
      cancelAtPeriodEnd: false,
      canManagePortal: true,
    });
    expect(copy.title).toBe("STARTER");
    expect(copy.lines.join("\n")).not.toContain("Kostenlose Adresse");
    expect(copy.lines.join("\n")).not.toContain("Musterstraße");
    expect(copy.lines[0]).toBe("10 von 10 Adressen in diesem Zeitraum genutzt");
    expect(copy.lines[1]).toBe("Noch 0 Adressen in diesem Zeitraum verfügbar.");
  });

  it("explains the free access and the pinned address", () => {
    const pinned = accessCardCopy({
      kind: "free",
      freeAddressLabel: "Musterstraße 1, 80331 München",
      lastPeriodEnd: null,
      billingStatus: null,
      cancelAtPeriodEnd: false,
      canManagePortal: false,
    });
    expect(pinned.title).toBe("Kostenloser Zugang");
    expect(pinned.lines[0]).toBe("Kostenlose Adresse: Musterstraße 1, 80331 München");
    expect(pinned.lines[1]).toContain("beliebig oft mit anderen Einstellungen");
    expect(pinned.lines[1]).toContain("Nur eine neue Adresse");
    expect(pinned.note).toBeNull();
    expect(JSON.stringify(pinned)).not.toMatch(/Abo|PDF|50/);

    const empty = accessCardCopy({
      kind: "free",
      freeAddressLabel: null,
      lastPeriodEnd: null,
      billingStatus: null,
      cancelAtPeriodEnd: false,
      canManagePortal: false,
    });
    expect(empty.lines).toEqual([
      "Berechnen und vergleichen Sie beliebig viele Varianten für eine Adresse.",
      "Die Adresse wird mit Ihrer ersten erfolgreichen Berechnung festgelegt.",
    ]);
    expect(empty.note).toBeNull();

    const expiredFree = accessCardCopy({
      kind: "free",
      freeAddressLabel: null,
      lastPeriodEnd: expired.period_end,
      billingStatus: null,
      cancelAtPeriodEnd: false,
      canManagePortal: false,
    });
    expect(expiredFree.lines.at(-1)).toContain("Abo abgelaufen am");
  });
});

describe("billing state", () => {
  const paid = {
    kind: "subscription" as const,
    planKey: "pvnavigator_pro",
    usedAddresses: 1,
    addressLimit: 200,
    periodEnd: active.period_end,
    freeAddressLabel: null,
    scheduledPlanKey: null,
    scheduledEffectiveAt: null,
    billingStatus: "active",
    cancelAtPeriodEnd: true,
    canManagePortal: true,
  };

  it("keeps the paid period when cancellation is scheduled and does not offer a second subscription", () => {
    const copy = accessCardCopy(paid);
    expect(copy.title).toBe("PRO");
    expect(copy.lines[0]).toBe("1 von 200 Adressen in diesem Zeitraum genutzt");
    expect(copy.lines.join(" ")).toMatch(/Kündigung zum /);
    expect(copy.lines.join(" ")).not.toMatch(/Nächste Verlängerung/);
    expect(blocksAnotherSubscription(paid)).toBe(true);
    expect(tariffViewer(true, paid).kind).toBe("current_paid");
  });

  it("describes a failed payment without opening an unpaid period", () => {
    const summary: AccessSummary = {
      kind: "free",
      freeAddressLabel: null,
      lastPeriodEnd: null,
      billingStatus: "incomplete",
      cancelAtPeriodEnd: false,
      canManagePortal: true,
    };
    const copy = accessCardCopy(summary);
    expect(copy.lines.at(-1)).toBe(
      "Die Zahlung ist nicht bestätigt. Es wurde kein bezahlter Zeitraum freigeschaltet.",
    );
    expect(copy.badge).toBe("Zahlung offen");
    expect(copy.lines.join(" ")).not.toContain("Zahlung fehlgeschlagen");
    expect(canOpenBillingPortal(summary)).toBe(true);
    expect(tariffViewer(true, summary)).toMatchObject({
      kind: "payment_open",
      billingStatus: "incomplete",
      canManage: true,
    });
    expect(tariffViewer(false, null).kind).toBe("guest");
  });
});

describe("canceled subscription and the paid-period boundary", () => {
  const periodEnd = "2026-11-11T19:37:00.000Z";
  const period: SubscriptionPeriodRow = {
    id: "p-cancel",
    plan_key: "pvnavigator_abo",
    period_start: "2026-10-11T19:37:00.000Z",
    period_end: periodEnd,
    address_limit: 50,
  };
  const canceled: StripeSubscriptionRow = {
    status: "canceled",
    cancel_at_period_end: false,
    cancel_at: periodEnd,
    current_period_end: periodEnd,
  };

  function at(now: Date) {
    return summarizeAccess({
      now,
      periods: [period],
      usedAddressesByPeriod: { "p-cancel": 1 },
      freeAddress: null,
      billing: canceled,
      canManagePortal: true,
    });
  }

  it("keeps the paid period before its end and does not announce a renewal", () => {
    const beforeEnd = new Date(new Date(periodEnd).getTime() - 1);
    const summary = at(beforeEnd);
    expect(summary.kind).toBe("subscription");
    if (summary.kind !== "subscription") return;
    expect(summary.addressLimit).toBe(50);
    expect(summary.usedAddresses).toBe(1);
    expect(summary.periodEnd).toBe(periodEnd);
    const copy = accessCardCopy(summary);
    expect(copy.lines).toContain(`Abonnement gekündigt. Zugang bis ${formatDateDe(periodEnd)}.`);
    expect(copy.lines.join(" ")).not.toMatch(/Nächste Verlängerung/);
    expect(copy.note).toMatch(/Nur neue Adressen zählen zum Kontingent/);
    expect(blocksAnotherSubscription(summary)).toBe(true);
  });

  it("ends paid access at the period end without a new paid period", () => {
    const summary = at(new Date(periodEnd));
    expect(summary.kind).toBe("free");
    if (summary.kind !== "free") return;
    expect(summary.lastPeriodEnd).toBe(periodEnd);
    const copy = accessCardCopy(summary);
    expect(copy.lines).toContain("Abonnement beendet. Keine automatische Verlängerung.");
    expect(copy.lines.join(" ")).toMatch(/gespeicherte Berichte bleiben verfügbar/);
    expect(copy.lines.join(" ")).not.toMatch(/Nächste Verlängerung/);
    expect(blocksAnotherSubscription(summary)).toBe(false);
  });

  it("shows the next renewal only while the subscription is still active", () => {
    const summary = summarizeAccess({
      now: new Date(new Date(periodEnd).getTime() - 1),
      periods: [period],
      usedAddressesByPeriod: { "p-cancel": 1 },
      freeAddress: null,
      billing: { ...canceled, status: "active", cancel_at: null, cancel_at_period_end: false },
    });
    const copy = accessCardCopy(summary);
    expect(copy.lines).toContain(`Nächste Verlängerung am ${formatDateDe(periodEnd)}.`);
    expect(copy.lines.join(" ")).not.toMatch(/Abonnement gekündigt|Abonnement beendet/);
  });
});

describe("tariff actions by subscription state", () => {
  const periodEnd = "2026-11-11T19:37:00.000Z";
  const period: SubscriptionPeriodRow = {
    id: "p-tariff",
    plan_key: "pvnavigator_abo",
    period_start: "2026-10-11T19:37:00.000Z",
    period_end: periodEnd,
    address_limit: 50,
  };
  const beforeEnd = new Date(new Date(periodEnd).getTime() - 1);

  function viewerFor(billing: StripeSubscriptionRow, now = beforeEnd) {
    return tariffViewer(
      true,
      summarizeAccess({
        now,
        periods: [period],
        usedAddressesByPeriod: { "p-tariff": 1 },
        freeAddress: null,
        billing,
        canManagePortal: true,
      }),
    );
  }

  it("keeps an active subscription on its plan and allows a later switch", () => {
    const viewer = viewerFor({
      status: "active",
      cancel_at_period_end: false,
      cancel_at: null,
      current_period_end: periodEnd,
    });
    expect(viewer).toMatchObject({
      kind: "current_paid",
      plan: "abo",
      cancelAtPeriodEnd: false,
      subscriptionCanceled: false,
      periodEnd,
    });
  });

  it("keeps a subscription that cancels at period end on its paid plan", () => {
    const viewer = viewerFor({
      status: "active",
      cancel_at_period_end: true,
      cancel_at: periodEnd,
      current_period_end: periodEnd,
    });
    expect(viewer).toMatchObject({
      kind: "current_paid",
      plan: "abo",
      cancelAtPeriodEnd: true,
      subscriptionCanceled: false,
      periodEnd,
    });
  });

  it("recognizes a canceled subscription while the paid period is still valid", () => {
    const viewer = viewerFor({
      status: "canceled",
      cancel_at_period_end: false,
      cancel_at: periodEnd,
      current_period_end: periodEnd,
    });
    expect(viewer).toMatchObject({
      kind: "current_paid",
      plan: "abo",
      cancelAtPeriodEnd: false,
      subscriptionCanceled: true,
      periodEnd,
    });
  });

  it("returns to the free tariff after a canceled period has ended", () => {
    const viewer = viewerFor(
      {
        status: "canceled",
        cancel_at_period_end: false,
        cancel_at: periodEnd,
        current_period_end: periodEnd,
      },
      new Date(periodEnd),
    );
    expect(viewer).toEqual({ kind: "current_free" });
  });

  it("shows PRO on the tariff page and in the account once the paid PRO period exists", () => {
    const summary = summarizeAccess({
      now: new Date("2026-10-16T16:00:00Z"),
      periods: [
        {
          id: "abo",
          plan_key: "pvnavigator_abo",
          period_start: "2026-10-01T00:00:00Z",
          period_end: "2026-11-01T00:00:00Z",
          address_limit: 50,
        },
        {
          id: "pro",
          plan_key: "pvnavigator_pro",
          period_start: "2026-10-16T15:00:00Z",
          period_end: "2026-11-16T15:00:00Z",
          address_limit: 200,
        },
      ],
      usedAddressesByPeriod: { abo: 35, pro: 0 },
      freeAddress: null,
      billing: {
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
        current_period_end: "2026-11-16T15:00:00Z",
      },
    });
    const viewer = tariffViewer(true, summary);
    const account = accessCardCopy(summary);
    expect(viewer).toMatchObject({
      kind: "current_paid",
      plan: "pro",
      planKey: "pvnavigator_pro",
      addressLimit: 200,
      usedAddresses: 0,
    });
    expect(account.title).toBe("PRO");
    expect(account.lines[0]).toContain("0 von 200");
  });
});

describe("checkout error hints", () => {
  it("keeps a failed or pending upgrade from sounding successful", () => {
    expect(TARIFF_HINTS["zahlung-fehler"]).toContain("unverändert");
    expect(TARIFF_HINTS["upgrade-ungueltig"]).toContain("unverändert");
    expect(TARIFF_HINTS["upgrade-ungueltig"]).toContain("STARTER");
    expect(TARIFF_HINTS["upgrade-ausstehend"]).toContain("unverändert");
    expect(TARIFF_HINTS["upgrade-ausstehend"]).toContain("bereits verarbeitet");
    expect(TARIFF_HINTS["upgrade-ausstehend"]).not.toMatch(/ist aktiv/);
    expect(TARIFF_HINTS["zahlung-fehler"]).not.toMatch(/PRO ist aktiv|freigeschaltet/);
    expect(TARIFF_HINTS).not.toHaveProperty("live-gesperrt");
    expect(TARIFF_HINTS.preis).toContain("STARTER ist 9 €");
    expect(TARIFF_HINTS.preis).toContain("ABO ist 29 €");
    expect(TARIFF_HINTS.preis).toContain("PRO ist 59 €");
  });
});

describe("billing portal permission", () => {
  function free(extra: Partial<Extract<AccessSummary, { kind: "free" }>> = {}): AccessSummary {
    return {
      kind: "free",
      freeAddressLabel: null,
      lastPeriodEnd: null,
      billingStatus: null,
      cancelAtPeriodEnd: false,
      canManagePortal: true,
      ...extra,
    };
  }

  function paid(planKey: string): AccessSummary {
    return {
      kind: "subscription",
      planKey,
      usedAddresses: 1,
      addressLimit: planKey === "pvnavigator_pro" ? 200 : 50,
      periodEnd: active.period_end,
      freeAddressLabel: null,
      scheduledPlanKey: null,
      scheduledEffectiveAt: null,
      billingStatus: "active",
      cancelAtPeriodEnd: false,
      canManagePortal: true,
    };
  }

  it("refuses a free account that only has a Stripe customer", () => {
    expect(canOpenBillingPortal(free())).toBe(false);
    expect(canOpenBillingPortal(free({ canManagePortal: false }))).toBe(false);
    expect(billingPortalButtonLabel(false, null)).toBe("Abo verwalten");
  });

  it("refuses an expired subscription", () => {
    const summary = free({ billingStatus: "canceled", lastPeriodEnd: expired.period_end });
    expect(blocksAnotherSubscription(summary)).toBe(false);
    expect(canOpenBillingPortal(summary)).toBe(false);
    expect(tariffViewer(true, summary)).toEqual({ kind: "current_free" });
  });

  it("allows ABO, PRO and a still-valid legacy monthly period", () => {
    expect(canOpenBillingPortal(paid("pvnavigator_abo"))).toBe(true);
    expect(canOpenBillingPortal(paid("pvnavigator_pro"))).toBe(true);
    expect(canOpenBillingPortal(paid("pvnavigator_monthly"))).toBe(true);
    expect(canOpenBillingPortal(paid("pvnavigator_starter"))).toBe(true);
    expect(accessCardCopy(paid("pvnavigator_monthly")).title).toBe("ABO");
    expect(accessCardCopy(paid("pvnavigator_starter")).title).toBe("STARTER");
    expect(accessCardCopy(paid("pvnavigator_custom")).title).toBe("Bezahlter Zugang");
    expect(tariffViewer(true, paid("pvnavigator_monthly"))).toMatchObject({
      kind: "current_paid",
      plan: "abo",
      planKey: "pvnavigator_monthly",
    });
    expect(billingPortalButtonLabel(true, "past_due")).toBe("Abo verwalten");
  });

  it("keeps the portal for a blocking status and names only real payment problems", () => {
    for (const status of ["active", "trialing", "paused"] as const) {
      const summary = free({ billingStatus: status });
      expect(canOpenBillingPortal(summary)).toBe(true);
      expect(blocksAnotherSubscription(summary)).toBe(true);
      expect(billingPortalButtonLabel(false, status)).toBe("Abo verwalten");
    }
    for (const status of ["past_due", "unpaid", "incomplete"] as const) {
      const summary = free({ billingStatus: status });
      expect(canOpenBillingPortal(summary)).toBe(true);
      expect(billingPortalButtonLabel(false, status)).toBe("Zahlungsproblem beheben");
    }
    const expiredPayment = free({ billingStatus: "incomplete_expired" });
    expect(canOpenBillingPortal(expiredPayment)).toBe(false);
    expect(blocksAnotherSubscription(expiredPayment)).toBe(false);
    expect(accessCardCopy(expiredPayment).lines.at(-1)).toContain("abgelaufen");
  });
});

describe("open subscription copy", () => {
  const pastDue =
    "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode, um Ihr Abonnement fortzusetzen.";

  it("uses one past_due message whether or not an earlier period existed", () => {
    const copy = openSubscriptionCopy("past_due");
    expect(copy).toEqual({ title: "Zahlung fehlgeschlagen", description: pastDue });
    for (const lastPeriodEnd of [null, "2026-09-30T00:00:00.000Z"]) {
      const card = accessCardCopy({
        kind: "free",
        freeAddressLabel: null,
        lastPeriodEnd,
        billingStatus: "past_due",
        cancelAtPeriodEnd: false,
        canManagePortal: true,
      });
      expect(card.badge).toBe("Zahlung fehlgeschlagen");
      expect(card.lines).toContain(pastDue);
      expect(card.lines.join(" ")).not.toContain("Es wurde kein bezahlter Zeitraum freigeschaltet.");
    }
  });

  it("keeps incomplete, unpaid, paused and trialing distinct from a failed charge", () => {
    const cases = [
      ["incomplete", "Zahlung nicht bestätigt", "nicht bestätigt"],
      ["unpaid", "Abonnement unbezahlt", "unbezahlt"],
      ["paused", "Abonnement pausiert", "pausiert"],
      ["trialing", "Testabo", "Testabo"],
    ] as const;
    for (const [status, title, fragment] of cases) {
      const copy = openSubscriptionCopy(status);
      expect(copy?.title).toBe(title);
      expect(copy?.description).toContain(fragment);
      expect(copy?.description).not.toContain("fehlgeschlagen");
      expect(copy?.title).not.toBe("Zahlung fehlgeschlagen");
    }
    expect(openSubscriptionCopy("active")?.description).toContain("bereits ein Abonnement");
    expect(openSubscriptionCopy("canceled")).toBeNull();
    expect(openSubscriptionCopy(null)).toBeNull();
  });

  it("does not call a still-paid period a failed charge unless the status is past_due", () => {
    const end = "2026-11-16T00:00:00.000Z";
    expect(grantedPeriodPaymentLine("past_due", end)).toContain("fehlgeschlagen");
    expect(grantedPeriodPaymentLine("past_due", end)).toContain("nutzb");
    for (const status of ["unpaid", "incomplete", "incomplete_expired"] as const) {
      expect(grantedPeriodPaymentLine(status, end)).not.toContain("fehlgeschlagen");
    }
    expect(grantedPeriodPaymentLine("paused", end)).toBeNull();
    expect(grantedPeriodPaymentLine("trialing", end)).toBeNull();
  });
});

describe("calculationAccessBadge", () => {
  it("labels free and paid rows and keeps legacy rows unlabelled", () => {
    expect(calculationAccessBadge("free")).toBe("Privat");
    expect(calculationAccessBadge("paid")).toBe("Abo");
    expect(calculationAccessBadge(null)).toBeNull();
    expect(calculationAccessBadge(undefined)).toBeNull();
  });
});
