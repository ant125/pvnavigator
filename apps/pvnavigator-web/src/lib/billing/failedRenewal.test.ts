import { describe, expect, it } from "vitest";

import {
  RENEWAL_CANCEL_PARAMS,
  finishFailedRenewalInvoices,
  isRenewalFailureInvoice,
  type FailedRenewalInvoice,
} from "./failedRenewal";
import type { LoadedSubscription } from "./upgradeReplacement";

const cycle: FailedRenewalInvoice = {
  invoiceId: "in_cycle",
  subscriptionId: "sub_abo",
  customerId: "cus_1",
  billingReason: "subscription_cycle",
  status: "payment_failed",
  subscriptionPeriodId: null,
};

function subscription(overrides: Partial<LoadedSubscription> = {}): LoadedSubscription {
  return {
    id: "sub_abo",
    status: "past_due",
    scheduleId: null,
    customerId: "cus_1",
    ...overrides,
  };
}

describe("renewal failure selection", () => {
  it("accepts only an unpaid monthly renewal that never opened a period", () => {
    expect(
      isRenewalFailureInvoice({
        status: "payment_failed",
        billingReason: "subscription_cycle",
        subscriptionPeriodId: null,
      }),
    ).toBe(true);
    expect(
      isRenewalFailureInvoice({
        status: "payment_failed",
        billingReason: "subscription_create",
        subscriptionPeriodId: null,
      }),
    ).toBe(false);
    expect(
      isRenewalFailureInvoice({
        status: "paid",
        billingReason: "subscription_cycle",
        subscriptionPeriodId: null,
      }),
    ).toBe(false);
    expect(
      isRenewalFailureInvoice({
        status: "void",
        billingReason: "subscription_cycle",
        subscriptionPeriodId: null,
      }),
    ).toBe(false);
    expect(
      isRenewalFailureInvoice({
        status: "payment_failed",
        billingReason: "subscription_cycle",
        subscriptionPeriodId: "period-1",
      }),
    ).toBe(false);
  });

  it("cancels without a final invoice or proration", () => {
    expect(RENEWAL_CANCEL_PARAMS).toEqual({ invoice_now: false, prorate: false });
  });
});

