import { describe, expect, it } from "vitest";

import {
  billingCronLog,
  emptyCronSweep,
  runBillingCron,
  selectCronCustomers,
  sweepCronCheckouts,
  type BillingCronLog,
  type CronCustomer,
} from "./cronCheckoutRecovery";
import {
  CHECKOUT_RECOVERY_SESSION_LIMIT,
  checkoutSessionListParams,
  recoverOutstandingCheckouts,
  type CheckoutRecoveryDeps,
  type RecoveryResult,
} from "./paymentRecovery";
import { finishPendingSubscriptionReplacements, type PendingReplacement } from "./upgradeReplacement";
import { commandPayload, type AllowedPrice, type BillingCommand } from "./stripeEvents";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const CATALOG: AllowedPrice[] = [
  { priceId: "price_starter", amount: 900, currency: "eur", planKey: "pvnavigator_starter", addressLimit: 10 },
  { priceId: "price_abo", amount: 2900, currency: "eur", planKey: "pvnavigator_abo", addressLimit: 50 },
  { priceId: "price_pro", amount: 5900, currency: "eur", planKey: "pvnavigator_pro", addressLimit: 200 },
];
const PERIOD = { start: 1_760_000_000, end: 1_762_592_000 };
const STAMP = "2026-10-25T04:17:00.000Z";

type Spec = {
  sessionId: string;
  invoiceId: string;
  subscriptionId: string;
  priceId: string;
  amount: number;
  planKey: string;
  replaces?: string | null;
  paymentStatus?: string;
  sessionStatus?: string;
  invoiceStatus?: string;
  customerId?: string;
  userId?: string;
  livemode?: boolean;
};

function buildCheckout(spec: Spec) {
  const userId = spec.userId ?? A;
  const customerId = spec.customerId ?? "cus_a";
  const metadata: Record<string, string> = { user_id: userId, plan_key: spec.planKey };
  if (spec.replaces) metadata.replaces_subscription_id = spec.replaces;
  const invoice = {
    id: spec.invoiceId,
    object: "invoice",
    amount_paid: spec.invoiceStatus === "open" ? 0 : spec.amount,
    currency: "eur",
    billing_reason: "subscription_create",
    customer: customerId,
    status: spec.invoiceStatus ?? "paid",
    livemode: spec.livemode ?? false,
    metadata: {},
    payment_intent: "pi_1",
    parent: {
      type: "subscription_details",
      subscription_details: { subscription: spec.subscriptionId, metadata },
    },
    lines: {
      data: [
        {
          id: "il_1",
          period: PERIOD,
          pricing: { type: "price_details", price_details: { price: spec.priceId, product: "prod_1" } },
          parent: { type: "subscription_item_details", subscription_item_details: { proration: false } },
        },
      ],
    },
  };
  const session = {
    id: spec.sessionId,
    object: "checkout.session",
    mode: "subscription",
    payment_status: spec.paymentStatus ?? "paid",
    status: spec.sessionStatus ?? "complete",
    livemode: spec.livemode ?? false,
    customer: customerId,
    client_reference_id: userId,
    metadata,
    subscription: spec.subscriptionId,
    invoice: spec.invoiceId,
    amount_total: spec.amount,
    currency: "eur",
    payment_intent: "pi_1",
  };
  const subscription = {
    id: spec.subscriptionId,
    customer: customerId,
    status: "active",
    metadata,
    latest_invoice: "in_later_renewal",
  };
  return { session, invoice, subscription, sessionId: spec.sessionId, invoiceId: spec.invoiceId };
}

function catalogAccepts(command: Extract<BillingCommand, { action: "invoice_paid" }>): boolean {
  const currency = command.currency.toLowerCase();
  return command.allowedPrices.some((entry) => {
    const known =
      (entry.planKey === "pvnavigator_starter" && entry.amount === 900 && entry.addressLimit === 10) ||
      (entry.planKey === "pvnavigator_abo" && entry.amount === 2900 && entry.addressLimit === 50) ||
      (entry.planKey === "pvnavigator_pro" && entry.amount === 5900 && entry.addressLimit === 200);
    return (
      known &&
      entry.priceId === command.priceId &&
      entry.amount === command.amountPaid &&
      entry.currency.toLowerCase() === currency
    );
  });
}

