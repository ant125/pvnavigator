import {
  REPLACEMENT_CANCEL_PARAMS,
  replacementAlreadyEnded,
  replacementCancelTarget,
  type LoadedSubscription,
} from "./upgradeReplacement";

/**
 * Ends a failed monthly renewal. No extra invoice and no proration.
 * The same parameters already end an ABO subscription after a PRO upgrade.
 */
export const RENEWAL_CANCEL_PARAMS = REPLACEMENT_CANCEL_PARAMS;

export type FailedRenewalInvoice = {
  invoiceId: string;
  subscriptionId: string | null;
  customerId: string | null;
  /** Present when the caller has not already filtered the row. */
  billingReason?: string | null;
  status?: string | null;
  subscriptionPeriodId?: string | null;
};

/** The only rows this follow-up may close. Checkout and upgrades use another reason. */
export function isRenewalFailureInvoice(row: {
  status: string | null;
  billingReason: string | null;
  subscriptionPeriodId: string | null;
}): boolean {
  return (
    row.status === "payment_failed" &&
    row.billingReason === "subscription_cycle" &&
    row.subscriptionPeriodId == null
  );
}

export type RenewalFinishResult = {
  /** False when Stripe failed temporarily. Settled rows stay settled. */
  ok: boolean;
};

/**
 * Voids an open renewal invoice, then ends its subscription.
 * A paid invoice is left alone. An already void invoice only needs the cancel.
 * An already canceled subscription is success. Nothing here opens a period.
 */
export async function finishFailedRenewalInvoices(args: {
  pending: FailedRenewalInvoice[];
  loadInvoice: (invoiceId: string) => Promise<{ status: string }>;
  voidInvoice: (invoiceId: string) => Promise<void>;
  loadSubscription: (subscriptionId: string) => Promise<LoadedSubscription>;
  cancelSubscription: (subscriptionId: string) => Promise<void>;
  cancelSchedule: (scheduleId: string) => Promise<void>;
  settleVoid: (row: FailedRenewalInvoice) => Promise<void>;
  settlePaid: (row: FailedRenewalInvoice) => Promise<void>;
  onBlocked?: (invoiceId: string, reason: "shape" | "customer_mismatch" | "stripe_error") => void;
}): Promise<RenewalFinishResult> {
  for (const row of args.pending) {
    if (!eligible(row)) {
      args.onBlocked?.(row.invoiceId, "shape");
      continue;
    }
    try {
      const opened = await ensureVoid(args, row);
      if (opened === "paid") {
        await args.settlePaid(row);
        continue;
      }
      if (opened !== "void") {
        args.onBlocked?.(row.invoiceId, "shape");
        continue;
      }
      const ended = await endSubscription(args, row);
      if (ended === "mismatch") {
        args.onBlocked?.(row.invoiceId, "customer_mismatch");
        continue;
      }
      if (ended === "missing") {
        args.onBlocked?.(row.invoiceId, "shape");
        continue;
      }
      if (ended !== "ended") continue;
      await args.settleVoid(row);
    } catch (error) {
      args.onBlocked?.(row.invoiceId, "stripe_error");
      if (replacementAlreadyEnded(error)) continue;
      return { ok: false };
    }
  }
  return { ok: true };
}

function eligible(row: FailedRenewalInvoice): boolean {
  if (!row.invoiceId.trim()) return false;
  if (row.billingReason != null && row.billingReason !== "subscription_cycle") return false;
  if (row.status != null && row.status !== "payment_failed") return false;
  if (row.subscriptionPeriodId) return false;
  return true;
}

async function ensureVoid(
  args: {
    loadInvoice: (invoiceId: string) => Promise<{ status: string }>;
    voidInvoice: (invoiceId: string) => Promise<void>;
  },
  row: FailedRenewalInvoice,
): Promise<string> {
  const before = await args.loadInvoice(row.invoiceId);
  if (before.status === "paid" || before.status === "void") return before.status;
  if (before.status !== "open") return before.status;
  try {
    await args.voidInvoice(row.invoiceId);
  } catch (error) {
    const again = await args.loadInvoice(row.invoiceId);
    if (again.status === "paid" || again.status === "void") return again.status;
    throw error;
  }
  const after = await args.loadInvoice(row.invoiceId);
  if (after.status === "paid" || after.status === "void") return after.status;
  throw new Error("renewal invoice stayed open");
}

async function endSubscription(
  args: {
    loadSubscription: (subscriptionId: string) => Promise<LoadedSubscription>;
    cancelSubscription: (subscriptionId: string) => Promise<void>;
    cancelSchedule: (scheduleId: string) => Promise<void>;
  },
  row: FailedRenewalInvoice,
): Promise<"ended" | "mismatch" | "missing"> {
  if (!row.subscriptionId || !row.customerId) return "missing";
  let loaded: LoadedSubscription;
  try {
    loaded = await args.loadSubscription(row.subscriptionId);
  } catch (error) {
    if (replacementAlreadyEnded(error)) return "ended";
    throw error;
  }
  if (loaded.customerId !== row.customerId) return "mismatch";
  const target = replacementCancelTarget(loaded);
  try {
    if (target.action === "cancel_schedule") await args.cancelSchedule(target.id);
    if (target.action === "cancel_subscription") await args.cancelSubscription(target.id);
  } catch (error) {
    if (!replacementAlreadyEnded(error)) throw error;
  }
  return "ended";
}