describe("finishFailedRenewalInvoices", () => {
  it("voids an open renewal invoice, then cancels the subscription, and opens no period", async () => {
    const actions: string[] = [];
    let stripeStatus = "open";
    let subStatus = "past_due";
    let local = "payment_failed";
    const run = () =>
      finishFailedRenewalInvoices({
        pending: local === "payment_failed" ? [cycle] : [],
        async loadInvoice() {
          return { status: stripeStatus };
        },
        async voidInvoice() {
          actions.push("void");
          stripeStatus = "void";
        },
        async loadSubscription() {
          return subscription({ status: subStatus });
        },
        async cancelSubscription() {
          actions.push("cancel-subscription");
          subStatus = "canceled";
        },
        async cancelSchedule() {
          actions.push("cancel-schedule");
        },
        async settleVoid() {
          actions.push("settle-void");
          local = "void";
        },
        async settlePaid() {
          actions.push("settle-paid");
        },
      });

    const first = await run();
    const second = await run();
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(actions).toEqual(["void", "cancel-subscription", "settle-void"]);
    expect(stripeStatus).toBe("void");
    expect(subStatus).toBe("canceled");
  });

  it("cancels a schedule with the subscription so a later phase cannot charge", async () => {
    const actions: string[] = [];
    let stripeStatus = "open";
    const result = await finishFailedRenewalInvoices({
      pending: [cycle],
      async loadInvoice() {
        return { status: stripeStatus };
      },
      async voidInvoice() {
        actions.push("void");
        stripeStatus = "void";
      },
      async loadSubscription(id) {
        actions.push(`load-after-void:${id}`);
        return subscription({ scheduleId: "sub_sched_1" });
      },
      async cancelSubscription() {
        actions.push("cancel-subscription");
      },
      async cancelSchedule(id) {
        actions.push(`cancel-schedule:${id}`);
      },
      async settleVoid() {
        actions.push("settle-void");
      },
      async settlePaid() {
        throw new Error("paid settlement");
      },
    });
    expect(result).toEqual({ ok: true });
    expect(actions).toEqual([
      "void",
      "load-after-void:sub_abo",
      "cancel-schedule:sub_sched_1",
      "settle-void",
    ]);
  });

  it("does not void or cancel when the re-read invoice is already paid", async () => {
    const actions: string[] = [];
    const result = await finishFailedRenewalInvoices({
      pending: [cycle],
      async loadInvoice() {
        actions.push("load");
        return { status: "paid" };
      },
      async voidInvoice() {
        actions.push("void");
      },
      async loadSubscription() {
        actions.push("load-subscription");
        return subscription();
      },
      async cancelSubscription() {
        actions.push("cancel-subscription");
      },
      async cancelSchedule() {
        actions.push("cancel-schedule");
      },
      async settleVoid() {
        actions.push("settle-void");
      },
      async settlePaid() {
        actions.push("settle-paid");
      },
    });
    expect(result).toEqual({ ok: true });
    expect(actions).toEqual(["load", "settle-paid"]);
  });

  it("finishes a void invoice by canceling, and skips a second cancel when the subscription is already canceled", async () => {
    const actions: string[] = [];
    let subStatus = "past_due";
    const run = (status: string) =>
      finishFailedRenewalInvoices({
        pending: [cycle],
        async loadInvoice() {
          return { status: "void" };
        },
        async voidInvoice() {
          actions.push("void");
        },
        async loadSubscription() {
          return subscription({ status: subStatus });
        },
        async cancelSubscription() {
          actions.push("cancel-subscription");
          subStatus = "canceled";
        },
        async cancelSchedule() {
          actions.push("cancel-schedule");
        },
        async settleVoid() {
          actions.push(`settle-void:${status}`);
        },
        async settlePaid() {
          actions.push("settle-paid");
        },
      });

    expect(await run("first")).toEqual({ ok: true });
    expect(await run("second")).toEqual({ ok: true });
    expect(actions).toEqual(["cancel-subscription", "settle-void:first", "settle-void:second"]);
  });

  it("keeps the invoice pending when cancel fails after the void, then finishes on retry", async () => {
    const actions: string[] = [];
    let stripeStatus = "open";
    let failCancel = true;
    const run = () =>
      finishFailedRenewalInvoices({
        pending: [cycle],
        async loadInvoice() {
          return { status: stripeStatus };
        },
        async voidInvoice() {
          actions.push("void");
          stripeStatus = "void";
        },
        async loadSubscription() {
          return subscription();
        },
        async cancelSubscription() {
          actions.push("cancel-subscription");
          if (failCancel) {
            failCancel = false;
            throw new Error("stripe unavailable");
          }
        },
        async cancelSchedule() {
          throw new Error("schedule");
        },
        async settleVoid() {
          actions.push("settle-void");
        },
        async settlePaid() {
          actions.push("settle-paid");
        },
      });

    expect(await run()).toEqual({ ok: false });
    expect(await run()).toEqual({ ok: true });
    expect(actions).toEqual(["void", "cancel-subscription", "cancel-subscription", "settle-void"]);
  });

  it("leaves a first checkout failure and an upgrade failure untouched", async () => {
    const actions: string[] = [];
    const result = await finishFailedRenewalInvoices({
      pending: [
        { ...cycle, invoiceId: "in_checkout", billingReason: "subscription_create" },
        {
          ...cycle,
          invoiceId: "in_upgrade",
          billingReason: "subscription_create",
          subscriptionId: "sub_pro",
        },
      ],
      async loadInvoice() {
        actions.push("load");
        return { status: "open" };
      },
      async voidInvoice() {
        actions.push("void");
      },
      async loadSubscription() {
        return subscription();
      },
      async cancelSubscription() {
        actions.push("cancel-subscription");
      },
      async cancelSchedule() {
        actions.push("cancel-schedule");
      },
      async settleVoid() {
        actions.push("settle-void");
      },
      async settlePaid() {
        actions.push("settle-paid");
      },
    });
    expect(result).toEqual({ ok: true });
    expect(actions).toEqual([]);
  });

  it("treats a missing subscription as already ended", async () => {
    const actions: string[] = [];
    const result = await finishFailedRenewalInvoices({
      pending: [cycle],
      async loadInvoice() {
        return { status: "void" };
      },
      async voidInvoice() {
        actions.push("void");
      },
      async loadSubscription() {
        throw { code: "resource_missing" };
      },
      async cancelSubscription() {
        actions.push("cancel-subscription");
      },
      async cancelSchedule() {
        actions.push("cancel-schedule");
      },
      async settleVoid() {
        actions.push("settle-void");
      },
      async settlePaid() {
        actions.push("settle-paid");
      },
    });
    expect(result).toEqual({ ok: true });
    expect(actions).toEqual(["settle-void"]);
  });
});
