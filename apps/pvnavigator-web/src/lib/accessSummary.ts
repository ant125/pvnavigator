import {
  SUBSCRIPTION_ADDRESS_LIMIT,
  SUBSCRIPTION_PLAN_KEY,
  formatDateDe,
  paidPlanIdFromKey,
  paidPlanLabel,
  type PaidPlanId,
} from "@pv-access/core";

/** Rows the hub reads for /konto (own rows only, through RLS). */
export type SubscriptionPeriodRow = {
  id: string;
  period_start: string;
  period_end: string;
  address_limit: number;
  plan_key?: string | null;
};

export type FreeAddressRow = {
  address_label: string;
  claimed_at: string;
};

export type StripeSubscriptionRow = {
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  current_period_end: string | null;
  scheduled_plan_key?: string | null;
  scheduled_effective_at?: string | null;
};

export const SUBSCRIPTION_PERIOD_SELECT = "id, plan_key, period_start, period_end, address_limit";
export const FREE_ADDRESS_SELECT = "address_label, claimed_at";
export const STRIPE_SUBSCRIPTION_SELECT =
  "status, cancel_at_period_end, cancel_at, current_period_end, scheduled_plan_key, scheduled_effective_at";

/** Statuses that must not be offered a second subscription. */
const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

export type AccessSummary = {
  billingStatus: string | null;
  /** Cancel scheduled, while a paid period may still be running. */
  cancelAtPeriodEnd: boolean;
  canManagePortal: boolean;
} & (
  | {
      kind: "subscription";
      planKey: string;
      usedAddresses: number;
      addressLimit: number;
      periodEnd: string;
      freeAddressLabel: string | null;
      scheduledPlanKey: string | null;
      scheduledEffectiveAt: string | null;
    }
  | {
      kind: "free";
      freeAddressLabel: string | null;
      /** Most recent expired paid period, if any. */
      lastPeriodEnd: string | null;
    }
);

export function subscriptionPaymentProblem(status: string | null | undefined): boolean {
  return (
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete" ||
    status === "incomplete_expired"
  );
}

/** Prefer an open subscription over a canceled one. */
export function pickStripeSubscription(rows: StripeSubscriptionRow[]): StripeSubscriptionRow | null {
  if (rows.length === 0) return null;
  const rank = (status: string) => (BLOCKING_SUBSCRIPTION_STATUSES.has(status) ? 0 : 1);
  return [...rows].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    const aEnd = a.current_period_end ? new Date(a.current_period_end).getTime() : 0;
    const bEnd = b.current_period_end ? new Date(b.current_period_end).getTime() : 0;
    return bEnd - aEnd;
  })[0];
}

/**
 * An active paid period, or a Stripe subscription that is not finished,
 * must not be sold a second time. `incomplete_expired` and `canceled`
 * without a running period can subscribe again.
 */
export function blocksAnotherSubscription(summary: AccessSummary): boolean {
  if (summary.kind === "subscription") return true;
  return summary.billingStatus !== null && BLOCKING_SUBSCRIPTION_STATUSES.has(summary.billingStatus);
}

/**
 * A scheduled key names the same catalog tariff as the open period.
 * Legacy monthly and ABO are the same tariff. Two different unknown keys are not.
 */
function scheduledPlanIsCurrent(planKey: string, scheduledPlanKey: string | null): boolean {
  if (!scheduledPlanKey) return false;
  const currentId = paidPlanIdFromKey(planKey);
  const scheduledId = paidPlanIdFromKey(scheduledPlanKey);
  if (currentId && scheduledId) return currentId === scheduledId;
  return scheduledPlanKey === planKey;
}

/**
 * Picks the active paid period (period_start <= now < period_end). When two
 * periods overlap, the one that started later wins, so an immediate PRO
 * upgrade replaces ABO access without rewriting the older row.
 * Paid access is the period, not the Stripe status.
 */
