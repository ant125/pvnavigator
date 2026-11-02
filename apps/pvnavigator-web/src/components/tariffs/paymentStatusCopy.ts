import { PAID_PLANS, paidPlanIdFromKey } from "@pv-access/core";

export type PaymentView = "pending" | "active" | "unpaid" | "forbidden" | "waiting" | "unavailable";

const PROCESSING =
  "Ihre Zahlung wird verarbeitet. Ihr neuer Tarif wird in Kürze aktiviert.";

const CONFIRMED =
  "Ihre Zahlung war erfolgreich. Ihr Zugang zu PVNAVIGATOR_ ist freigeschaltet.";

export type ConfirmedTariff = {
  label: string;
  priceLabel: string;
  addressLimit: number;
};

export type PaymentStatusCopy = {
  title: string;
  detail: string;
  tariff: ConfirmedTariff | null;
};

/**
 * Names a tariff only after the server has stored the paid period.
 * Price and address limit come from the catalog row for that period's plan
 * key. This page never grants the period itself.
 */
export function paymentStatusCopy(
  state: PaymentView,
  planKey: string | null,
): PaymentStatusCopy {
  if (state === "active") {
    const planId = paidPlanIdFromKey(planKey);
    const plan = planId ? PAID_PLANS[planId] : null;
    return {
      title: plan ? `${plan.label} ist aktiv` : "Zahlung bestätigt",
      detail: CONFIRMED,
      tariff: plan
        ? {
            label: plan.label,
            priceLabel: plan.priceLabel,
            addressLimit: plan.addressLimit,
          }
        : null,
    };
  }
  if (state === "unpaid") {
    return {
      title: "Zahlung nicht bestätigt",
      detail: "Es wurde kein bezahlter Zeitraum freigeschaltet. Ihr bisheriger Zugang ist unverändert.",
      tariff: null,
    };
  }
  if (state === "forbidden") {
    return {
      title: "Dieser Bezahlvorgang gehört nicht zu Ihrem Konto",
      detail: "Es wurde kein Zugang geändert.",
      tariff: null,
    };
  }
  if (state === "unavailable") {
    return {
      title: "Bestätigung vorübergehend nicht verfügbar",
      detail:
        "Die Zahlung konnte gerade nicht geprüft werden. Es wurde kein Zugang freigeschaltet. Bitte laden Sie diese Seite in einigen Minuten erneut.",
      tariff: null,
    };
  }
  return {
    title: "Zahlung wird verarbeitet",
    detail: PROCESSING,
    tariff: null,
  };
}
