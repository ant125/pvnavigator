/**
 * Direct Trustpilot link for the PVNAVIGATOR_ account.
 *
 * The official Review Collector renders inside a cross-origin iframe, so a
 * click inside it does not reach this page. This is the same address as the
 * widget fallback. No account data is added to it.
 *
 * `locale` stays `en-US` until the portal language should be sent with the
 * link. The supplied Trustpilot address does not take a locale yet.
 */
export const TRUSTPILOT_REVIEW_LOCALE = "en-US";

export const TRUSTPILOT_REVIEW_URL = "https://www.trustpilot.com/review/pvnavigator.de";

/** Saved calculations required before Mein Konto shows the invitation. */
export const TRUSTPILOT_SAVED_CALCULATION_MINIMUM = {
  privat: 1,
  unternehmen: 3,
} as const;

export type TrustpilotInvitationState = {
  show: boolean;
  recordShown: boolean;
};

const hidden: TrustpilotInvitationState = { show: false, recordShown: false };

function stamp(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function savedCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * Whether this account may see the invitation in Mein Konto.
 * The caller supplies the account type, the saved-calculation count, and the
 * stamps read on the server. A failed read stays hidden, so a stored click is
 * not shown again. An existing stamp is not cleared.
 */
export function trustpilotInvitationForAccount(input: {
  accountKind: unknown;
  savedCalculations: unknown;
  trustpilotShownAt: unknown;
  trustpilotClickedAt: unknown;
  error: boolean;
}): TrustpilotInvitationState {
  const accountKind = input.accountKind === "privat" || input.accountKind === "unternehmen"
    ? input.accountKind
    : null;
  const savedCalculations = savedCount(input.savedCalculations);
  if (input.error || !accountKind || savedCalculations === null || stamp(input.trustpilotClickedAt)) {
    return hidden;
  }
  if (savedCalculations < TRUSTPILOT_SAVED_CALCULATION_MINIMUM[accountKind]) return hidden;
  return { show: true, recordShown: stamp(input.trustpilotShownAt) === null };
}
