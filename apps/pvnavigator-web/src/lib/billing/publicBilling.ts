/**
 * Paid checkout, upgrades, plan changes, the customer portal and billing
 * maintenance stay in this repository. The public product does not start
 * them and does not change Stripe customers, subscriptions or invoices.
 *
 * Set this to true only when monetization is explicitly turned back on.
 */
export const PUBLIC_PAID_BILLING_ENABLED = false;

export function paidBillingPaused(): boolean {
  return !PUBLIC_PAID_BILLING_ENABLED;
}
