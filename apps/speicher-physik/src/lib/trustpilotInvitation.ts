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

export type TrustpilotInvitationState = {
  show: boolean;
  recordShown: boolean;
};

function stamp(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Whether the signed-in account still gets the invitation.
 * A failed read stays hidden for that response, so a stored click is not shown again.
 */
export function trustpilotInvitationFromRow(
  row: { trustpilot_clicked_at?: unknown; trustpilot_shown_at?: unknown } | null,
  error: boolean,
): TrustpilotInvitationState {
  if (error || !row || stamp(row.trustpilot_clicked_at)) {
    return { show: false, recordShown: false };
  }
  return { show: true, recordShown: stamp(row.trustpilot_shown_at) === null };
}
