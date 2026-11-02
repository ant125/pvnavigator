import { describe, expect, it } from "vitest";

import {
  ACCOUNT_RECOVERY_INTERVAL_MS,
  ACCOUNT_RECOVERY_RETRY_MS,
  runAccountCheckoutRecovery,
  type AccountRecoveryStamp,
} from "./accountCheckoutRecovery";
import type { OutstandingRecovery } from "./paymentRecovery";

const USER = "11111111-1111-4111-8111-111111111111";

function harness(options?: { customerId?: string | null; sessionId?: string | null; failRead?: boolean }) {
  const memory = new Map<string, AccountRecoveryStamp>();
  const calls: string[] = [];
  const periods = new Set<string>();
  let checkout = {
    customerId: options?.customerId === undefined ? "cus_1" : options.customerId,
    sessionId: options?.sessionId === undefined ? "cs_test_paid" : options.sessionId,
  };
  const deps = {
    memory,
    async readCheckout() {
      if (options?.failRead) throw new Error("database");
      return checkout;
    },
    async recover(userId: string): Promise<OutstandingRecovery> {
      calls.push(userId);
      if (periods.has("in_abo")) {
        return {
          status: "done",
          examined: 1,
          results: [
            {
              status: "already_granted",
              invoiceId: "in_abo",
              subscriptionId: "sub_abo",
              replacementPending: false,
            },
          ],
        };
      }
      periods.add("in_abo");
      return {
        status: "done",
        examined: 1,
        results: [
          {
            status: "granted",
            invoiceId: "in_abo",
            subscriptionId: "sub_abo",
            replacementPending: false,
          },
        ],
      };
    },
  };
  return {
    memory,
    calls,
    periods,
    deps,
    setCheckout(next: typeof checkout) {
      checkout = next;
    },
    run(now: number) {
      return runAccountCheckoutRecovery({ userId: USER, now }, deps);
    },
  };
}

describe("account checkout recovery", () => {
  it("discovers a paid session for the authenticated customer", async () => {
    const account = harness();
    const result = await account.run(1_000);
    expect(result).toMatchObject({
      status: "done",
      results: [{ status: "granted", invoiceId: "in_abo" }],
    });
    expect(account.calls).toEqual([USER]);
    expect(account.periods.size).toBe(1);
  });

  it("does not sweep again on a repeated account load inside the interval", async () => {
    const account = harness();
    await account.run(1_000);
    const again = await account.run(1_000 + ACCOUNT_RECOVERY_INTERVAL_MS - 1);
    expect(again).toEqual({ status: "skipped", reason: "recent" });
    expect(account.calls).toEqual([USER]);
    expect(account.periods.size).toBe(1);

    const later = await account.run(1_000 + ACCOUNT_RECOVERY_INTERVAL_MS);
    expect(later).toMatchObject({
      status: "done",
      results: [{ status: "already_granted", invoiceId: "in_abo" }],
    });
    expect(account.periods.size).toBe(1);
    expect(account.calls).toHaveLength(2);
  });

  it("sweeps immediately when a newer checkout claim replaces the previous session", async () => {
    const account = harness({ sessionId: "cs_test_old" });
    await account.run(1_000);
    account.setCheckout({ customerId: "cus_1", sessionId: "cs_test_new" });
    const next = await account.run(1_000 + 1_000);
    expect(next.status).toBe("done");
    expect(account.calls).toHaveLength(2);
    expect(account.periods.size).toBe(1);
  });

  it("does not call Stripe when the user has no customer", async () => {
    const account = harness({ customerId: null });
    expect(await account.run(1_000)).toEqual({ status: "skipped", reason: "no_customer" });
    expect(account.calls).toEqual([]);
    expect(account.periods.size).toBe(0);
  });

  it("keeps an unpaid recovery from opening a period and leaves the page result non-throwing", async () => {
    const memory = new Map<string, AccountRecoveryStamp>();
    const calls: string[] = [];
    const result = await runAccountCheckoutRecovery(
      { userId: USER, now: 1_000 },
      {
        memory,
        async readCheckout() {
          return { customerId: "cus_1", sessionId: "cs_test_open" };
        },
        async recover(userId) {
          calls.push(userId);
          return { status: "done", examined: 1, results: [{ status: "unpaid" }] };
        },
      },
    );
    expect(result).toEqual({ status: "done", examined: 1, results: [{ status: "unpaid" }] });
    expect(calls).toEqual([USER]);

    const thrown = await runAccountCheckoutRecovery(
      { userId: USER, now: 5_000 },
      {
        memory: new Map(),
        async readCheckout() {
          return { customerId: "cus_1", sessionId: "cs_test_paid" };
        },
        async recover() {
          throw new Error("StripeConnectionError");
        },
      },
    );
    expect(thrown).toEqual({ status: "retry", reason: "unavailable" });

    const retryMemory = new Map<string, AccountRecoveryStamp>();
    let attempts = 0;
    const failing = {
      memory: retryMemory,
      async readCheckout() {
        return { customerId: "cus_1", sessionId: "cs_test_paid" };
      },
      async recover() {
        attempts += 1;
        throw new Error("StripeConnectionError");
      },
    };
    await runAccountCheckoutRecovery({ userId: USER, now: 10_000 }, failing);
    const paused = await runAccountCheckoutRecovery(
      { userId: USER, now: 10_000 + ACCOUNT_RECOVERY_RETRY_MS - 1 },
      failing,
    );
    expect(paused).toEqual({ status: "skipped", reason: "recent" });
    expect(attempts).toBe(1);
  });
});
