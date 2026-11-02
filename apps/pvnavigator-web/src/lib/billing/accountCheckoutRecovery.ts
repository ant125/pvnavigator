import type { OutstandingRecovery } from "./paymentRecovery";

/** After a completed sweep, /konto does not list Checkout Sessions again until this elapses. */
export const ACCOUNT_RECOVERY_INTERVAL_MS = 60_000;

/** A failed sweep may be tried again after this shorter pause. */
export const ACCOUNT_RECOVERY_RETRY_MS = 15_000;

export type AccountRecoveryStamp = {
  at: number;
  sessionId: string | null;
  retry: boolean;
};

export type AccountCheckoutSnapshot = {
  customerId: string | null;
  sessionId: string | null;
};

export type AccountRecoveryOutcome = OutstandingRecovery | { status: "skipped"; reason: "recent" | "no_customer" };

/**
 * True when this account should list Stripe Checkout Sessions.
 * A new claim session is swept immediately. The same claim waits out the interval,
 * so a paid session that the claim row no longer stores is still found on the next sweep.
 */
export function accountRecoveryDue(
  previous: AccountRecoveryStamp | null,
  claimSessionId: string | null,
  now: number,
): boolean {
  if (!previous) return true;
  if (claimSessionId && claimSessionId !== previous.sessionId) return true;
  const wait = previous.retry ? ACCOUNT_RECOVERY_RETRY_MS : ACCOUNT_RECOVERY_INTERVAL_MS;
  return now - previous.at >= wait;
}

/**
 * Runs the shared outstanding recovery for one authenticated user.
 * No Stripe customer means no Stripe request. A recent sweep is not repeated.
 */
export async function runAccountCheckoutRecovery(
  input: { userId: string; now: number },
  deps: {
    memory: Map<string, AccountRecoveryStamp>;
    readCheckout: (userId: string) => Promise<AccountCheckoutSnapshot>;
    recover: (userId: string) => Promise<OutstandingRecovery>;
  },
): Promise<AccountRecoveryOutcome> {
  let checkout: AccountCheckoutSnapshot;
  try {
    checkout = await deps.readCheckout(input.userId);
  } catch {
    const previous = deps.memory.get(input.userId) ?? null;
    if (previous?.retry && !accountRecoveryDue(previous, null, input.now)) {
      return { status: "retry", reason: "unavailable" };
    }
    deps.memory.set(input.userId, {
      at: input.now,
      sessionId: previous?.sessionId ?? null,
      retry: true,
    });
    return { status: "retry", reason: "unavailable" };
  }

  if (!checkout.customerId) return { status: "skipped", reason: "no_customer" };

  const previous = deps.memory.get(input.userId) ?? null;
  if (!accountRecoveryDue(previous, checkout.sessionId, input.now)) {
    return { status: "skipped", reason: "recent" };
  }

  try {
    const result = await deps.recover(input.userId);
    deps.memory.set(input.userId, {
      at: input.now,
      sessionId: checkout.sessionId,
      retry: result.status === "retry",
    });
    return result;
  } catch {
    deps.memory.set(input.userId, {
      at: input.now,
      sessionId: checkout.sessionId,
      retry: true,
    });
    return { status: "retry", reason: "unavailable" };
  }
}
