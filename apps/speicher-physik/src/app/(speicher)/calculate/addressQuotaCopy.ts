import { PAID_PLANS, type PaidPlanId } from "@pv-access/core";

const PLAN_ORDER: PaidPlanId[] = ["starter", "abo", "pro"];

const RECALCULATE =
  "Bereits verwendete Adressen können Sie jederzeit mit anderen Einstellungen neu berechnen.";

export type QuotaNoticeCopy = {
  title: string;
  paragraphs: string[];
};

function planForLimit(addressLimit: number): PaidPlanId | null {
  return PLAN_ORDER.find((id) => PAID_PLANS[id].addressLimit === addressLimit) ?? null;
}

function higherPlans(plan: PaidPlanId): string {
  const labels = PLAN_ORDER.slice(PLAN_ORDER.indexOf(plan) + 1).map((id) => PAID_PLANS[id].label);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} oder ${labels[labels.length - 1]}`;
}

/** Copy for an exhausted paid address quota. Limits come from the tariff catalog. */
export function paidQuotaNotice(addressLimit: number | null): QuotaNoticeCopy {
  const title = "Ihr Adresskontingent ist ausgeschöpft";
  const plan = addressLimit == null ? null : planForLimit(addressLimit);
  if (!plan) {
    const used =
      addressLimit == null
        ? "Sie haben alle Adressen Ihres Tarifs genutzt."
        : `Sie haben alle ${addressLimit} Adressen Ihres Tarifs genutzt.`;
    return {
      title,
      paragraphs: [
        used,
        RECALCULATE,
        "Für weitere Adressen können Sie die verfügbaren Tarife ansehen.",
      ],
    };
  }

  const next = higherPlans(plan);
  return {
    title,
    paragraphs: [
      `Sie haben alle ${PAID_PLANS[plan].addressLimit} Adressen Ihres ${PAID_PLANS[plan].label}-Tarifs genutzt.`,
      RECALCULATE,
      next
        ? `Für weitere Adressen können Sie zu ${next} wechseln.`
        : "Neue Adressen sind erst im nächsten Abrechnungszeitraum wieder verfügbar.",
    ],
  };
}