function billingWorld(options?: { cancelFailures?: number }) {
  const customers: CronCustomer[] = [];
  const sessions = new Map<string, unknown[]>();
  const built = new Map<string, ReturnType<typeof buildCheckout>>();
  const listFails = new Set<string>();
  const owned = new Set<string>();
  const scanned: string[] = [];
  const periods = new Map<string, { userId: string; invoiceId: string }>();
  const commands: BillingCommand[] = [];
  const events: string[] = [];
  const pending: PendingReplacement[] = [];
  const finished = new Set<string>();
  const cancels: string[] = [];
  let applyCount = 0;
  let cancelFailures = options?.cancelFailures ?? 0;
  let currentUser = "";

  const deps: CheckoutRecoveryDeps & {
    customerIdForUser: (userId: string) => Promise<string | null>;
    listCheckoutSessions: (customerId: string) => Promise<unknown[]>;
  } = {
    catalog: CATALOG,
    async retrieveSession(sessionId) {
      const row = built.get(sessionId);
      if (!row || row.sessionId !== sessionId) throw new Error("unexpected session");
      return row.session;
    },
    async retrieveInvoice(invoiceId) {
      const row = built.get(invoiceId);
      if (!row || row.invoiceId !== invoiceId) throw new Error("unexpected invoice");
      return row.invoice;
    },
    async retrieveSubscription(subscriptionId) {
      const row = [...built.values()].find((item) => item.subscription.id === subscriptionId);
      if (!row) throw new Error("unexpected subscription");
      return row.subscription;
    },
    async listSubscriptionInvoices() {
      return [];
    },
    async resolveUser(customerId, candidate) {
      const row = customers.find((item) => item.userId === candidate);
      if (!row || !candidate || row.customerId !== customerId) return { mismatch: true as const };
      return { userId: candidate };
    },
    async periodForInvoice(invoiceId) {
      const row = periods.get(invoiceId);
      if (!row) return "none";
      return row.userId === currentUser ? "own" : "foreign";
    },
    async replacesOwner(_userId, subscriptionId) {
      return owned.has(subscriptionId) ? "owned" : "foreign";
    },
    async apply(args) {
      applyCount += 1;
      commands.push(args.command);
      if (args.livemode || args.command.action !== "invoice_paid") {
        return { ok: true as const, outcome: "ignored" };
      }
      if (events.includes(args.eventId)) return { ok: true as const, outcome: "duplicate" };
      events.push(args.eventId);
      if (!catalogAccepts(args.command)) return { ok: true as const, outcome: "ignored" };
      if (!periods.has(args.command.invoiceId)) {
        periods.set(args.command.invoiceId, {
          userId: args.command.userId,
          invoiceId: args.command.invoiceId,
        });
        if (args.command.replacesSubscriptionId) {
          pending.push({
            invoiceId: args.command.invoiceId,
            replacesSubscriptionId: args.command.replacesSubscriptionId,
            customerId: args.command.customerId,
          });
        }
      }
      return { ok: true as const, outcome: "processed" };
    },
    async finishReplacements() {
      return finishPendingSubscriptionReplacements({
        pending: pending.filter((row) => !finished.has(row.invoiceId)),
        async load(id) {
          if (cancelFailures > 0) {
            cancelFailures -= 1;
            throw new Error("network");
          }
          const row = pending.find((item) => item.replacesSubscriptionId === id);
          return { id, status: "active", scheduleId: null, customerId: row?.customerId ?? "" };
        },
        async cancelSubscription(id) {
          cancels.push(id);
        },
        async cancelSchedule() {
          throw new Error("schedule");
        },
        async complete(invoiceId) {
          finished.add(invoiceId);
        },
      });
    },
    async customerIdForUser(userId) {
      return customers.find((item) => item.userId === userId)?.customerId ?? null;
    },
    async listCheckoutSessions(customerId) {
      const owner = customers.find((item) => item.customerId === customerId);
      if (owner && listFails.has(owner.userId)) {
        const error = new Error("stripe down");
        error.name = "StripeConnectionError";
        throw error;
      }
      return sessions.get(customerId) ?? [];
    },
  };

  return {
    customers,
    scanned,
    commands,
    cancels,
    periods,
    listFails,
    own(subscriptionId: string) {
      owned.add(subscriptionId);
    },
    addCustomer(userId: string, customerId: string, scannedAt = "2026-01-01T00:00:00.000Z") {
      customers.push({ userId, customerId, scannedAt });
    },
    addCheckout(userId: string, customerId: string, spec: Spec) {
      const row = buildCheckout({ ...spec, userId, customerId });
      const list = sessions.get(customerId) ?? [];
      list.push(row.session);
      sessions.set(customerId, list);
      built.set(row.sessionId, row);
      built.set(row.invoiceId, row);
    },
    seedPeriod(userId: string, invoiceId: string) {
      periods.set(invoiceId, { userId, invoiceId });
    },
    get applyCount() {
      return applyCount;
    },
    finish() {
      return deps.finishReplacements();
    },
    sweep(options?: {
      batchSize?: number;
      recentSlots?: number;
      deadlineAt?: number;
      now?: () => number;
      beforeRecover?: () => void;
    }) {
      const selected = selectCronCustomers(customers, options?.batchSize, options?.recentSlots);
      return sweepCronCheckouts({
        customers: selected,
        deadlineAt: options?.deadlineAt,
        now: options?.now,
        recover: async (userId) => {
          options?.beforeRecover?.();
          currentUser = userId;
          return recoverOutstandingCheckouts(deps, { userId });
        },
        async markScanned(userId) {
          const row = customers.find((item) => item.userId === userId);
          if (row) row.scannedAt = STAMP;
          scanned.push(userId);
        },
      });
    },
  };
}

