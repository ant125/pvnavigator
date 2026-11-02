/**
 * Daily Checkout recovery for the existing billing cron.
 *
 * Known stripe_customers rows are scanned in bounded slices. Each user is
 * passed to the existing outstanding-checkout recovery, which grants a period
 * only after the paid invoice is verified. A Stripe or database error for one
 * user does not stop the others.
 *
 * Progress is the row's updated_at. A finished scan touches that timestamp so
 * the next run takes the customers that have waited longest. A retry is not
 * touched, so it stays at the front. No new table is used.
 *
 * At most CRON_CUSTOMER_BATCH customers are scanned per run. When there are
 * more, CRON_RECENT_CUSTOMER_SLOTS of those places go to the most recently
 * updated rows (a newly linked customer) and the rest to the oldest scans.
 * A paid complete Checkout Session older than the newest
 * CHECKOUT_RECOVERY_SESSION_LIMIT complete sessions is still invisible:
 * Stripe has no payment_status list filter, and the next run starts again at
 * the newest page. stripe_checkout_claims stores one session per user and
 * overwrites it, so it is not a backlog. Finding that older session later
 * needs one stored row per Checkout Session (session id, user id, Stripe
 * customer id), written when Checkout is created, then recovered by session
 * id. That table is not added here.
 */

import { isBillingUserId } from "./stripeEvents";
import type { OutstandingRecovery } from "./paymentRecovery";

export const CRON_CUSTOMER_BATCH = 40;
export const CRON_RECENT_CUSTOMER_SLOTS = 5;
export const CRON_SWEEP_BUDGET_MS = 40_000;

const REASON_LIMIT = 8;

export type CronCustomer = {
  userId: string;
  customerId: string;
  /** ISO timestamp of the last scan, or the row's updated_at before any scan. */
  scannedAt: string;
};

export type CronSweepSummary = {
  customers: number;
  sessions: number;
  recovered: number;
  alreadyGranted: number;
  replacementsFinished: number;
  replacementsPending: number;
  skipped: number;
  retry: number;
  failed: number;
  deferred: number;
  reasons: string[];
  /** True when the sweep itself could not start. Per-customer retries stay false. */
  blocked: boolean;
};

export function emptyCronSweep(reason?: string): CronSweepSummary {
  const reasons: string[] = [];
  if (reason) pushReason(reasons, reason);
  return {
    customers: 0,
    sessions: 0,
    recovered: 0,
    alreadyGranted: 0,
    replacementsFinished: 0,
    replacementsPending: 0,
    skipped: 0,
    retry: 0,
    failed: reason ? 1 : 0,
    deferred: 0,
    reasons,
    blocked: Boolean(reason),
  };
}

/**
 * Oldest scans first, plus the most recently updated rows when the table is
 * larger than one batch. Fewer rows than the batch are all returned.
 */
export function selectCronCustomers(
  rows: readonly CronCustomer[],
  batchSize = CRON_CUSTOMER_BATCH,
  recentSlots = CRON_RECENT_CUSTOMER_SLOTS,
): CronCustomer[] {
  const byUser = new Map<string, CronCustomer>();
  for (const row of rows) {
    if (!isBillingUserId(row.userId) || byUser.has(row.userId)) continue;
    const customerId = row.customerId.trim();
    if (!customerId) continue;
    byUser.set(row.userId, {
      userId: row.userId.trim(),
      customerId,
      scannedAt: typeof row.scannedAt === "string" ? row.scannedAt : "",
    });
  }
  const sorted = [...byUser.values()].sort((left, right) => {
    if (left.scannedAt !== right.scannedAt) return left.scannedAt < right.scannedAt ? -1 : 1;
    if (left.userId === right.userId) return 0;
    return left.userId < right.userId ? -1 : 1;
  });
  if (sorted.length <= batchSize) return sorted;

  const recentCount = Math.max(0, Math.min(recentSlots, batchSize));
  const oldestCount = batchSize - recentCount;
  const chosen: CronCustomer[] = [];
  const seen = new Set<string>();
  const take = (row: CronCustomer) => {
    if (seen.has(row.userId) || chosen.length >= batchSize) return;
    seen.add(row.userId);
    chosen.push(row);
  };
  for (const row of sorted.slice(0, oldestCount)) take(row);
  for (const row of sorted.slice(-recentCount)) take(row);
  for (const row of sorted) {
    if (chosen.length >= batchSize) break;
    take(row);
  }
  return chosen;
}