export function summarizeAccess(args: {
  now: Date;
  periods: SubscriptionPeriodRow[];
  usedAddressesByPeriod: Record<string, number>;
  freeAddress: FreeAddressRow | null;
  billing?: StripeSubscriptionRow | null;
  canManagePortal?: boolean;
}): AccessSummary {
  const nowMs = args.now.getTime();
  const active = args.periods
    .filter((period) => {
      const start = new Date(period.period_start).getTime();
      const end = new Date(period.period_end).getTime();
      return start <= nowMs && nowMs < end;
    })
    .sort((a, b) => {
      const byStart = new Date(b.period_start).getTime() - new Date(a.period_start).getTime();
      if (byStart !== 0) return byStart;
      return new Date(b.period_end).getTime() - new Date(a.period_end).getTime();
    })[0];

  const freeAddressLabel = args.freeAddress?.address_label?.trim() || null;
  const billing = args.billing ?? null;
  const billingFields = {
    billingStatus: billing?.status ?? null,
    cancelAtPeriodEnd: Boolean(
      billing?.cancel_at_period_end || (billing?.cancel_at && billing.status !== "canceled"),
    ),
    canManagePortal: args.canManagePortal === true,
  };

  if (active) {
    const planKey = active.plan_key?.trim() || SUBSCRIPTION_PLAN_KEY;
    const scheduledPlanKey = billing?.scheduled_plan_key?.trim() || null;
    const scheduledSame = scheduledPlanIsCurrent(planKey, scheduledPlanKey);
    return {
      kind: "subscription",
      planKey,
      usedAddresses: args.usedAddressesByPeriod[active.id] ?? 0,
      addressLimit: active.address_limit ?? SUBSCRIPTION_ADDRESS_LIMIT,
      periodEnd: active.period_end,
      freeAddressLabel,
      scheduledPlanKey: scheduledSame ? null : scheduledPlanKey,
      scheduledEffectiveAt: scheduledSame ? null : billing?.scheduled_effective_at ?? null,
      ...billingFields,
    };
  }

  const expired = args.periods
    .filter((period) => new Date(period.period_end).getTime() <= nowMs)
    .sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime())[0];

  return {
    kind: "free",
    freeAddressLabel,
    lastPeriodEnd: expired?.period_end ?? null,
    ...billingFields,
  };
}

export type AccessCardCopy = {
  title: string;
  badge: string;
  lines: string[];
  note: string | null;
};

/** German copy for the compact access card. */
export function accessCardCopy(summary: AccessSummary): AccessCardCopy {
  if (summary.kind === "subscription") {
    const lines = [
      `${summary.usedAddresses} von ${summary.addressLimit} Adressen in diesem Zeitraum genutzt`,
      remainingAddressLine(summary.usedAddresses, summary.addressLimit),
      `Bezahlter Zeitraum bis ${formatDateDe(summary.periodEnd)}`,
    ];
    if (summary.billingStatus === "canceled") {
      // customer.subscription.deleted clears cancel_at_period_end. The paid
      // period can still contain wall-clock now; that is not a renewal.
      lines.push(`Abonnement gekündigt. Zugang bis ${formatDateDe(summary.periodEnd)}.`);
    } else if (summary.cancelAtPeriodEnd) {
      lines.push(
        `Kündigung zum ${formatDateDe(summary.periodEnd)}. Bis dahin bleibt der bezahlte Zugang erhalten, danach keine Verlängerung.`,
      );
    } else {
      const paymentLine = grantedPeriodPaymentLine(summary.billingStatus, summary.periodEnd);
      if (paymentLine) lines.push(paymentLine);
    }
    const renewalDue =
      summary.billingStatus !== "canceled" &&
      !summary.cancelAtPeriodEnd &&
      !subscriptionPaymentProblem(summary.billingStatus);
    if (renewalDue) {
      lines.push(`Nächste Verlängerung am ${formatDateDe(summary.periodEnd)}.`);
    }
    const scheduledLabel = summary.scheduledPlanKey ? paidPlanLabel(summary.scheduledPlanKey) : null;
    if (scheduledLabel && summary.scheduledEffectiveAt) {
      lines.push(
        `Wechsel zu ${scheduledLabel} am ${formatDateDe(summary.scheduledEffectiveAt)}. Das Adresskontingent dieses Zeitraums bleibt unverändert.`,
      );
    }
    return {
      title: paidPlanLabel(summary.planKey) ?? "Bezahlter Zugang",
      badge: subscriptionBadge(summary.billingStatus),
      lines,
      note: "Bereits verwendete Adressen können Sie beliebig oft mit anderen Einstellungen neu berechnen. Nur neue Adressen zählen zum Kontingent.",
    };
  }

  const lines = summary.freeAddressLabel
    ? [
        `Kostenlose Adresse: ${summary.freeAddressLabel}`,
        "Diese Adresse können Sie beliebig oft mit anderen Einstellungen neu berechnen. Nur eine neue Adresse zählt zum Kontingent.",
      ]
    : [
        "Berechnen und vergleichen Sie beliebig viele Varianten für eine Adresse.",
        "Die Adresse wird mit Ihrer ersten erfolgreichen Berechnung festgelegt.",
      ];
  if (summary.lastPeriodEnd) {
    lines.push(`Abo abgelaufen am ${formatDateDe(summary.lastPeriodEnd)} – gespeicherte Berichte bleiben verfügbar.`);
  }
  if (summary.billingStatus === "canceled" && summary.lastPeriodEnd) {
    lines.push("Abonnement beendet. Keine automatische Verlängerung.");
  }
  const openNotice = openSubscriptionCopy(summary.billingStatus);
  if (openNotice) lines.push(openNotice.description);
  return {
    title: "Kostenloser Zugang",
    badge: freeAccessBadge(summary),
    lines,
    note: null,
  };
}

