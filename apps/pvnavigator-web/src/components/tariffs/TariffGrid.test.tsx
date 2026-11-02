import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { TariffGrid } from "./TariffGrid";

const paidBase = {
  kind: "current_paid" as const,
  plan: "abo" as const,
  planKey: "pvnavigator_abo",
  usedAddresses: 35,
  addressLimit: 50,
  cancelAtPeriodEnd: false,
  subscriptionCanceled: false,
  periodEnd: "2026-11-14T00:00:00.000Z",
  paymentProblem: false,
  canManage: true,
  scheduledPlan: null,
  scheduledAt: null,
};

describe("TariffGrid", () => {
  it("shows four compact tariffs and keeps the paid choice through sign-in", () => {
    const html = renderToStaticMarkup(<TariffGrid viewer={{ kind: "guest" }} resumePlan={null} />);
    expect(html).toContain("Kostenlos registrieren");
    expect(html).toContain("/konto-erstellen?next=%2Ftarife");
    expect(html).toContain("/anmelden?next=%2Ftarife%3Fauswahl%3Dstarter");
    expect(html).toContain("/anmelden?next=%2Ftarife%3Fauswahl%3Dabo");
    expect(html).toContain("/anmelden?next=%2Ftarife%3Fauswahl%3Dpro");
    expect(html).toContain("0 €");
    expect(html).toContain("9 €");
    expect(html).toContain("29 €");
    expect(html).toContain("59 €");
    expect(html).toContain("1 feste Adresse");
    expect(html).toContain("10 Adressen pro Monat");
    expect(html).toContain("50 Adressen pro Monat");
    expect(html).toContain("200 Adressen pro Monat");
    expect(html).toContain("SPEICHERGRENZE inklusive");
    expect(html).toContain("Beliebig viele Varianten für Ihre Adresse");
    expect(html).toContain("Beliebig viele Varianten je Adresse");
    expect(html).toContain("PDF mit Hinweis zur privaten Nutzung");
    expect(html).toContain("PDF ohne Privatnutzungskennzeichnung");
    expect(html).toContain("Gewerbliche Nutzung inklusive");
    expect(html).toContain("STARTER, ABO und PRO enthalten nach Veröffentlichung auch RENDITEGUIDE.");
    expect(html.match(/RENDITEGUIDE/g)?.length).toBe(1);
    expect(html).toContain("Gut zu wissen");
    expect(html).toContain("Adressen statt Berichte");
    expect(html).toContain("Ihr Abrechnungsmonat");
    expect(html).toContain("Gespeicherte Berichte");
    expect(html).not.toContain("fehlgeschlagene Zahlung");
    expect(html).toContain("Umsatzsteuerbefreit gemäß § 19 UStG.");
    expect(html).not.toMatch(/0\s*%\s*MwSt/i);
    expect(html).not.toContain("API");
    expect(html).not.toMatch(/Priorität|Teamzugang|Support/i);
    expect(html).toContain("max-w-[1280px]");
    expect(html).toContain("min-[740px]:grid-cols-2");
    expect(html).toContain("min-[1200px]:grid-cols-4");
    expect(html.indexOf('data-testid="tariff-free"')).toBeLessThan(html.indexOf('data-testid="tariff-starter"'));
    expect(html.indexOf('data-testid="tariff-starter"')).toBeLessThan(html.indexOf('data-testid="tariff-abo"'));
    expect(html.indexOf('data-testid="tariff-abo"')).toBeLessThan(html.indexOf('data-testid="tariff-pro"'));
  });

  it("marks the free tariff as current and offers STARTER, ABO and PRO", () => {
    const html = renderToStaticMarkup(<TariffGrid viewer={{ kind: "current_free" }} resumePlan={null} />);
    expect(html).toContain("Aktueller Tarif");
    expect(html).toContain("STARTER abschließen");
    expect(html).toContain("ABO abschließen");
    expect(html).toContain("PRO abschließen");
    expect(html).toContain('name="plan" value="starter"');
    expect(html).toContain('name="plan" value="abo"');
    expect(html).toContain('name="plan" value="pro"');
    expect(html.match(/action="\/api\/billing\/checkout"/g)?.length).toBe(3);
    expect(html).not.toContain("Kostenlos registrieren");
    expect(html).not.toContain("/api/billing/change-plan");
    expect(html).not.toContain("/api/billing/upgrade");
    expect(html).not.toContain("Zu ABO wechseln");
    expect(html).not.toContain("Zu PRO wechseln");
  });

  it("resumes only the tariff chosen before sign-in", () => {
    const html = renderToStaticMarkup(<TariffGrid viewer={{ kind: "current_free" }} resumePlan="pro" />);
    expect(html).toContain('id="tariff-checkout-pro"');
    expect(html.match(/Weiter zur Zahlung/g)?.length).toBe(1);
  });

  it("lets an active ABO switch to PRO immediately", () => {
    const html = renderToStaticMarkup(<TariffGrid viewer={paidBase} resumePlan={null} />);
    expect(html).toContain("Aktueller Tarif");
    expect(html).toContain("Zu PRO wechseln");
    expect(html).toContain('data-testid="immediate-pro-upgrade"');
    expect(html).toContain('action="/api/billing/upgrade"');
    expect(html).toContain("ABO — 29 €/Monat, 50 Adressen");
    expect(html).toContain("PRO — 59 €/Monat, 200 Adressen");
    expect(html).toContain("Jetzt zu zahlen: 59 €");
    expect(html).toContain("Jetzt für 59 € zu PRO wechseln");
    expect(html).toContain("Der neue Abrechnungszeitraum beginnt nach erfolgreicher Zahlung.");
    expect(html).toContain("Es erfolgt keine anteilige Verrechnung oder Rückerstattung.");
    expect(html).not.toContain("Vollständige Zahlung");
    expect(html).not.toContain("Bezahlt bis");
    expect(html).not.toContain("59,00 €");
    expect(html).not.toContain('type="hidden"');
    expect(html).not.toContain("/api/billing/change-plan");
    expect(html.match(/Abo verwalten/g)?.length).toBe(1);
    const aboCard = html.slice(html.indexOf('data-testid="tariff-abo"'), html.indexOf('data-testid="tariff-pro"'));
    expect(aboCard).toContain("Aktueller Tarif");
    expect(aboCard).toContain('action="/api/billing/portal"');
    expect(html).not.toContain("ABO abschließen");
    expect(html).not.toContain("PRO abschließen");
    expect(html).not.toContain('action="/api/billing/checkout"');
  });

  it("marks STARTER as current and offers immediate ABO and PRO switches", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{
          ...paidBase,
          plan: "starter",
          planKey: "pvnavigator_starter",
          addressLimit: 10,
          usedAddresses: 2,
        }}
        resumePlan={null}
      />,
    );
    const starterCard = html.slice(
      html.indexOf('data-testid="tariff-starter"'),
      html.indexOf('data-testid="tariff-abo"'),
    );
    expect(starterCard).toContain("STARTER");
    expect(starterCard).toContain("10 Adressen pro Monat");
    expect(starterCard).toContain("9 €");
    expect(starterCard).toContain("Aktueller Tarif");
    expect(starterCard).toContain('action="/api/billing/portal"');
    expect(starterCard).toContain("Abo verwalten");
    expect(html).not.toContain('action="/api/billing/checkout"');
    expect(html).not.toContain("Ihr aktueller Tarif bleibt bestehen.");
    expect(html).not.toContain("STARTER abschließen");
    expect(html).not.toContain("ABO abschließen");
    expect(html).not.toContain("PRO abschließen");
    const aboCard = html.slice(html.indexOf('data-testid="tariff-abo"'), html.indexOf('data-testid="tariff-pro"'));
    expect(aboCard).not.toContain('aria-current="true"');
    expect(aboCard).toContain("Zu ABO wechseln");
    expect(aboCard).toContain('data-testid="immediate-starter-abo-upgrade"');
    expect(aboCard).toContain('name="plan" value="abo"');
    expect(aboCard).toContain("STARTER — 9 €/Monat, 10 Adressen");
    expect(aboCard).toContain("ABO — 29 €/Monat, 50 Adressen");
    expect(aboCard).toContain("Jetzt zu zahlen: 29 €");
    expect(aboCard).toContain("Der neue Abrechnungszeitraum beginnt nach erfolgreicher Zahlung.");
    expect(aboCard).toContain("Verbleibende Tage und ungenutzte Adressen Ihres bisherigen Tarifs werden nicht übertragen.");
    expect(aboCard).toContain("Es erfolgt keine anteilige Verrechnung oder Rückerstattung.");
    expect(aboCard).not.toContain("Vollständige Zahlung");
    expect(aboCard).toContain("Jetzt für 29 € zu ABO wechseln");
    const proCard = html.slice(html.indexOf('data-testid="tariff-pro"'));
    expect(proCard).toContain("Zu PRO wechseln");
    expect(proCard).toContain('data-testid="immediate-starter-pro-upgrade"');
    expect(proCard).toContain('name="plan" value="pro"');
    expect(proCard).toContain("PRO — 59 €/Monat, 200 Adressen");
    expect(proCard).toContain("Jetzt zu zahlen: 59 €");
    expect(proCard).toContain("Es erfolgt keine anteilige Verrechnung oder Rückerstattung.");
    expect(proCard).toContain("Verbleibende Tage und ungenutzte Adressen Ihres bisherigen Tarifs werden nicht übertragen.");
    expect(proCard).not.toContain("verfallen beim erfolgreichen Wechsel");
    expect(proCard).toContain("Jetzt für 59 € zu PRO wechseln");
    expect(proCard).not.toContain('name="plan" value="abo"');
  });

  it("shows a scheduled change without touching the current tariff label", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{
          ...paidBase,
          scheduledPlan: "pro",
          scheduledAt: "2026-11-14T00:00:00.000Z",
        }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Aktueller Tarif");
    expect(html).toContain("Wechsel zu");
    expect(html).toContain("Adresskontingent");
    expect(html).toContain("Zu PRO wechseln");
    expect(html).toContain('action="/api/billing/upgrade"');
    expect(html).toContain("Wechsel zurücknehmen");
    expect(html).not.toContain('action="/api/billing/checkout"');
  });

  it("does not offer a purchase when payment is open and no period was granted", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{ kind: "payment_open", canManage: true, billingStatus: "incomplete" }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Zahlung nicht bestätigt.");
    expect(html).toContain("Die Zahlung ist nicht bestätigt. Es wurde kein bezahlter Zeitraum freigeschaltet.");
    expect(html).toContain("Derzeit kein bezahlter Zugang.");
    expect(html).not.toContain("Im gewählten Tarif enthalten.");
    expect(html).toContain("Zahlungsproblem beheben");
    expect(html).toContain('action="/api/billing/portal"');
    expect(html).not.toContain("Abo verwalten");
    expect(html).not.toContain("Zahlung fehlgeschlagen");
    expect(html).not.toContain("ABO abschließen");
    expect(html).not.toContain("/api/billing/checkout");
  });

  it("keeps a paused subscription on portal management without a second purchase", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{ kind: "payment_open", canManage: true, billingStatus: "paused" }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Abonnement pausiert.");
    expect(html).toContain("Das Abonnement ist pausiert.");
    expect(html).toContain("Derzeit kein bezahlter Zugang.");
    expect(html).toContain("Abo verwalten");
    expect(html).not.toContain("Zahlungsproblem beheben");
    expect(html).not.toContain("Zahlung fehlgeschlagen");
    expect(html).not.toContain("/api/billing/checkout");
  });

  it("names a failed renewal as a payment problem when no period was granted", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{ kind: "payment_open", canManage: true, billingStatus: "past_due" }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Zahlung fehlgeschlagen.");
    expect(html).toContain(
      "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode, um Ihr Abonnement fortzusetzen.",
    );
    expect(html).toContain("Derzeit kein bezahlter Zugang.");
    expect(html).not.toContain("Im gewählten Tarif enthalten.");
    expect(html).not.toContain("Zahlung nicht bestätigt.");
    expect(html).toContain("Zahlungsproblem beheben");
    expect(html).not.toContain("ABO abschließen");
    expect(html).not.toContain("/api/billing/checkout");
  });

  it("does not call unpaid or trialing a failed payment", () => {
    for (const billingStatus of ["unpaid", "trialing"] as const) {
      const html = renderToStaticMarkup(
        <TariffGrid viewer={{ kind: "payment_open", canManage: true, billingStatus }} resumePlan={null} />,
      );
      expect(html).not.toContain("Zahlung fehlgeschlagen");
      expect(html).not.toContain("Bitte aktualisieren Sie Ihre Zahlungsmethode");
      expect(html).toContain("Derzeit kein bezahlter Zugang.");
      expect(html).not.toContain("/api/billing/checkout");
    }
  });

  it("keeps the failed-payment note on the payment state, not in the shared notes", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{ ...paidBase, paymentProblem: true, billingStatus: "past_due" }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Die letzte Zahlung ist fehlgeschlagen.");
    expect(html).toContain("Im gewählten Tarif enthalten.");
    expect(html).not.toContain("Derzeit kein bezahlter Zugang.");
    expect(html).not.toContain("Eine fehlgeschlagene Zahlung eröffnet keinen neuen Zeitraum.");
  });

  it("offers the immediate PRO switch while a canceled ABO period is still valid", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{ ...paidBase, subscriptionCanceled: true, cancelAtPeriodEnd: false }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Aktueller Tarif");
    expect(html).toContain("Abonnement gekündigt. Zugang bis");
    expect(html).toContain("2026");
    expect(html).toContain("Zu PRO wechseln");
    expect(html).toContain('action="/api/billing/upgrade"');
    expect(html).not.toContain("Zu ABO wechseln");
    expect(html).not.toContain("/api/billing/change-plan");
    expect(html).not.toContain("/api/billing/checkout");
  });

  it("offers the immediate PRO switch when cancellation is scheduled", () => {
    const html = renderToStaticMarkup(
      <TariffGrid viewer={{ ...paidBase, cancelAtPeriodEnd: true }} resumePlan={null} />,
    );
    expect(html).toContain("Gekündigt zum");
    expect(html).toContain("Zu PRO wechseln");
    expect(html).toContain('action="/api/billing/upgrade"');
    expect(html).not.toContain("/api/billing/checkout");
    expect(html).not.toContain("/api/billing/change-plan");
  });

  it("omits the unused-address hint when none remain", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{ ...paidBase, usedAddresses: 50, addressLimit: 50 }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Jetzt zu zahlen: 59 €");
    expect(html).toContain("Es erfolgt keine anteilige Verrechnung oder Rückerstattung.");
    expect(html).not.toContain("Sie haben noch");
    expect(html).not.toContain("zunächst verwenden");
  });

  it("does not offer an upgrade from PRO", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{
          ...paidBase,
          plan: "pro",
          planKey: "pvnavigator_pro",
          addressLimit: 200,
          usedAddresses: 0,
        }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Aktueller Tarif");
    expect(html.match(/Abo verwalten/g)?.length).toBe(1);
    const proCard = html.slice(html.indexOf('data-testid="tariff-pro"'));
    expect(proCard).toContain('action="/api/billing/portal"');
    const aboCard = html.slice(html.indexOf('data-testid="tariff-abo"'), html.indexOf('data-testid="tariff-pro"'));
    expect(aboCard).toContain("Sie nutzen bereits den PRO-Tarif.");
    expect(aboCard).not.toContain("Ihr aktueller Tarif bleibt bestehen.");
    expect(aboCard).not.toContain("/api/billing/portal");
    expect(html).not.toContain("Zu PRO wechseln");
    expect(html).not.toContain("Zu ABO wechseln");
    expect(html).not.toContain("/api/billing/upgrade");
    expect(html).toContain("Ihr aktueller Tarif bleibt bestehen.");
    expect(html).not.toContain("/api/billing/change-plan");
    expect(html).not.toContain("/api/billing/checkout");
  });

  it("keeps both STARTER upgrades when the paid period is canceled and blocks a pending checkout", () => {
    const html = renderToStaticMarkup(
      <TariffGrid
        viewer={{
          ...paidBase,
          plan: "starter",
          planKey: "pvnavigator_starter",
          addressLimit: 10,
          usedAddresses: 2,
          subscriptionCanceled: true,
        }}
        resumePlan={null}
      />,
    );
    expect(html).toContain("Abonnement gekündigt. Zugang bis");
    expect(html).toContain("Zu ABO wechseln");
    expect(html).toContain("Zu PRO wechseln");
    expect(html).not.toContain('disabled=""');

    const pending = renderToStaticMarkup(
      <TariffGrid
        viewer={{
          ...paidBase,
          plan: "starter",
          planKey: "pvnavigator_starter",
          addressLimit: 10,
        }}
        resumePlan={null}
        upgradeLocked
      />,
    );
    expect(pending).toMatch(/<button[^>]*disabled=""[^>]*>Zu ABO wechseln<\/button>/);
    expect(pending).toMatch(/<button[^>]*disabled=""[^>]*>Zu PRO wechseln<\/button>/);
  });
});