export async function sweepCronCheckouts(args: {
  customers: readonly { userId: string }[];
  recover: (userId: string) => Promise<OutstandingRecovery>;
  markScanned: (userId: string) => Promise<void>;
  deadlineAt?: number;
  now?: () => number;
}): Promise<CronSweepSummary> {
  const summary = emptyCronSweep();
  const now = args.now ?? Date.now;
  let index = 0;
  for (; index < args.customers.length; index += 1) {
    if (args.deadlineAt !== undefined && now() >= args.deadlineAt) break;
    const customer = args.customers[index];
    if (!customer || !isBillingUserId(customer.userId)) {
      summary.failed += 1;
      pushReason(summary.reasons, "session_user");
      continue;
    }
    summary.customers += 1;
    let result: OutstandingRecovery;
    try {
      result = await args.recover(customer.userId);
    } catch (error) {
      summary.failed += 1;
      pushReason(summary.reasons, safeErrorReason(error));
      console.error("billing cron customer failed", error instanceof Error ? error.name : "error");
      continue;
    }
    if (result.status === "retry") {
      summary.retry += 1;
      pushReason(summary.reasons, result.reason);
      continue;
    }
    if (result.status === "skipped") {
      summary.skipped += 1;
      pushReason(summary.reasons, result.reason);
      await stamp(args.markScanned, customer.userId, summary);
      continue;
    }
    summary.sessions += result.examined;
    let retryInside = false;
    for (const item of result.results) {
      if (item.status === "granted") summary.recovered += 1;
      if (item.status === "already_granted") summary.alreadyGranted += 1;
      if (item.status === "granted" || item.status === "already_granted") {
        if (item.replacementPending) summary.replacementsPending += 1;
        else summary.replacementsFinished += 1;
      }
      if (item.status === "refused") {
        summary.failed += 1;
        pushReason(summary.reasons, item.reason);
      }
      if (item.status === "retry") {
        retryInside = true;
        summary.retry += 1;
        pushReason(summary.reasons, item.reason);
      }
    }
    if (!retryInside) await stamp(args.markScanned, customer.userId, summary);
  }
  summary.deferred = args.customers.length - index;
  summary.reasons.sort();
  return summary;
}

export type BillingCronLog = {
  event: "billing_cron_checkout_recovery";
  customers: number;
  sessions: number;
  recovered: number;
  alreadyGranted: number;
  replacementsFinished: number | null;
  replacementsPending: number;
  replacementUnresolved: number | null;
  skipped: number;
  retry: number;
  failed: number;
  deferred: number;
  renewalsOk: boolean | null;
  reasons: string[];
};

export function billingCronLog(args: {
  recovery: CronSweepSummary;
  replacementUnresolved: number | null;
  replacementsFinished: number | null;
  renewalsOk: boolean | null;
}): BillingCronLog {
  return {
    event: "billing_cron_checkout_recovery",
    customers: args.recovery.customers,
    sessions: args.recovery.sessions,
    recovered: args.recovery.recovered,
    alreadyGranted: args.recovery.alreadyGranted,
    replacementsFinished: args.replacementsFinished,
    replacementsPending: args.recovery.replacementsPending,
    replacementUnresolved: args.replacementUnresolved,
    skipped: args.recovery.skipped,
    retry: args.recovery.retry,
    failed: args.recovery.failed,
    deferred: args.recovery.deferred,
    renewalsOk: args.renewalsOk,
    reasons: args.recovery.reasons,
  };
}