const starter = {
  priceId: "price_starter",
  amount: 900,
  planKey: "pvnavigator_starter",
};

describe("cron checkout recovery", () => {
  it("lists only the newest complete checkout sessions", () => {
    expect(checkoutSessionListParams("cus_1")).toEqual({
      customer: "cus_1",
      status: "complete",
      limit: CHECKOUT_RECOVERY_SESSION_LIMIT,
    });
    expect(CHECKOUT_RECOVERY_SESSION_LIMIT).toBe(100);
  });

  it("does not discover a paid session beyond the newest 100 complete sessions", async () => {
    const sessions = Array.from({ length: 101 }, (_, index) => ({
      id: `cs_test_${index}`,
      payment_status: index === 100 ? "paid" : "unpaid",
      client_reference_id: A,
    }));
    let retrieved = false;
    const found = await recoverOutstandingCheckouts(
      {
        catalog: CATALOG,
        async retrieveSession() {
          retrieved = true;
          throw new Error("should not retrieve past the page");
        },
        async retrieveInvoice() {
          throw new Error("invoice");
        },
        async retrieveSubscription() {
          throw new Error("subscription");
        },
        async listSubscriptionInvoices() {
          return [];
        },
        async resolveUser() {
          return { userId: A };
        },
        async periodForInvoice() {
          return "none";
        },
        async replacesOwner() {
          return "owned";
        },
        async apply() {
          throw new Error("apply");
        },
        async finishReplacements() {
          return { ok: true, unresolved: 0, finished: 0 };
        },
        async customerIdForUser() {
          return "cus_a";
        },
        async listCheckoutSessions() {
          return sessions;
        },
      },
      { userId: A },
    );
    expect(retrieved).toBe(false);
    expect(found).toEqual({ status: "done", examined: 100, results: [] });
  });

  it("returns the oldest unscanned customers and the newest rows, then the remainder next time", () => {
    const rows = Array.from({ length: 30 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return {
        userId: `aaaaaaaa-aaaa-4aaa-8aaa-${(index + 1).toString(16).padStart(12, "0")}`,
        customerId: `cus_${index + 1}`,
        scannedAt: `2026-01-${day}T00:00:00.000Z`,
      };
    });
    const first = selectCronCustomers(rows, 25, 5);
    const chosen = new Set(first.map((row) => row.customerId));
    expect(first).toHaveLength(25);
    expect([...chosen].filter((id) => ["cus_21", "cus_22", "cus_23", "cus_24", "cus_25"].includes(id))).toEqual(
      [],
    );
    for (const row of rows) {
      if (chosen.has(row.customerId)) row.scannedAt = STAMP;
    }
    const second = new Set(selectCronCustomers(rows, 25, 5).map((row) => row.customerId));
    for (const id of ["cus_21", "cus_22", "cus_23", "cus_24", "cus_25"]) {
      expect(second.has(id)).toBe(true);
    }
  });

  it("A. does not open a second period when the webhook already granted the invoice", async () => {
    const world = billingWorld();
    world.addCustomer(A, "cus_a");
    world.addCheckout(A, "cus_a", {
      ...starter,
      sessionId: "cs_test_starter",
      invoiceId: "in_starter",
      subscriptionId: "sub_starter_new",
    });
    world.seedPeriod(A, "in_starter");

    const first = await world.sweep();
    const second = await world.sweep();
    expect(first.recovered).toBe(0);
    expect(first.alreadyGranted).toBe(1);
    expect(second.alreadyGranted).toBe(1);
    expect(world.applyCount).toBe(0);
    expect(world.periods.size).toBe(1);
    expect(world.cancels).toEqual([]);
  });

  it("B. restores a paid period when the webhook is missing and the customer does not return", async () => {
    const world = billingWorld();
    world.addCustomer(A, "cus_a");
    world.addCheckout(A, "cus_a", {
      ...starter,
      sessionId: "cs_test_starter",
      invoiceId: "in_starter",
      subscriptionId: "sub_starter_new",
    });
    world.addCheckout(B, "cus_a", {
      ...starter,
      sessionId: "cs_test_foreign",
      invoiceId: "in_foreign",
      subscriptionId: "sub_foreign",
      userId: B,
    });

    const summary = await world.sweep();
    expect(summary.recovered).toBe(1);
    expect(summary.sessions).toBe(2);
    expect(world.periods.has("in_starter")).toBe(true);
    expect(world.periods.has("in_foreign")).toBe(false);
    expect(world.applyCount).toBe(1);
    expect(world.cancels).toEqual([]);
  });

  it("C. grants ABO with 50 addresses and ends the owned STARTER subscription", async () => {
    const world = billingWorld();
    world.addCustomer(A, "cus_a");
    world.own("sub_starter");
    world.addCheckout(A, "cus_a", {
      sessionId: "cs_test_abo",
      invoiceId: "in_abo",
      subscriptionId: "sub_abo",
      priceId: "price_abo",
      amount: 2900,
      planKey: "pvnavigator_abo",
      replaces: "sub_starter",
    });

    const summary = await world.sweep();
    const command = world.commands.find((item) => item.action === "invoice_paid");
    if (!command || command.action !== "invoice_paid") throw new Error("missing grant");
    expect(summary.recovered).toBe(1);
    expect(summary.replacementsFinished).toBe(1);
    expect(commandPayload(command)).toMatchObject({
      action: "invoice_paid",
      price_id: "price_abo",
      amount_paid: 2900,
      currency: "eur",
      replaces_subscription_id: "sub_starter",
      allowed_prices: expect.arrayContaining([
        expect.objectContaining({ plan_key: "pvnavigator_abo", amount: 2900, address_limit: 50 }),
      ]),
    });
    expect(world.periods.size).toBe(1);
    expect(world.cancels).toEqual(["sub_starter"]);
    expect(world.applyCount).toBe(1);
  });

  it("D. ends STARTER on a later run when the first cancel fails", async () => {
    const world = billingWorld({ cancelFailures: 2 });
    world.addCustomer(A, "cus_a");
    world.own("sub_starter");
    world.addCheckout(A, "cus_a", {
      sessionId: "cs_test_abo",
      invoiceId: "in_abo",
      subscriptionId: "sub_abo",
      priceId: "price_abo",
      amount: 2900,
      planKey: "pvnavigator_abo",
      replaces: "sub_starter",
    });

    const first = await world.sweep();
    expect(first.recovered).toBe(1);
    expect(first.replacementsPending).toBe(1);
    expect(world.cancels).toEqual([]);
    const sameRun = await world.finish();
    expect(sameRun.ok).toBe(false);
    expect(world.cancels).toEqual([]);

    const later = await world.sweep();
    expect(later.recovered).toBe(0);
    expect(later.alreadyGranted).toBe(1);
    expect(later.replacementsFinished).toBe(1);
    expect(world.cancels).toEqual(["sub_starter"]);
    expect(world.periods.size).toBe(1);
    expect(world.applyCount).toBe(1);
  });

  it("E. does not grant an unpaid, abandoned, open, live, or foreign replacement", async () => {
    const world = billingWorld();
    world.addCustomer(A, "cus_a", "2026-01-01T00:00:00.000Z");
    world.addCustomer(B, "cus_b", "2026-01-02T00:00:00.000Z");
    world.addCustomer(C, "cus_c", "2026-01-03T00:00:00.000Z");
    world.addCheckout(A, "cus_a", {
      ...starter,
      sessionId: "cs_test_open",
      invoiceId: "in_open",
      subscriptionId: "sub_open",
      paymentStatus: "unpaid",
      sessionStatus: "open",
    });
    world.addCheckout(A, "cus_a", {
      ...starter,
      sessionId: "cs_test_expired",
      invoiceId: "in_expired",
      subscriptionId: "sub_expired",
      paymentStatus: "unpaid",
      sessionStatus: "expired",
    });
    world.addCheckout(B, "cus_b", {
      ...starter,
      sessionId: "cs_test_unpaid_invoice",
      invoiceId: "in_unpaid",
      subscriptionId: "sub_unpaid",
      invoiceStatus: "open",
    });
    world.addCheckout(C, "cus_c", {
      sessionId: "cs_test_live",
      invoiceId: "in_live",
      subscriptionId: "sub_live",
      priceId: "price_abo",
      amount: 2900,
      planKey: "pvnavigator_abo",
      livemode: true,
    });
    const foreignUser = "55555555-5555-4555-8555-555555555555";
    world.addCustomer(foreignUser, "cus_foreign", "2026-01-04T00:00:00.000Z");
    world.addCheckout(foreignUser, "cus_foreign", {
      sessionId: "cs_test_foreign_replace",
      invoiceId: "in_foreign_replace",
      subscriptionId: "sub_new_foreign",
      priceId: "price_abo",
      amount: 2900,
      planKey: "pvnavigator_abo",
      replaces: "sub_otherowner",
    });

    const summary = await world.sweep();
    expect(world.periods.size).toBe(0);
    expect(world.applyCount).toBe(0);
    expect(world.cancels).toEqual([]);
    expect(summary.recovered).toBe(0);
    expect(summary.reasons).toContain("livemode");
    expect(summary.reasons).toContain("unpaid_invoice");
    expect(summary.reasons).toContain("replaces_foreign");
  });

  it("F. keeps going when one customer hits a Stripe error", async () => {
    const world = billingWorld();
    world.addCustomer(A, "cus_a", "2026-01-01T00:00:00.000Z");
    world.addCustomer(B, "cus_b", "2026-01-02T00:00:00.000Z");
    world.addCustomer(C, "cus_c", "2026-01-03T00:00:00.000Z");
    world.listFails.add(B);
    for (const [userId, customerId, invoiceId] of [
      [A, "cus_a", "in_a"],
      [B, "cus_b", "in_b"],
      [C, "cus_c", "in_c"],
    ] as const) {
      world.addCheckout(userId, customerId, {
        ...starter,
        sessionId: `cs_test_${invoiceId}`,
        invoiceId,
        subscriptionId: `sub_${invoiceId}`,
      });
    }

    const summary = await world.sweep();
    expect(summary.recovered).toBe(2);
    expect(summary.retry).toBe(1);
    expect(summary.reasons).toEqual(["unavailable"]);
    expect(world.periods.has("in_a")).toBe(true);
    expect(world.periods.has("in_b")).toBe(false);
    expect(world.periods.has("in_c")).toBe(true);
    expect(world.scanned).toEqual([A, C]);

    const next = selectCronCustomers(world.customers, 1, 0);
    expect(next.map((row) => row.userId)).toEqual([B]);
  });

  it("isolates a thrown customer error from the rest of the batch", async () => {
    const seen: string[] = [];
    const scanned: string[] = [];
    const granted = (invoiceId: string): RecoveryResult => ({
      status: "granted",
      invoiceId,
      subscriptionId: "sub_new",
      replacementPending: false,
    });
    const summary = await sweepCronCheckouts({
      customers: [{ userId: A }, { userId: B }, { userId: C }],
      async recover(userId) {
        if (userId === B) {
          const error = new Error("customer person@example.com sk_test_secret");
          error.name = "StripeConnectionError";
          throw error;
        }
        seen.push(userId);
        return { status: "done", examined: 1, results: [granted(userId === A ? "in_a" : "in_c")] };
      },
      async markScanned(userId) {
        scanned.push(userId);
      },
    });
    expect(seen).toEqual([A, C]);
    expect(scanned).toEqual([A, C]);
    expect(summary.recovered).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.reasons).toEqual(["StripeConnectionError"]);
    expect(JSON.stringify(summary)).not.toContain("person@example.com");
    expect(JSON.stringify(summary)).not.toContain("sk_test");
  });

  it("G. repeats without a second period, invoice, or cancellation", async () => {
    const world = billingWorld();
    world.addCustomer(A, "cus_a");
    world.own("sub_starter");
    world.addCheckout(A, "cus_a", {
      sessionId: "cs_test_abo",
      invoiceId: "in_abo",
      subscriptionId: "sub_abo",
      priceId: "price_abo",
      amount: 2900,
      planKey: "pvnavigator_abo",
      replaces: "sub_starter",
    });

    await world.sweep();
    const followUp = await world.finish();
    expect(followUp).toMatchObject({ ok: true, finished: 0 });
    const again = await world.sweep();
    expect(again.recovered).toBe(0);
    expect(again.alreadyGranted).toBe(1);
    expect(world.applyCount).toBe(1);
    expect(world.commands).toHaveLength(1);
    expect(world.periods.size).toBe(1);
    expect(world.cancels).toEqual(["sub_starter"]);
  });

  it("H. leaves an interrupted batch for a later run", async () => {
    const world = billingWorld();
    world.addCustomer(A, "cus_a", "2026-01-01T00:00:00.000Z");
    world.addCustomer(B, "cus_b", "2026-01-02T00:00:00.000Z");
    world.addCustomer(C, "cus_c", "2026-01-03T00:00:00.000Z");
    for (const [userId, customerId, invoiceId] of [
      [A, "cus_a", "in_a"],
      [B, "cus_b", "in_b"],
      [C, "cus_c", "in_c"],
    ] as const) {
      world.addCheckout(userId, customerId, {
        ...starter,
        sessionId: `cs_test_${invoiceId}`,
        invoiceId,
        subscriptionId: `sub_${invoiceId}`,
      });
    }
    let ticks = 0;
    const first = await world.sweep({
      batchSize: 2,
      recentSlots: 0,
      deadlineAt: 1,
      now: () => ticks,
      beforeRecover: () => {
        ticks += 1;
      },
    });
    expect(first.customers).toBe(1);
    expect(first.deferred).toBe(1);
    expect(first.recovered).toBe(1);
    expect(world.periods.has("in_a")).toBe(true);
    expect(world.periods.has("in_b")).toBe(false);
    expect(world.scanned).toEqual([A]);

    const remaining = selectCronCustomers(world.customers, 2, 0).map((row) => row.userId);
    expect(remaining).toEqual([B, C]);
    const later = await world.sweep({ batchSize: 2, recentSlots: 0 });
    expect(later.recovered).toBe(2);
    expect(world.periods.size).toBe(3);
    expect(world.applyCount).toBe(3);
    expect(world.cancels).toEqual([]);
  });

  it("still scans the next customer when the scan stamp fails", async () => {
    const seen: string[] = [];
    const summary = await sweepCronCheckouts({
      customers: [{ userId: A }, { userId: B }],
      async recover(userId) {
        seen.push(userId);
        return { status: "done", examined: 0, results: [] };
      },
      async markScanned(userId) {
        if (userId === A) throw new Error("database");
      },
    });
    expect(seen).toEqual([A, B]);
    expect(summary.failed).toBe(1);
    expect(summary.reasons).toEqual(["scan_stamp"]);
  });
});