function remainingAddressLine(used: number, limit: number): string {
  const remaining = Math.max(0, limit - used);
  const noun = remaining === 1 ? "Adresse" : "Adressen";
  return `Noch ${remaining} ${noun} in diesem Zeitraum verfügbar.`;
}

function subscriptionBadge(status: string | null): string {
  if (status === "past_due") return PAST_DUE_COPY.title;
  if (subscriptionPaymentProblem(status)) return "Zahlung offen";
  return "Aktiv";
}

function freeAccessBadge(summary: Extract<AccessSummary, { kind: "free" }>): string {
  if (summary.billingStatus === "past_due") return PAST_DUE_COPY.title;
  if (subscriptionPaymentProblem(summary.billingStatus)) return "Zahlung offen";
  if (blocksAnotherSubscription(summary)) return "Offen";
  return "Kostenlos";
}

export type OpenSubscriptionCopy = {
  title: string;
  description: string;
};

const PAST_DUE_COPY: OpenSubscriptionCopy = {
  title: "Zahlung fehlgeschlagen",
  description:
    "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Bitte aktualisieren Sie Ihre Zahlungsmethode, um Ihr Abonnement fortzusetzen.",
};

/**
 * Copy for a Stripe subscription that has not opened a paid period.
 * The same title and description are shown on /konto and /tarife.
 * `canceled` and an empty status stay silent; those cards already have their own lines.
 * Only `past_due` is a failed charge. The other statuses keep their own meaning.
 */
export function openSubscriptionCopy(status: string | null): OpenSubscriptionCopy | null {
  if (status === "past_due") return PAST_DUE_COPY;
  if (status === "unpaid") {
    return {
      title: "Abonnement unbezahlt",
      description: "Das Abonnement ist unbezahlt. Es ist kein bezahlter Zeitraum freigeschaltet.",
    };
  }
  if (status === "incomplete") {
    return {
      title: "Zahlung nicht bestätigt",
      description: "Die Zahlung ist nicht bestätigt. Es wurde kein bezahlter Zeitraum freigeschaltet.",
    };
  }
  if (status === "incomplete_expired") {
    return {
      title: "Zahlung abgelaufen",
      description: "Die Zahlung ist abgelaufen. Es wurde kein bezahlter Zeitraum freigeschaltet.",
    };
  }
  if (status === "paused") {
    return {
      title: "Abonnement pausiert",
      description: "Das Abonnement ist pausiert. Es ist kein bezahlter Zeitraum freigeschaltet.",
    };
  }
  if (status === "trialing") {
    return {
      title: "Testabo",
      description: "Ein Testabo ist hinterlegt. Es ist kein bezahlter Zeitraum freigeschaltet.",
    };
  }
  if (status === "active") {
    return {
      title: "Abonnement vorhanden",
      description:
        "Für dieses Konto besteht bereits ein Abonnement. Ein bezahlter Zeitraum ist noch nicht freigeschaltet.",
    };
  }
  return null;
}

/**
 * A charge problem during a period that is still paid. The period stays usable.
 * Statuses that are not a failed charge do not reuse the past_due wording.
 */
export function grantedPeriodPaymentLine(status: string | null, periodEnd: string): string | null {
  const until = `Der bereits bezahlte Zeitraum bleibt bis ${formatDateDe(periodEnd)} nutzbar.`;
  if (status === "past_due") return `Die letzte Zahlung ist fehlgeschlagen. ${until}`;
  if (status === "unpaid") return `Das Abonnement ist unbezahlt. ${until}`;
  if (status === "incomplete") return `Die Zahlung ist nicht bestätigt. ${until}`;
  if (status === "incomplete_expired") return `Die Zahlung ist abgelaufen. ${until}`;
  return null;
}

/**
 * A Stripe customer id is not enough. The portal is available for a running
 * paid period and for a blocking subscription that has not opened one.
 * The same rule blocks a second subscription.
 */
export function canOpenBillingPortal(summary: AccessSummary): boolean {
  return summary.canManagePortal && blocksAnotherSubscription(summary);
}