export type BillingCronBody = {
  ok: true;
  unresolved: number;
  replacementsFinished: number;
  recovery: {
    customers: number;
    sessions: number;
    recovered: number;
    alreadyGranted: number;
    replacementsPending: number;
    skipped: number;
    retry: number;
    failed: number;
    deferred: number;
    reasons: string[];
  };
};

export async function runBillingCron(deps: {
  recoverCheckouts: () => Promise<CronSweepSummary>;
  finishReplacements: () => Promise<{ ok: boolean; unresolved: number; finished: number }>;
  finishRenewals: () => Promise<{ ok: boolean }>;
  log?: (entry: BillingCronLog) => void;
}): Promise<{ status: 200 | 500; body: BillingCronBody | null }> {
  const log = deps.log ?? ((entry: BillingCronLog) => {
    console.info(JSON.stringify(entry));
  });
  let recovery: CronSweepSummary;
  let sweepFailed = false;
  try {
    recovery = await deps.recoverCheckouts();
  } catch (error) {
    sweepFailed = true;
    recovery = emptyCronSweep(safeErrorReason(error));
    console.error("billing cron checkout recovery failed", error instanceof Error ? error.name : "error");
  }

  let replacements: { ok: boolean; unresolved: number; finished: number } | null = null;
  let renewalsOk: boolean | null = null;
  try {
    replacements = await deps.finishReplacements();
  } catch (error) {
    console.error(
      "subscription replacement follow-up failed",
      error instanceof Error ? error.name : "error",
    );
    log(billingCronLog({
      recovery,
      replacementUnresolved: null,
      replacementsFinished: null,
      renewalsOk: null,
    }));
    return { status: 500, body: null };
  }
  if (!replacements.ok) {
    log(billingCronLog({
      recovery,
      replacementUnresolved: replacements.unresolved,
      replacementsFinished: replacements.finished,
      renewalsOk: null,
    }));
    return { status: 500, body: null };
  }

  try {
    const renewals = await deps.finishRenewals();
    renewalsOk = renewals.ok;
  } catch (error) {
    console.error("failed renewal follow-up failed", error instanceof Error ? error.name : "error");
    log(billingCronLog({
      recovery,
      replacementUnresolved: replacements.unresolved,
      replacementsFinished: replacements.finished,
      renewalsOk: null,
    }));
    return { status: 500, body: null };
  }

  log(billingCronLog({
    recovery,
    replacementUnresolved: replacements.unresolved,
    replacementsFinished: replacements.finished,
    renewalsOk,
  }));
  if (!renewalsOk || sweepFailed || recovery.blocked) return { status: 500, body: null };
  return {
    status: 200,
    body: {
      ok: true,
      unresolved: replacements.unresolved,
      replacementsFinished: replacements.finished,
      recovery: {
        customers: recovery.customers,
        sessions: recovery.sessions,
        recovered: recovery.recovered,
        alreadyGranted: recovery.alreadyGranted,
        replacementsPending: recovery.replacementsPending,
        skipped: recovery.skipped,
        retry: recovery.retry,
        failed: recovery.failed,
        deferred: recovery.deferred,
        reasons: recovery.reasons,
      },
    },
  };
}

async function stamp(
  markScanned: (userId: string) => Promise<void>,
  userId: string,
  summary: CronSweepSummary,
): Promise<void> {
  try {
    await markScanned(userId);
  } catch (error) {
    summary.failed += 1;
    pushReason(summary.reasons, "scan_stamp");
    console.error("billing cron scan stamp failed", error instanceof Error ? error.name : "error");
  }
}

function pushReason(reasons: string[], reason: string): void {
  if (!reason || reasons.includes(reason) || reasons.length >= REASON_LIMIT) return;
  if (!/^[a-z0-9_]+$/i.test(reason)) return;
  reasons.push(reason);
}

function safeErrorReason(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  return /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(name) ? name : "customer_error";
}
