import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PaymentConfirmation, PaymentConfirmationView } from "./PaymentConfirmation";
import { paymentStatusCopy } from "./paymentStatusCopy";

const SPEICHER_URL = "http://localhost:3001";

function confirmed(planKey: string) {
  return renderToStaticMarkup(
    <PaymentConfirmationView state="active" planKey={planKey} speicherUrl={SPEICHER_URL} />,
  );
}

describe("return from Stripe", () => {
  it("does not call a tariff active while the webhook is still pending", () => {
    for (const state of ["pending", "waiting"] as const) {
      const copy = paymentStatusCopy(state, "pvnavigator_starter");
      expect(copy.detail).toBe(
        "Ihre Zahlung wird verarbeitet. Ihr neuer Tarif wird in Kürze aktiviert.",
      );
      expect(copy.title).toBe("Zahlung wird verarbeitet");
      expect(copy.tariff).toBeNull();
      expect(copy.detail).not.toContain("erfolgreich");
    }
  });

  it("shows the catalog price and quota after the paid period exists", () => {
    const starter = paymentStatusCopy("active", "pvnavigator_starter");
    expect(starter.title).toBe("STARTER ist aktiv");
    expect(starter.detail).toBe(
      "Ihre Zahlung war erfolgreich. Ihr Zugang zu PVNAVIGATOR_ ist freigeschaltet.",
    );
    expect(starter.tariff).toEqual({ label: "STARTER", priceLabel: "9 €", addressLimit: 10 });

    const abo = paymentStatusCopy("active", "pvnavigator_abo");
    expect(abo.title).toBe("ABO ist aktiv");
    expect(abo.tariff).toEqual({ label: "ABO", priceLabel: "29 €", addressLimit: 50 });

    const legacy = paymentStatusCopy("active", "pvnavigator_monthly");
    expect(legacy.tariff).toEqual(abo.tariff);

    const pro = paymentStatusCopy("active", "pvnavigator_pro");
    expect(pro.title).toBe("PRO ist aktiv");
    expect(pro.tariff).toEqual({ label: "PRO", priceLabel: "59 €", addressLimit: 200 });
  });

  it("does not invent a catalog tariff for an unknown paid key", () => {
    const copy = paymentStatusCopy("active", "pvnavigator_custom");
    expect(copy.title).toBe("Zahlung bestätigt");
    expect(copy.tariff).toBeNull();
    expect(copy.detail).not.toContain("9 €");
  });

  it("does not announce a tariff when confirmation is temporarily unavailable", () => {
    const copy = paymentStatusCopy("unavailable", "pvnavigator_abo");
    expect(copy.title).toBe("Bestätigung vorübergehend nicht verfügbar");
    expect(copy.detail).toContain("Es wurde kein Zugang freigeschaltet.");
    expect(copy.detail).not.toContain("erfolgreich");
    expect(copy.tariff).toBeNull();
    const html = renderToStaticMarkup(
      <PaymentConfirmationView state="unavailable" planKey="pvnavigator_abo" speicherUrl={SPEICHER_URL} />,
    );
    expect(html).toContain("Bestätigung vorübergehend nicht verfügbar");
    expect(html).not.toContain("ABO ist aktiv");
    expect(html).not.toContain("SPEICHERGRENZE starten");
    expect(html).not.toContain("Ihre Zahlung war erfolgreich");
  });

  it("keeps an unpaid return from looking successful", () => {
    const copy = paymentStatusCopy("unpaid", "pvnavigator_starter");
    expect(copy.title).toBe("Zahlung nicht bestätigt");
    expect(copy.detail).toContain("Ihr bisheriger Zugang ist unverändert.");
    expect(copy.tariff).toBeNull();
    expect(copy.detail).not.toContain("erfolgreich");
  });

  it("starts the confirmation page on the processing message", () => {
    const html = renderToStaticMarkup(
      <PaymentConfirmation sessionId="cs_test_pending" speicherUrl={SPEICHER_URL} />,
    );
    expect(html).toContain("Ihre Zahlung wird verarbeitet. Ihr neuer Tarif wird in Kürze aktiviert.");
    expect(html).not.toContain("STARTER ist aktiv");
    expect(html).not.toContain("SPEICHERGRENZE starten");
    expect(html).not.toContain("Zu den Tarifen");
  });

  it("renders the confirmed tariff, the product link and the account link", () => {
    const html = confirmed("pvnavigator_starter");
    expect(html).toContain("STARTER ist aktiv");
    expect(html).toContain("Ihre Zahlung war erfolgreich. Ihr Zugang zu PVNAVIGATOR_ ist freigeschaltet.");
    expect(html).toContain("STARTER — 9 € / Monat");
    expect(html).toContain("10 Adressen pro Abrechnungszeitraum");
    expect(html).toContain("SPEICHERGRENZE inklusive");
    expect(html).toContain("RENDITEGUIDE nach Veröffentlichung inklusive");
    expect(html).toContain(`href="${SPEICHER_URL}"`);
    expect(html).toContain("SPEICHERGRENZE starten");
    expect(html).toContain('href="/konto"');
    expect(html).toContain("Mein Konto");
    expect(html).not.toContain("Zu den Tarifen");
    expect(html).not.toContain("nicht selbst vergeben");

    expect(confirmed("pvnavigator_abo")).toContain("ABO — 29 € / Monat");
    expect(confirmed("pvnavigator_abo")).toContain("50 Adressen pro Abrechnungszeitraum");
    expect(confirmed("pvnavigator_pro")).toContain("PRO — 59 € / Monat");
    expect(confirmed("pvnavigator_pro")).toContain("200 Adressen pro Abrechnungszeitraum");
  });

  it("does not offer the product start when the payment is not confirmed", () => {
    const html = renderToStaticMarkup(
      <PaymentConfirmationView state="unpaid" planKey="pvnavigator_pro" speicherUrl={SPEICHER_URL} />,
    );
    expect(html).toContain("Zahlung nicht bestätigt");
    expect(html).not.toContain("SPEICHERGRENZE starten");
    expect(html).not.toContain("59 €");
    expect(html).not.toContain("Ihre Zahlung war erfolgreich");
    expect(html).toContain('href="/konto"');
  });
});