/** Payment problems without a granted period are not labeled as subscription management. */
export function billingPortalButtonLabel(grantedPeriod: boolean, billingStatus: string | null): string {
  if (!grantedPeriod && subscriptionPaymentProblem(billingStatus)) return "Zahlungsproblem beheben";
  return "Abo verwalten";
}

/** Short badge for a saved calculation in the history list. */
export function calculationAccessBadge(accessTier: string | null | undefined): string | null {
  if (accessTier === "free") return "Privat";
  if (accessTier === "paid") return "Abo";
  return null;
}

export type TariffViewer =
  | { kind: "guest" }
  | { kind: "current_free" }
  | {
      kind: "current_paid";
      plan: PaidPlanId | null;
      planKey: string;
      usedAddresses: number;
      addressLimit: number;
      cancelAtPeriodEnd: boolean;
      /** Stripe has ended the subscription; the paid period still contains now. */
      subscriptionCanceled: boolean;
      periodEnd: string;
      paymentProblem: boolean;
      billingStatus?: string | null;
      canManage: boolean;
      scheduledPlan: PaidPlanId | null;
      scheduledAt: string | null;
    }
  | { kind: "payment_open"; canManage: boolean; billingStatus: string };

export function tariffViewer(signedIn: boolean, summary: AccessSummary | null): TariffViewer {
  if (!signedIn || !summary) return { kind: "guest" };
  if (summary.kind === "subscription") {
    return {
      kind: "current_paid",
      plan: paidPlanIdFromKey(summary.planKey),
      planKey: summary.planKey,
      usedAddresses: summary.usedAddresses,
      addressLimit: summary.addressLimit,
      cancelAtPeriodEnd: summary.cancelAtPeriodEnd,
      subscriptionCanceled: summary.billingStatus === "canceled",
      periodEnd: summary.periodEnd,
      paymentProblem: subscriptionPaymentProblem(summary.billingStatus),
      billingStatus: summary.billingStatus,
      canManage: summary.canManagePortal,
      scheduledPlan: summary.scheduledPlanKey ? paidPlanIdFromKey(summary.scheduledPlanKey) : null,
      scheduledAt: summary.scheduledEffectiveAt,
    };
  }
  if (blocksAnotherSubscription(summary)) {
    return {
      kind: "payment_open",
      canManage: summary.canManagePortal,
      billingStatus: summary.billingStatus ?? "",
    };
  }
  return { kind: "current_free" };
}

export const TARIFF_HINTS: Record<string, string> = {
  "nicht-konfiguriert":
    "Die Zahlung ist auf diesem Server noch nicht eingerichtet. Es wurde kein Abo freigeschaltet.",
  "live-gesperrt":
    "Die Live-Zahlung ist vorübergehend nur für das vorgesehene Testkonto möglich. Es wurde kein Abo gestartet.",
  "bitte-warten":
    "Die Kasse wird bereits geöffnet. Bitte einen Moment warten und es dann erneut versuchen.",
  "bereits-aktiv": "Für dieses Konto läuft bereits ein Abo. Ein zweites Abo wird nicht gestartet.",
  "portal-fehlt": "Die Verwaltung des Abos ist für dieses Konto noch nicht verfügbar.",
  preis:
    "Der hinterlegte Preis passt nicht zum gewählten Tarif. STARTER ist 9 €, ABO ist 29 €, PRO ist 59 € im Monat. Es wurde nichts freigeschaltet.",
  "pro-preis":
    "Der Preis für PRO fehlt oder passt nicht zu 59 € im Monat. Es wurde nichts freigeschaltet.",
  "kein-abo": "Ein Tarifwechsel ist nur für ein laufendes Abo möglich.",
  gekuendigt: "Das Abo endet mit dem bezahlten Zeitraum. Ein Wechsel ist dafür nicht vorgemerkt.",
  wechsel:
    "Der Tarifwechsel ist zum Ende des laufenden Zeitraums vorgemerkt. Das aktuelle Adresskontingent bleibt unverändert.",
  "wechsel-fehler": "Der Tarifwechsel konnte nicht vorgemerkt werden. Der laufende Zeitraum ist unverändert.",
  "zahlung-fehler":
    "Der Bezahlvorgang konnte nicht gestartet werden. Ihr Zugang ist unverändert.",
  "upgrade-ungueltig":
    "Ein sofortiger Wechsel ist nur von STARTER zu ABO oder PRO und von ABO zu PRO möglich. Der Zugang ist unverändert.",
  "upgrade-ausstehend":
    "Ein Wechsel wird bereits verarbeitet. Der neue Tarif wird erst nach bestätigter Zahlung freigeschaltet. Der bisherige Zugang bleibt bis dahin unverändert.",
};
