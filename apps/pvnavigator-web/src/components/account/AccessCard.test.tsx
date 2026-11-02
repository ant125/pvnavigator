import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CalculationsHistory } from "@/components/account/CalculationsHistory";

import { AccessCard } from "./AccessCard";

describe("AccessCard", () => {
  it("renders the free access with the pinned address and a link to the tariffs", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "free",
          freeAddressLabel: "Musterstraße 1, 80331 München",
          lastPeriodEnd: null,
          billingStatus: null,
          cancelAtPeriodEnd: false,
          canManagePortal: false,
        }}
      />,
    );
    expect(html).toContain("Kostenloser Zugang");
    expect(html).toContain("Kostenlose Adresse: Musterstraße 1, 80331 München");
    expect(html).toContain("beliebig oft mit anderen Einstellungen");
    expect(html).not.toContain("PVNAVIGATOR_ Abos");
    expect(html).toContain("Tarife ansehen");
    expect(html).toContain('href="/tarife"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Abo verwalten");
    expect(html).not.toMatch(/kaufen|bezahlen|Checkout|Stripe/i);
  });

  it("keeps a free account with a Stripe customer on the tariff link", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "free",
          freeAddressLabel: "Musterstraße 1, 80331 München",
          lastPeriodEnd: null,
          billingStatus: null,
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("Kostenloser Zugang");
    expect(html).toContain("Kostenlose Adresse: Musterstraße 1, 80331 München");
    expect(html).toContain('href="/tarife"');
    expect(html).toContain("Tarife ansehen");
    expect(html).not.toContain("Abo verwalten");
    expect(html).not.toContain("/api/billing/portal");
    expect(html).not.toContain("Zu PRO wechseln");
  });

  it("returns an expired subscription to the free tariff link", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "free",
          freeAddressLabel: null,
          lastPeriodEnd: "2026-09-01T00:00:00+02:00",
          billingStatus: "canceled",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("Kostenloser Zugang");
    expect(html).toContain("Abo abgelaufen am");
    expect(html).toContain("Abonnement beendet");
    expect(html).toContain('href="/tarife"');
    expect(html).not.toContain("/api/billing/portal");
    expect(html).not.toContain("Zu PRO wechseln");
    expect(html).not.toContain("Zu ABO wechseln");
  });

  it("renders the subscription usage and the end of the paid period", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "subscription",
          planKey: "pvnavigator_abo",
          usedAddresses: 12,
          addressLimit: 50,
          periodEnd: "2026-11-01T00:00:00+01:00",
          freeAddressLabel: null,
          scheduledPlanKey: "pvnavigator_pro",
          scheduledEffectiveAt: "2026-11-01T00:00:00+01:00",
          billingStatus: "active",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("ABO");
    expect(html).toContain("12 von 50 Adressen in diesem Zeitraum genutzt");
    expect(html).toContain("Wechsel zu PRO am");
    expect(html).toContain("Bezahlter Zeitraum bis");
    expect(html).toContain("Nächste Verlängerung");
    expect(html).toContain("Abo verwalten");
    expect(html).toContain('action="/api/billing/portal"');
    expect(html).toContain("Zu PRO wechseln");
    expect(html).toContain('action="/api/billing/upgrade"');
    expect(html).toContain('data-testid="immediate-pro-upgrade"');
    expect(html).toContain("Alle Tarife ansehen");
    expect(html).toContain('href="/tarife"');
    expect(html).not.toMatch(/Checkout|Stripe/i);
    expect(html).toContain("2026");
  });

  it("shows a paid STARTER period with its remaining addresses and the portal", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "subscription",
          planKey: "pvnavigator_starter",
          usedAddresses: 4,
          addressLimit: 10,
          periodEnd: "2026-11-01T00:00:00+01:00",
          freeAddressLabel: "Musterstraße 1, 80331 München",
          scheduledPlanKey: null,
          scheduledEffectiveAt: null,
          billingStatus: "active",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("STARTER");
    expect(html).not.toContain("Kostenlose Adresse");
    expect(html).not.toContain("Musterstraße");
    expect(html).not.toContain(">ABO<");
    expect(html).toContain("4 von 10 Adressen in diesem Zeitraum genutzt");
    expect(html).toContain("Noch 6 Adressen in diesem Zeitraum verfügbar.");
    expect(html).toContain("Bezahlter Zeitraum bis");
    expect(html).toContain("Nächste Verlängerung");
    expect(html).toContain("Abo verwalten");
    expect(html).toContain('action="/api/billing/portal"');
    expect(html).toContain("Zu ABO wechseln");
    expect(html).toContain("Zu PRO wechseln");
    expect(html).toContain('data-testid="immediate-starter-abo-upgrade"');
    expect(html).toContain('data-testid="immediate-starter-pro-upgrade"');
    expect(html).toContain('name="plan" value="abo"');
    expect(html).toContain('name="plan" value="pro"');
    expect(html).toContain("Jetzt zu zahlen: 29 €");
    expect(html).toContain("Jetzt zu zahlen: 59 €");
    expect(html).toContain("STARTER — 9 €/Monat, 10 Adressen");
    expect(html).toContain("ABO — 29 €/Monat, 50 Adressen");
    expect(html).toContain("PRO — 59 €/Monat, 200 Adressen");
    expect(html).toContain("Es erfolgt keine anteilige Verrechnung oder Rückerstattung.");
    expect(html).not.toContain("Vollständige Zahlung");
    expect(html).not.toContain('data-testid="immediate-pro-upgrade"');
    expect(html).toContain("Alle Tarife ansehen");
    expect(html).toContain('href="/tarife"');
  });

  it("keeps PRO on portal management without an upgrade", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "subscription",
          planKey: "pvnavigator_pro",
          usedAddresses: 4,
          addressLimit: 200,
          periodEnd: "2026-11-01T00:00:00+01:00",
          freeAddressLabel: null,
          scheduledPlanKey: null,
          scheduledEffectiveAt: null,
          billingStatus: "active",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("PRO");
    expect(html).toContain("4 von 200 Adressen in diesem Zeitraum genutzt");
    expect(html).toContain("Nächste Verlängerung");
    expect(html).toContain("Abo verwalten");
    expect(html).toContain('action="/api/billing/portal"');
    expect(html).not.toContain("Zu PRO wechseln");
    expect(html).not.toContain("/api/billing/upgrade");
    expect(html).toContain("Alle Tarife ansehen");
    expect(html).toContain('href="/tarife"');
    expect(html).not.toContain("Kostenlose Adresse");
  });

  it("keeps a legacy monthly period manageable and does not offer the PRO switch", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "subscription",
          planKey: "pvnavigator_monthly",
          usedAddresses: 2,
          addressLimit: 50,
          periodEnd: "2026-11-01T00:00:00+01:00",
          freeAddressLabel: null,
          scheduledPlanKey: null,
          scheduledEffectiveAt: null,
          billingStatus: "active",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("ABO");
    expect(html).toContain("2 von 50 Adressen");
    expect(html).toContain("Nächste Verlängerung");
    expect(html).toContain("Abo verwalten");
    expect(html).not.toContain("Zu PRO wechseln");
    expect(html).not.toContain("/api/billing/upgrade");
  });

  it("shows a canceled subscription as ended access, not as the next renewal", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "subscription",
          planKey: "pvnavigator_abo",
          usedAddresses: 1,
          addressLimit: 50,
          periodEnd: "2026-11-11T19:37:00.000Z",
          freeAddressLabel: null,
          scheduledPlanKey: null,
          scheduledEffectiveAt: null,
          billingStatus: "canceled",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("Abonnement gekündigt. Zugang bis");
    expect(html).toContain("Nur neue Adressen zählen zum Kontingent");
    expect(html).toContain("Alle Tarife ansehen");
    expect(html).toContain("Zu PRO wechseln");
    expect(html).toContain('action="/api/billing/upgrade"');
    expect(html).not.toContain("Nächste Verlängerung");
  });

  it("opens the portal for an unconfirmed payment and does not offer another tariff", () => {
    const html = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "free",
          freeAddressLabel: "Musterstraße 1, 80331 München",
          lastPeriodEnd: null,
          billingStatus: "incomplete",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(html).toContain("Kostenloser Zugang");
    expect(html).toContain("Kostenlose Adresse: Musterstraße 1, 80331 München");
    expect(html).toContain("Zahlung offen");
    expect(html).toContain("Die Zahlung ist nicht bestätigt.");
    expect(html).not.toContain("Zahlung fehlgeschlagen");
    expect(html).toContain("Zahlungsproblem beheben");
    expect(html).toContain('action="/api/billing/portal"');
    expect(html).not.toContain("Abo verwalten");
    expect(html).not.toContain('href="/tarife"');
    expect(html).not.toContain("/api/billing/checkout");
  });

  it("labels a failed charge as a payment problem and a pause as subscription management", () => {
    const failed = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "free",
          freeAddressLabel: null,
          lastPeriodEnd: null,
          billingStatus: "past_due",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(failed).toContain("Zahlung fehlgeschlagen");
    expect(failed).toContain(
      "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode, um Ihr Abonnement fortzusetzen.",
    );
    expect(failed).not.toContain("Es wurde kein bezahlter Zeitraum freigeschaltet.");
    expect(failed).toContain("Zahlungsproblem beheben");
    expect(failed).not.toContain('href="/tarife"');

    const failedAfterPeriod = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "free",
          freeAddressLabel: null,
          lastPeriodEnd: "2026-09-30T00:00:00.000Z",
          billingStatus: "past_due",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(failedAfterPeriod).toContain("Abo abgelaufen am");
    expect(failedAfterPeriod).toContain(
      "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode, um Ihr Abonnement fortzusetzen.",
    );
    expect(failedAfterPeriod).not.toContain("Es wurde kein bezahlter Zeitraum freigeschaltet.");
    expect(failedAfterPeriod).not.toContain("Ein nicht bezahlter Zeitraum wurde nicht freigeschaltet.");

    const paused = renderToStaticMarkup(
      <AccessCard
        summary={{
          kind: "free",
          freeAddressLabel: null,
          lastPeriodEnd: null,
          billingStatus: "paused",
          cancelAtPeriodEnd: false,
          canManagePortal: true,
        }}
      />,
    );
    expect(paused).toContain("Das Abonnement ist pausiert.");
    expect(paused).toContain("Abo verwalten");
    expect(paused).not.toContain("Zahlungsproblem beheben");
    expect(paused).not.toContain('href="/tarife"');
  });
});

describe("CalculationsHistory access badge", () => {
  const base = {
    product_key: "speicher_grenze",
    name: "SpeicherGrenze",
    summary_address: "Musterstraße 1, 80331 München",
    summary_pv_kwp: 10,
    summary_consumption_kwh: 4000,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-08T10:00:00.000Z",
  };

  it("labels free and subscription reports and leaves legacy rows as before", () => {
    const html = renderToStaticMarkup(
      <CalculationsHistory
        rows={[
          { ...base, id: "11111111-1111-4111-8111-111111111111", access_tier: "free" },
          { ...base, id: "22222222-2222-4222-8222-222222222222", access_tier: "paid" },
          { ...base, id: "33333333-3333-4333-8333-333333333333", access_tier: null },
        ]}
      />,
    );
    expect(html.match(/>Privat</g)?.length ?? 0).toBe(1);
    expect(html.match(/>Abo</g)?.length ?? 0).toBe(1);
    expect(html.match(/>Abgeschlossen</g)?.length ?? 0).toBe(3);
  });
});
