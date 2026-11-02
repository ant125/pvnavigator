import { describe, expect, it } from "vitest";

import {
  REPLACEMENT_CANCEL_PARAMS,
  finishPendingSubscriptionReplacements,
  replacementAlreadyEnded,
  replacementCancelTarget,
  type PendingReplacement,
} from "./upgradeReplacement";

const pending: PendingReplacement = {
  invoiceId: "in_pro",
  replacesSubscriptionId: "sub_abo",
  customerId: "cus_1",
};

describe("replacement cancel", () => {
  it("cancels a schedule instead of the subscription, without a final invoice or proration", () => {
    expect(REPLACEMENT_CANCEL_PARAMS).toEqual({ invoice_now: false, prorate: false });
    expect(
      replacementCancelTarget({ id: "sub_abo", status: "active", scheduleId: "sub_sched_1" }),
    ).toEqual({ action: "cancel_schedule", id: "sub_sched_1" });
    expect(
      replacementCancelTarget({ id: "sub_abo", status: "active", scheduleId: null }),
    ).toEqual({ action: "cancel_subscription", id: "sub_abo" });
    expect(
      replacementCancelTarget({ id: "sub_abo", status: "canceled", scheduleId: "sub_sched_1" }),
    ).toEqual({ action: "none" });
    expect(replacementAlreadyEnded({ code: "resource_missing" })).toBe(true);
    expect(replacementAlreadyEnded(new Error("network"))).toBe(false);
  });

  it("keeps the follow-up pending when cancel fails, then finishes it on retry", async () => {
    const completed: string[] = [];
    let attempts = 0;
    const first = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: null, customerId: "cus_1" };
      },
      async cancelSubscription() {
        attempts += 1;
        throw new Error("stripe unavailable");
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(first).toEqual({ ok: false, unresolved: 0, finished: 0 });
    expect(completed).toEqual([]);

    const second = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: null, customerId: "cus_1" };
      },
      async cancelSubscription() {
        attempts += 1;
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(second).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(attempts).toBe(2);
    expect(completed).toEqual(["in_pro"]);
  });

  it("finishes an already ended subscription without canceling it again", async () => {
    const canceled: string[] = [];
    const completed: string[] = [];
    const ok = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "canceled", scheduleId: null, customerId: "cus_1" };
      },
      async cancelSubscription() {
        canceled.push("subscription");
      },
      async cancelSchedule() {
        canceled.push("schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(ok).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(canceled).toEqual([]);
    expect(completed).toEqual(["in_pro"]);
  });

  it("treats a missing subscription as already ended", async () => {
    const completed: string[] = [];
    const ok = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        throw { code: "resource_missing" };
      },
      async cancelSubscription() {
        throw new Error("should not cancel");
      },
      async cancelSchedule() {
        throw new Error("should not cancel");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(ok).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(completed).toEqual(["in_pro"]);
  });

  it("does not cancel a subscription that belongs to another customer", async () => {
    const canceled: string[] = [];
    const completed: string[] = [];
    const ok = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: null, customerId: "cus_other" };
      },
      async cancelSubscription() {
        canceled.push("subscription");
      },
      async cancelSchedule() {
        canceled.push("schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(ok).toEqual({ ok: true, unresolved: 1, finished: 0 });
    expect(canceled).toEqual([]);
    expect(completed).toEqual([]);
  });

  it("leaves a replacement pending when the invoice has no customer id", async () => {
    const completed: string[] = [];
    const blocked: string[] = [];
    const result = await finishPendingSubscriptionReplacements({
      pending: [{ ...pending, customerId: null }],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: null, customerId: "cus_1" };
      },
      async cancelSubscription() {
        throw new Error("should not cancel");
      },
      async cancelSchedule() {
        throw new Error("should not cancel");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
      onBlocked(invoiceId, reason) {
        blocked.push(`${reason}:${invoiceId}`);
      },
    });
    expect(result).toEqual({ ok: true, unresolved: 1, finished: 0 });
    expect(completed).toEqual([]);
    expect(blocked).toEqual(["customer_mismatch:in_pro"]);
  });

  it("does not cancel again after the follow-up has been removed from the pending list", async () => {
    const canceled: string[] = [];
    const completed: string[] = [];
    const first = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: null, customerId: "cus_1" };
      },
      async cancelSubscription() {
        canceled.push("subscription");
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    const second = await finishPendingSubscriptionReplacements({
      pending: [],
      async load() {
        throw new Error("should not load");
      },
      async cancelSubscription() {
        canceled.push("again");
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete() {
        throw new Error("should not complete");
      },
    });
    expect(first).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(second).toEqual({ ok: true, unresolved: 0, finished: 0 });
    expect(canceled).toEqual(["subscription"]);
    expect(completed).toEqual(["in_pro"]);
  });

  it("cancels the schedule so a later phase cannot charge", async () => {
    const schedules: string[] = [];
    const ok = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: "sub_sched_1", customerId: "cus_1" };
      },
      async cancelSubscription() {
        throw new Error("should cancel the schedule");
      },
      async cancelSchedule(id) {
        schedules.push(id);
      },
      async complete() {},
    });
    expect(ok).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(schedules).toEqual(["sub_sched_1"]);
  });

  it("finishes the next customer when the first cancel fails", async () => {
    const canceled: string[] = [];
    const completed: string[] = [];
    const first = await finishPendingSubscriptionReplacements({
      pending: [
        pending,
        {
          invoiceId: "in_other",
          replacesSubscriptionId: "sub_other",
          customerId: "cus_2",
        },
      ],
      async load(id) {
        return {
          id,
          status: "active",
          scheduleId: null,
          customerId: id === "sub_other" ? "cus_2" : "cus_1",
        };
      },
      async cancelSubscription(id) {
        if (id === "sub_abo") throw new Error("stripe unavailable");
        canceled.push(id);
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(first).toEqual({ ok: false, unresolved: 0, finished: 1 });
    expect(canceled).toEqual(["sub_other"]);
    expect(completed).toEqual(["in_other"]);

    const second = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: null, customerId: "cus_1" };
      },
      async cancelSubscription(id) {
        canceled.push(id);
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(second).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(canceled).toEqual(["sub_other", "sub_abo"]);
    expect(completed).toEqual(["in_other", "in_pro"]);
  });

  it("synchronizes a finished replacement without canceling it again", async () => {
    const canceled: string[] = [];
    const completed: string[] = [];
    const stale = { ...pending, statusSyncOnly: true };
    const first = await finishPendingSubscriptionReplacements({
      pending: [stale],
      async load() {
        throw new Error("should not load Stripe");
      },
      async cancelSubscription() {
        canceled.push("subscription");
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    const second = await finishPendingSubscriptionReplacements({
      pending: [],
      async load() {
        throw new Error("should not load Stripe");
      },
      async cancelSubscription() {
        canceled.push("again");
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete() {
        throw new Error("should not complete");
      },
    });
    expect(first).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(second).toEqual({ ok: true, unresolved: 0, finished: 0 });
    expect(canceled).toEqual([]);
    expect(completed).toEqual(["in_pro"]);
  });

  it("retries a finished replacement when the status update fails", async () => {
    const canceled: string[] = [];
    const completed: string[] = [];
    let fail = true;
    const stale = { ...pending, statusSyncOnly: true };
    const run = () =>
      finishPendingSubscriptionReplacements({
        pending: [stale],
        async load() {
          throw new Error("should not load Stripe");
        },
        async cancelSubscription() {
          canceled.push("subscription");
        },
        async cancelSchedule() {
          throw new Error("should not cancel a schedule");
        },
        async complete(invoiceId) {
          if (fail) throw new Error("database");
          completed.push(invoiceId);
        },
      });
    const first = await run();
    fail = false;
    const second = await run();
    expect(first).toEqual({ ok: false, unresolved: 0, finished: 0 });
    expect(second).toEqual({ ok: true, unresolved: 0, finished: 1 });
    expect(canceled).toEqual([]);
    expect(completed).toEqual(["in_pro"]);
  });

  it("does not finish a replacement whose Stripe cancellation failed", async () => {
    const completed: string[] = [];
    const result = await finishPendingSubscriptionReplacements({
      pending: [pending],
      async load() {
        return { id: "sub_abo", status: "active", scheduleId: null, customerId: "cus_1" };
      },
      async cancelSubscription() {
        throw new Error("stripe unavailable");
      },
      async cancelSchedule() {
        throw new Error("should not cancel a schedule");
      },
      async complete(invoiceId) {
        completed.push(invoiceId);
      },
    });
    expect(result).toEqual({ ok: false, unresolved: 0, finished: 0 });
    expect(completed).toEqual([]);
  });
});
