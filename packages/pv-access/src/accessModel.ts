/**
 * PVNAVIGATOR_ access rules shared by the hub and the products.
 *
 * - Free: one pinned address per account (pinned by the first successful
 *   calculation, any parameters, no monthly reset).
 * - Subscription: one paid period = `address_limit` unique addresses across
 *   all products. Re-calculating a known address inside the period is free of
 *   charge; a new paid period counts an address once again.
 *
 * The decision itself is taken in the database (RPC), never in the browser.
 * This module only carries the vocabulary, limits and German copy.
 */

/**
 * Periods opened before ABO/PRO keep this key. New payments use
 * `pvnavigator_abo` or `pvnavigator_pro`. Existing rows are not rewritten.
 */
export const SUBSCRIPTION_PLAN_KEY = "pvnavigator_monthly";

export const PAID_PLAN_IDS = ["abo", "pro", "starter"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

/**
 * Final monthly prices in cents. Kleinunternehmer: no VAT is added on top.
 * The browser never chooses the amount or the address limit; the server
 * maps a Stripe Price ID onto one of these rows.
 */
export const PAID_PLANS = {
  abo: {
    id: "abo",
    planKey: "pvnavigator_abo",
    label: "ABO",
    addressLimit: 50,
    priceCents: 2900,
    priceLabel: "29 €",
    priceEnvVar: "STRIPE_PRICE_ID",
  },
  pro: {
    id: "pro",
    planKey: "pvnavigator_pro",
    label: "PRO",
    addressLimit: 200,
    priceCents: 5900,
    priceLabel: "59 €",
    priceEnvVar: "STRIPE_PRICE_PRO_ID",
  },
  starter: {
    id: "starter",
    planKey: "pvnavigator_starter",
    label: "STARTER",
    addressLimit: 10,
    priceCents: 900,
    priceLabel: "9 €",
    priceEnvVar: "STRIPE_PRICE_STARTER_ID",
  },
} as const;

/** ABO, kept for callers that still refer to the original monthly price. */
export const SUBSCRIPTION_ADDRESS_LIMIT = PAID_PLANS.abo.addressLimit;
export const SUBSCRIPTION_PRICE_CENTS = PAID_PLANS.abo.priceCents;
export const SUBSCRIPTION_PRICE_CURRENCY = "eur";
export const SUBSCRIPTION_PRICE_LABEL = PAID_PLANS.abo.priceLabel;
export const VAT_EXEMPTION_LABEL = "Umsatzsteuerbefreit gemäß § 19 UStG.";

export function paidPlanById(value: unknown): PaidPlanId | null {
  return typeof value === "string" && (PAID_PLAN_IDS as readonly string[]).includes(value)
    ? (value as PaidPlanId)
    : null;
}

/**
 * Legacy `pvnavigator_monthly` periods stay ABO. A blank or unknown key is
 * not a catalog tariff.
 */
export function paidPlanIdFromKey(planKey: string | null | undefined): PaidPlanId | null {
  const key = planKey?.trim();
  if (key === PAID_PLANS.starter.planKey) return "starter";
  if (key === PAID_PLANS.pro.planKey) return "pro";
  if (key === PAID_PLANS.abo.planKey || key === SUBSCRIPTION_PLAN_KEY) return "abo";
  return null;
}

export function paidPlanLabel(planKey: string | null | undefined): string | null {
  const id = paidPlanIdFromKey(planKey);
  return id === null ? null : PAID_PLANS[id].label;
}

export const ACCESS_TIERS = ["free", "paid"] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

/** Stored on a calculation. `null` = created before the access rules existed. */
export type StoredAccessTier = AccessTier | null;

/** How a report is treated downstream (PDF marking, badges). */
export type ReportAccessKind = AccessTier | "legacy";

export function reportAccessKind(stored: string | null | undefined): ReportAccessKind {
  if (stored === "free" || stored === "paid") return stored;
  return "legacy";
}

/** Only free reports carry the private-use marking. Paid and legacy never do. */
export function reportRequiresPrivateUseMarking(stored: string | null | undefined): boolean {
  return reportAccessKind(stored) === "free";
}

export const PRIVATE_USE_LABEL = "Nur zur privaten Nutzung";

export const ACCESS_REASONS = [
  "subscription_known_address",
  "subscription_new_address",
  "free_claim_pending",
  "free_address",
  "free_address_mismatch",
  "subscription_limit_reached",
  "invalid_address",
  "unauthenticated",
] as const;
export type AccessReason = (typeof ACCESS_REASONS)[number];

export type AccessDecision = {
  allowed: boolean;
  tier: AccessTier | null;
  reason: AccessReason;
  subscription: {
    periodId: string;
    periodEnd: string;
    addressLimit: number;
    usedAddresses: number;
  } | null;
  freeAddressLabel: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asReason(value: unknown): AccessReason | null {
  return typeof value === "string" && (ACCESS_REASONS as readonly string[]).includes(value)
    ? (value as AccessReason)
    : null;
}

/** Parses the JSON returned by the `check_calculation_access` RPC. */
export function parseAccessDecision(value: unknown): AccessDecision | null {
  if (!isRecord(value)) return null;
  const reason = asReason(value.reason);
  if (reason === null || typeof value.allowed !== "boolean") return null;
  const tier = value.tier === "free" || value.tier === "paid" ? value.tier : null;
  let subscription: AccessDecision["subscription"] = null;
  if (isRecord(value.subscription)) {
    const s = value.subscription;
    if (
      typeof s.period_id === "string" &&
      typeof s.period_end === "string" &&
      typeof s.address_limit === "number" &&
      typeof s.used_addresses === "number"
    ) {
      subscription = {
        periodId: s.period_id,
        periodEnd: s.period_end,
        addressLimit: s.address_limit,
        usedAddresses: s.used_addresses,
      };
    }
  }
  return {
    allowed: value.allowed,
    tier,
    reason,
    subscription,
    freeAddressLabel:
      typeof value.free_address_label === "string" ? value.free_address_label : null,
  };
}

const RPC_DENIED_PREFIX = "PVN_ACCESS_DENIED:";

/** The record RPC refuses with this message shape when the re-check under lock fails. */
export function parseAccessDeniedError(message: string | null | undefined): AccessReason | null {
  if (!message || !message.startsWith(RPC_DENIED_PREFIX)) return null;
  return asReason(message.slice(RPC_DENIED_PREFIX.length).trim());
}

export function formatDateDe(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(iso));
}

/**
 * German explanation for a refused calculation. Used by the API (status 403)
 * and shown in the calculator's error box.
 */
export function accessDeniedMessage(decision: Pick<AccessDecision, "reason" | "freeAddressLabel" | "subscription">): string {
  switch (decision.reason) {
    case "free_address_mismatch": {
      const pinned = decision.freeAddressLabel
        ? ` Ihre kostenlose Adresse ist „${decision.freeAddressLabel}“.`
        : "";
      return (
        "Der kostenlose Zugang gilt für eine Adresse pro Konto; sie wurde mit Ihrer ersten erfolgreichen Berechnung festgelegt." +
        pinned +
        " Für diese Adresse können Sie alle Parameter beliebig ändern und neu berechnen. Weitere Adressen sind Teil von STARTER, ABO oder PRO."
      );
    }
    case "subscription_limit_reached": {
      const limit = decision.subscription?.addressLimit ?? SUBSCRIPTION_ADDRESS_LIMIT;
      return (
        `Das Adresskontingent Ihres Tarifs (${limit} Adressen) ist ausgeschöpft. ` +
        "Bereits verwendete Adressen können Sie mit anderen Einstellungen neu berechnen. Nur neue Adressen zählen zum Kontingent."
      );
    }
    case "invalid_address":
      return "Bitte geben Sie eine vollständige Adresse ein.";
    case "unauthenticated":
      return "Bitte melden Sie sich an, um die Berechnung zu starten.";
    default:
      return "Diese Berechnung ist mit Ihrem aktuellen Zugang nicht möglich.";
  }
}