describe("runBillingCron", () => {
  it("runs renewal follow-up after checkout recovery and logs only safe counts", async () => {
    const logs: BillingCronLog[] = [];
    const calls: string[] = [];
    const outcome = await runBillingCron({
      async recoverCheckouts() {
        calls.push("recover");
        return { ...emptyCronSweep(), customers: 2, sessions: 3, recovered: 1, retry: 1 };
      },
      async finishReplacements() {
        calls.push("replacements");
        return { ok: true, unresolved: 0, finished: 1 };
      },
      async finishRenewals() {
        calls.push("renewals");
        return { ok: true };
      },
      log(entry) {
        logs.push(entry);
      },
    });
    expect(calls).toEqual(["recover", "replacements", "renewals"]);
    expect(outcome.status).toBe(200);
    expect(outcome.body).toMatchObject({ ok: true, unresolved: 0, replacementsFinished: 1 });
    expect(logs[0]).toMatchObject({
      event: "billing_cron_checkout_recovery",
      customers: 2,
      sessions: 3,
      recovered: 1,
      replacementsFinished: 1,
      renewalsOk: true,
    });
    const text = JSON.stringify(billingCronLog({
      recovery: logs[0] ? {
        customers: logs[0].customers,
        sessions: logs[0].sessions,
        recovered: logs[0].recovered,
        alreadyGranted: logs[0].alreadyGranted,
        replacementsFinished: 0,
        replacementsPending: logs[0].replacementsPending,
        skipped: logs[0].skipped,
        retry: logs[0].retry,
        failed: logs[0].failed,
        deferred: logs[0].deferred,
        reasons: logs[0].reasons,
        blocked: false,
      } : emptyCronSweep(),
      replacementUnresolved: 0,
      replacementsFinished: 1,
      renewalsOk: true,
    }));
    expect(text).not.toMatch(/sk_|cus_|cs_|pi_|@|Bearer/);
  });

  it("still finishes replacements and renewals when the customer list fails", async () => {
    const calls: string[] = [];
    const logs: BillingCronLog[] = [];
    const outcome = await runBillingCron({
      async recoverCheckouts() {
        calls.push("recover");
        throw Object.assign(new Error("row for person@example.com sk_test_secret"), {
          name: "PostgrestError",
        });
      },
      async finishReplacements() {
        calls.push("replacements");
        return { ok: true, unresolved: 0, finished: 0 };
      },
      async finishRenewals() {
        calls.push("renewals");
        return { ok: true };
      },
      log(entry) {
        logs.push(entry);
      },
    });
    expect(calls).toEqual(["recover", "replacements", "renewals"]);
    expect(outcome.status).toBe(500);
    expect(JSON.stringify(logs)).not.toContain("person@example.com");
    expect(JSON.stringify(logs)).not.toContain("sk_test");
    expect(logs[0]?.reasons).toEqual(["PostgrestError"]);
  });

  it("keeps the renewal follow-up behind a failed replacement and asks for a retry", async () => {
    const calls: string[] = [];
    const outcome = await runBillingCron({
      async recoverCheckouts() {
        calls.push("recover");
        return emptyCronSweep();
      },
      async finishReplacements() {
        calls.push("replacements");
        return { ok: false, unresolved: 0, finished: 0 };
      },
      async finishRenewals() {
        calls.push("renewals");
        return { ok: true };
      },
    });
    expect(calls).toEqual(["recover", "replacements"]);
    expect(outcome.status).toBe(500);
    expect(outcome.body).toBeNull();
  });

  it("asks for a retry when a failed renewal cannot be closed", async () => {
    const outcome = await runBillingCron({
      async recoverCheckouts() {
        return emptyCronSweep();
      },
      async finishReplacements() {
        return { ok: true, unresolved: 0, finished: 0 };
      },
      async finishRenewals() {
        return { ok: false };
      },
    });
    expect(outcome.status).toBe(500);
  });
});
