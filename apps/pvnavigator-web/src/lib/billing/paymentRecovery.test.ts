import { describe, expect, it } from "vitest";

import {
  finishPendingSubscriptionReplacements,
  type PendingReplacement,
} from "./upgradeReplacement";
import {
  recoverOutstandingCheckouts,
  recoverPaidCheckout,
  recoveryEventId,
  type CheckoutRecoveryDeps,
  type RecoveryResult,
} from "./paymentRecovery";
import { normalizePaidInvoice, type AllowedPrice, type BillingCommand } from "./stripeEvents";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CATALOG: AllowedPrice[] = [
  { priceId: "price_starter", amount: 900, currency: "eur", planKey: "pvnavigator_starter", addressLimit: 10 },
  { priceId: "price_abo", amount: 2900, currency: "eur", planKey: "pvnavigator_abo", addressLimit: 50 },
  { priceId: "price_pro", amount: 5900, currency: "eur", planKey: "pvnavigator_pro", addressLimit: 200 },
];
const PERIOD = { start: 1_760_000_000, end: 1_762_592_000 };

type Spec = {
  sessionId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  priceId: string;
  amount: number;
  planKey: string;
  replaces?: string | null;
  paymentStatus?: string;
  sessionStatus?: string;
  invoiceStatus?: string;
  billingReason?: string;
  invoiceSubscriptionId?: string;
  customerId?: string;
  userId?: string;
  livemode?: boolean;
  omitInvoice?: boolean;
  amountTotal?: number | null;
  currency?: string;
  recurring?: { interval: string; interval_count: number };
};

function buildCheckout(spec: Spec) {
  const userId = spec.userId ?? USER;
  const customerId = spec.customerId ?? "cus_1";
  const subscriptionId = spec.subscriptionId ?? "sub_new";
  const invoiceId = spec.invoiceId ?? "in_new";
  const sessionId = spec.sessionId ?? "cs_test_checkout";
  const metadata: Record<string, string> = { user_id: userId, plan_key: spec.planKey };
  if (spec.replaces) metadata.replaces_subscription_id = spec.replaces;
  const price = spec.recurring ? { id: spec.priceId, recurring: spec.recurring } : spec.priceId;
  const invoice = {
    id: invoiceId,
    object: "invoice",
    amount_paid: spec.amount,
    currency: spec.currency ?? "eur",
    billing_reason: spec.billingReason ?? "subscription_create",
    customer: customerId,
    status: spec.invoiceStatus ?? "paid",
    livemode: spec.livemode ?? false,
    metadata: {},
    payment_intent: "pi_1",
    parent: {
      type: "subscription_details",
      subscription_details: {
        subscription: spec.invoiceSubscriptionId ?? subscriptionId,
        metadata,
      },
    },
    lines: {
      data: [
        {
          id: "il_1",
          period: PERIOD,
          pricing: { type: "price_details", price_details: { price, product: "prod_1" } },
          parent: {
            type: "subscription_item_details",
            subscription_item_details: { proration: false },
          },
        },
      ],
    },
  };
  const session = {
    id: sessionId,
    object: "checkout.session",
    mode: "subscription",
    payment_status: spec.paymentStatus ?? "paid",
    status: spec.sessionStatus ?? "complete",
    livemode: spec.livemode ?? false,
    customer: customerId,
    client_reference_id: userId,
    metadata,
    subscription: subscriptionId,
    invoice: spec.omitInvoice ? null : invoiceId,
    amount_total: spec.amountTotal === undefined ? spec.amount : spec.amountTotal,
    currency: spec.currency ?? "eur",
    payment_intent: "pi_1",
  };
  const subscription = {
    id: subscriptionId,
    customer: customerId,
    status: "active",
    livemode: spec.livemode ?? false,
    metadata,
    latest_invoice: "in_later_renewal",
  };
  return { session, subscription, invoice, sessionId, invoiceId, subscriptionId };
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

function memoryBilling(options?: { ignoreGrants?: boolean; cancelFailures?: number; livemode?: boolean }) {
  const periods = new Map<string, { userId: string; invoiceId: string }>();
  const events: string[] = [];
  const commands: BillingCommand[] = [];
  const pending: PendingReplacement[] = [];
  const finished = new Set<string>();
  const cancels: string[] = [];
  let applyCount = 0;
  let finishCount = 0;
  let cancelFailures = options?.cancelFailures ?? 0;

  return {
    periods,
    commands,
    events,
    cancels,
    get applyCount() {
      return applyCount;
    },
    get finishCount() {
      return finishCount;
    },
    seedPeriod(userId: string, invoiceId: string) {
      periods.set(invoiceId, { userId, invoiceId });
    },
    async periodForInvoice(invoiceId: string): Promise<"none" | "own" | "foreign"> {
      const row = periods.get(invoiceId);
      if (!row) return "none";
      return row.userId === USER ? "own" : "foreign";
    },
    async apply(args: {
      eventId: string;
      eventType: string;
      livemode: boolean;
      command: BillingCommand;
    }) {
      applyCount += 1;
      commands.push(args.command);
      if (args.livemode !== (options?.livemode ?? false) || args.command.action !== "invoice_paid") {
        if (!events.includes(args.eventId)) events.push(args.eventId);
        return { ok: true as const, outcome: "ignored" };
      }
      if (events.includes(args.eventId)) return { ok: true as const, outcome: "duplicate" };
      events.push(args.eventId);
      if (options?.ignoreGrants || !catalogAccepts(args.command)) {
        return { ok: true as const, outcome: "ignored" };
      }
      if (!periods.has(args.command.invoiceId)) {
        periods.set(args.command.invoiceId, { userId: args.command.userId, invoiceId: args.command.invoiceId });
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
      finishCount += 1;
      return finishPendingSubscriptionReplacements({
        pending: pending.filter((row) => !finished.has(row.invoiceId)),
        async load(id) {
          if (cancelFailures > 0) {
            cancelFailures -= 1;
            throw new Error("network");
          }
          return { id, status: "active", scheduleId: null, customerId: "cus_1" };
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
  };
}

function harness(
  spec: Spec,
  options?: {
    ignoreGrants?: boolean;
    cancelFailures?: number;
    listedInvoices?: Record<string, unknown>[];
    configuredLivemode?: boolean;
    resolve?: CheckoutRecoveryDeps["resolveUser"];
    replacesOwner?: CheckoutRecoveryDeps["replacesOwner"];
    retrieveSession?: CheckoutRecoveryDeps["retrieveSession"];
  },
) {
  const built = buildCheckout(spec);
  const livemode = options?.configuredLivemode ?? spec.livemode ?? false;
  const ledger = memoryBilling({ ...options, livemode });
  const retrievedInvoices: string[] = [];
  const retrievedSessions: string[] = [];
  const listed: string[] = [];
  const deps: CheckoutRecoveryDeps = {
    livemode,
    catalog: CATALOG,
    async retrieveSession(sessionId) {
      retrievedSessions.push(sessionId);
      if (options?.retrieveSession) return options.retrieveSession(sessionId);
      if (sessionId !== built.sessionId) throw new Error(`unexpected session ${sessionId}`);
      return built.session;
    },
    async retrieveInvoice(invoiceId) {
      retrievedInvoices.push(invoiceId);
      if (invoiceId !== built.invoiceId) throw new Error(`unexpected invoice ${invoiceId}`);
      return built.invoice;
    },
    async retrieveSubscription(subscriptionId) {
      if (subscriptionId !== built.subscriptionId) throw new Error(`unexpected subscription ${subscriptionId}`);
      return built.subscription;
    },
    async listSubscriptionInvoices(subscriptionId) {
      listed.push(subscriptionId);
      return options?.listedInvoices ?? [];
    },
    resolveUser:
      options?.resolve ??
      (async (customerId, candidate) => {
        if (customerId === "cus_other") return { mismatch: true as const };
        if (candidate !== USER) return { mismatch: true as const };
        return { userId: USER };
      }),
    periodForInvoice: ledger.periodForInvoice,
    replacesOwner:
      options?.replacesOwner ??
      (async (_userId, subscriptionId) => (subscriptionId === "sub_foreign" ? "foreign" : "owned")),
    apply: ledger.apply,
    finishReplacements: ledger.finishReplacements,
  };
  return {
    built,
    ledger,
    deps,
    retrievedInvoices,
    retrievedSessions,
    listed,
    recover: () => recoverPaidCheckout(deps, { userId: USER, sessionId: built.sessionId }),
  };
}

const abo: Spec = {
  sessionId: "cs_test_abo",
  invoiceId: "in_abo",
  subscriptionId: "sub_abo",
  priceId: "price_abo",
  amount: 2900,
  planKey: "pvnavigator_abo",
  replaces: "sub_starter",
};

describe("recoverPaidCheckout", () => {
  it("grants a paid STARTER to ABO checkout without a webhook", async () => {
    const { built, ledger, listed, recover } = harness(abo);
    const result = await recover();
    const normalized = normalizePaidInvoice(built.invoice, CATALOG, USER);
    if (normalized.status !== "command") throw new Error("expected command");

    expect(result).toEqual({
      status: "granted",
      invoiceId: "in_abo",
      subscriptionId: "sub_abo",
      replacementPending: false,
    });
    expect(ledger.commands[0]).toEqual(normalized.command);
    expect(normalized.command).toMatchObject({
      action: "invoice_paid",
      priceId: "price_abo",
      amountPaid: 2900,
      replacesSubscriptionId: "sub_starter",
    });
    expect(ledger.events).toEqual([recoveryEventId("in_abo")]);
    expect(ledger.periods.size).toBe(1);
    expect(ledger.cancels).toEqual(["sub_starter"]);
    expect(listed).toEqual([]);
  });

  it("grants a paid STARTER to PRO checkout", async () => {
    const { ledger, recover } = harness({
      sessionId: "cs_test_pro",
      invoiceId: "in_pro",
      subscriptionId: "sub_pro",
      priceId: "price_pro",
      amount: 5900,
      planKey: "pvnavigator_pro",
      replaces: "sub_starter",
    });
    const result = await recover();
    expect(result).toMatchObject({ status: "granted", invoiceId: "in_pro", subscriptionId: "sub_pro" });
    expect(ledger.commands[0]).toMatchObject({
      priceId: "price_pro",
      amountPaid: 5900,
      replacesSubscriptionId: "sub_starter",
    });
    expect(ledger.cancels).toEqual(["sub_starter"]);
    expect(ledger.periods.size).toBe(1);
  });

  it("grants a normal STARTER purchase and cancels no subscription", async () => {
    const { ledger, recover } = harness({
      sessionId: "cs_test_starter",
      invoiceId: "in_starter",
      subscriptionId: "sub_starter_new",
      priceId: "price_starter",
      amount: 900,
      planKey: "pvnavigator_starter",
    });
    const result = await recover();
    expect(result).toMatchObject({
      status: "granted",
      invoiceId: "in_starter",
      replacementPending: false,
    });
    expect(ledger.commands[0]).toMatchObject({
      priceId: "price_starter",
      amountPaid: 900,
      replacesSubscriptionId: null,
    });
    expect(ledger.cancels).toEqual([]);
    expect(ledger.finishCount).toBe(1);
    expect(ledger.periods.size).toBe(1);
  });

  it("keeps one period when the webhook and recovery apply the same invoice", async () => {
    const first = harness(abo);
    const normalized = normalizePaidInvoice(first.built.invoice, CATALOG, USER);
    if (normalized.status !== "command") throw new Error("expected command");
    await first.ledger.apply({
      eventId: "evt_paid",
      eventType: "invoice.paid",
      livemode: false,
      command: normalized.command,
    });
    const afterWebhook = await first.recover();
    expect(afterWebhook.status).toBe("already_granted");
    expect(first.ledger.periods.size).toBe(1);
    expect(first.ledger.applyCount).toBe(1);

    const second = harness(abo);
    const granted = await second.recover();
    expect(granted.status).toBe("granted");
    const command = second.ledger.commands[0];
    if (!command) throw new Error("expected command");
    await second.ledger.apply({
      eventId: "evt_paid",
      eventType: "invoice.paid",
      livemode: false,
      command,
    });
    expect(second.ledger.periods.size).toBe(1);
    expect(second.ledger.events).toEqual([recoveryEventId("in_abo"), "evt_paid"]);

    const race = memoryBilling();
    await Promise.all([
      race.apply({ eventId: recoveryEventId("in_abo"), eventType: "invoice.paid", livemode: false, command }),
      race.apply({ eventId: "evt_paid", eventType: "invoice.paid", livemode: false, command }),
    ]);
    expect(race.periods.size).toBe(1);
    expect(race.events).toEqual([recoveryEventId("in_abo"), "evt_paid"]);
  });

  it("does not open a second period when recovery runs again", async () => {
    const { ledger, recover } = harness(abo);
    const first = await recover();
    const second = await recover();
    expect(first.status).toBe("granted");
    expect(second.status).toBe("already_granted");
    expect(ledger.applyCount).toBe(1);
    expect(ledger.finishCount).toBe(2);
    expect(ledger.periods.size).toBe(1);
    expect(ledger.cancels).toEqual(["sub_starter"]);
  });

  it("does not grant an aborted or unpaid session", async () => {
    const expired = harness({
      ...abo,
      paymentStatus: "unpaid",
      sessionStatus: "expired",
    });
    expect(await expired.recover()).toEqual({ status: "unpaid" });
    expect(expired.ledger.applyCount).toBe(0);
    expect(expired.ledger.finishCount).toBe(0);
    expect(expired.ledger.cancels).toEqual([]);

    const openInvoice = harness({ ...abo, invoiceStatus: "open" });
    expect(await openInvoice.recover()).toEqual({ status: "refused", reason: "unpaid_invoice" });
    expect(openInvoice.ledger.applyCount).toBe(0);
    expect(openInvoice.ledger.cancels).toEqual([]);
  });

  it("refuses a foreign customer or a foreign subscription", async () => {
    const customer = harness({ ...abo, customerId: "cus_other" });
    expect(await customer.recover()).toEqual({ status: "refused", reason: "customer_mismatch" });
    expect(customer.ledger.applyCount).toBe(0);
    expect(customer.ledger.cancels).toEqual([]);

    const subscription = harness({ ...abo, invoiceSubscriptionId: "sub_other" });
    expect(await subscription.recover()).toEqual({ status: "refused", reason: "invoice_subscription" });
    expect(subscription.ledger.applyCount).toBe(0);
    expect(subscription.ledger.cancels).toEqual([]);

    const replaces = harness({ ...abo, replaces: "sub_foreign" });
    expect(await replaces.recover()).toEqual({ status: "refused", reason: "replaces_foreign" });
    expect(replaces.ledger.applyCount).toBe(0);
    expect(replaces.ledger.cancels).toEqual([]);

    const foreignPeriod = harness(abo);
    foreignPeriod.ledger.seedPeriod(OTHER, "in_abo");
    expect(await foreignPeriod.recover()).toEqual({ status: "refused", reason: "foreign_period" });
    expect(foreignPeriod.ledger.applyCount).toBe(0);
    expect(foreignPeriod.ledger.finishCount).toBe(0);
  });

  it("does not grant an unknown price or a wrong amount", async () => {
    const unknown = harness({ ...abo, priceId: "price_unknown" });
    expect(await unknown.recover()).toEqual({ status: "refused", reason: "not_granted" });
    expect(unknown.ledger.applyCount).toBe(1);
    expect(unknown.ledger.commands[0]).toMatchObject({ priceId: "price_unknown", amountPaid: 2900 });
    expect(unknown.ledger.periods.size).toBe(0);
    expect(unknown.ledger.cancels).toEqual([]);

    const amount = harness({ ...abo, amount: 100 });
    expect(await amount.recover()).toEqual({ status: "refused", reason: "not_granted" });
    expect(amount.ledger.commands[0]).toMatchObject({ priceId: "price_abo", amountPaid: 100 });
    expect(amount.ledger.periods.size).toBe(0);
    expect(amount.ledger.cancels).toEqual([]);

    const swapped = harness({ ...abo, amount: 900, amountTotal: 2900 });
    expect(await swapped.recover()).toEqual({ status: "refused", reason: "amount_mismatch" });
    expect(swapped.ledger.applyCount).toBe(0);

    const yearly = harness({
      ...abo,
      recurring: { interval: "year", interval_count: 1 },
    });
    expect(await yearly.recover()).toEqual({ status: "refused", reason: "billing_interval" });
    expect(yearly.ledger.applyCount).toBe(0);
    expect(yearly.ledger.cancels).toEqual([]);
  });

  it("does not cancel when the database rejects the upgrade", async () => {
    const { ledger, recover } = harness(abo, { ignoreGrants: true });
    expect(await recover()).toEqual({ status: "refused", reason: "not_granted" });
    expect(await recover()).toEqual({ status: "refused", reason: "already_recorded" });
    expect(ledger.periods.size).toBe(0);
    expect(ledger.cancels).toEqual([]);
    expect(ledger.finishCount).toBe(0);
  });

  it("retries a failed replacement cancel without a second period or a second charge", async () => {
    const { ledger, recover } = harness(abo, { cancelFailures: 1 });
    const first = await recover();
    const second = await recover();
    expect(first).toMatchObject({ status: "granted", replacementPending: true });
    expect(second).toMatchObject({ status: "already_granted", replacementPending: false });
    expect(ledger.applyCount).toBe(1);
    expect(ledger.periods.size).toBe(1);
    expect(ledger.cancels).toEqual(["sub_starter"]);
  });

  it("uses the checkout invoice and not a later subscription invoice", async () => {
    const renewal = buildCheckout({
      ...abo,
      invoiceId: "in_later_renewal",
      billingReason: "subscription_cycle",
      amount: 2900,
    });
    const direct = harness(abo);
    expect((await direct.recover()).status).toBe("granted");
    expect(direct.retrievedInvoices).toEqual(["in_abo"]);
    expect(direct.listed).toEqual([]);

    const missing = harness(
      { ...abo, omitInvoice: true },
      { listedInvoices: [renewal.invoice, direct.built.invoice] },
    );
    const result = await missing.recover();
    expect(result).toMatchObject({ status: "granted", invoiceId: "in_abo" });
    expect(missing.retrievedInvoices).toEqual(["in_abo"]);
    expect(missing.listed).toEqual(["sub_abo"]);

    const onlyLater = harness({ ...abo, omitInvoice: true }, { listedInvoices: [renewal.invoice] });
    expect(await onlyLater.recover()).toEqual({ status: "retry", reason: "invoice_not_ready" });
    expect(onlyLater.retrievedInvoices).toEqual([]);
    expect(onlyLater.ledger.applyCount).toBe(0);

    const ambiguous = harness(
      { ...abo, omitInvoice: true },
      { listedInvoices: [direct.built.invoice, { ...direct.built.invoice, id: "in_other_create" }] },
    );
    expect(await ambiguous.recover()).toEqual({ status: "refused", reason: "invoice_ambiguous" });
    expect(ambiguous.ledger.applyCount).toBe(0);
  });

  it("retries when Stripe or the database is unavailable", async () => {
    const stripeDown = harness(abo, {
      retrieveSession: async () => {
        throw new Error("StripeConnectionError");
      },
    });
    expect(await stripeDown.recover()).toEqual({ status: "retry", reason: "unavailable" });
    expect(stripeDown.ledger.applyCount).toBe(0);
    expect(stripeDown.ledger.finishCount).toBe(0);

    const databaseDown = harness(abo);
    databaseDown.deps.apply = async () => ({ ok: false });
    expect(await databaseDown.recover()).toEqual({ status: "retry", reason: "database" });
    expect(databaseDown.ledger.finishCount).toBe(0);
    expect(databaseDown.ledger.periods.size).toBe(0);
  });

  it("refuses a session from the other Stripe mode", async () => {
    const sandbox = harness({ ...abo, livemode: true }, { configuredLivemode: false });
    expect(await sandbox.recover()).toEqual({ status: "refused", reason: "livemode" });
    expect(sandbox.ledger.applyCount).toBe(0);
    expect(sandbox.ledger.cancels).toEqual([]);

    const live = harness(
      { ...abo, livemode: false, sessionId: "cs_test_on_live", invoiceId: "in_test_on_live" },
      { configuredLivemode: true },
    );
    expect(await live.recover()).toEqual({ status: "refused", reason: "livemode" });
    expect(live.ledger.applyCount).toBe(0);
  });

  it("grants a live checkout when the server is in live mode", async () => {
    const { ledger, recover } = harness(
      {
        ...abo,
        livemode: true,
        sessionId: "cs_live_abo",
        invoiceId: "in_live_abo",
        subscriptionId: "sub_live_abo",
      },
      { configuredLivemode: true },
    );
    const result = await recover();
    expect(result).toMatchObject({ status: "granted", invoiceId: "in_live_abo" });
    expect(ledger.periods.size).toBe(1);
    const again = await recover();
    expect(again).toMatchObject({ status: "already_granted", invoiceId: "in_live_abo" });
    expect(ledger.periods.size).toBe(1);
  });
});

describe("recoverOutstandingCheckouts", () => {
  it("recovers a paid session that is no longer the stored claim", async () => {
    const claimSessionId = "cs_test_newer";
    const paid = buildCheckout(abo);
    const newer = buildCheckout({
      ...abo,
      sessionId: claimSessionId,
      invoiceId: "in_newer",
      subscriptionId: "sub_newer",
      paymentStatus: "unpaid",
      sessionStatus: "open",
    });
    const foreign = buildCheckout({
      ...abo,
      sessionId: "cs_test_foreign",
      userId: OTHER,
      customerId: "cus_other",
    });
    const ledger = memoryBilling();
    const retrievedSessions: string[] = [];
    let listedCustomers: string[] = [];
    const deps = {
      livemode: false,
      catalog: CATALOG,
      async retrieveSession(sessionId: string) {
        retrievedSessions.push(sessionId);
        if (sessionId !== paid.sessionId) throw new Error(`unexpected session ${sessionId}`);
        return paid.session;
      },
      async retrieveInvoice(invoiceId: string) {
        if (invoiceId !== paid.invoiceId) throw new Error(`unexpected invoice ${invoiceId}`);
        return paid.invoice;
      },
      async retrieveSubscription(subscriptionId: string) {
        if (subscriptionId !== paid.subscriptionId) throw new Error(`unexpected subscription ${subscriptionId}`);
        return paid.subscription;
      },
      async listSubscriptionInvoices() {
        return [];
      },
      async resolveUser(customerId: string | null, candidate: string | null) {
        if (customerId !== "cus_1" || candidate !== USER) return { mismatch: true as const };
        return { userId: USER };
      },
      periodForInvoice: ledger.periodForInvoice,
      async replacesOwner() {
        return "owned" as const;
      },
      apply: ledger.apply,
      finishReplacements: ledger.finishReplacements,
      async customerIdForUser() {
        return "cus_1";
      },
      async listCheckoutSessions(customerId: string) {
        listedCustomers = [customerId];
        return [newer.session, foreign.session, paid.session];
      },
    };

    const found = await recoverOutstandingCheckouts(deps, { userId: USER });
    expect(claimSessionId).not.toBe(paid.sessionId);
    expect(listedCustomers).toEqual(["cus_1"]);
    expect(retrievedSessions).toEqual([paid.sessionId]);
    expect(found).toEqual({
      status: "done",
      examined: 3,
      results: [
        {
          status: "granted",
          invoiceId: "in_abo",
          subscriptionId: "sub_abo",
          replacementPending: false,
        },
      ],
    });
    expect(ledger.periods.size).toBe(1);
    expect(ledger.cancels).toEqual(["sub_starter"]);

    const again = await recoverOutstandingCheckouts(deps, { userId: USER });
    expect(again.status).toBe("done");
    if (again.status !== "done") throw new Error("expected done");
    expect(again.results.map((result: RecoveryResult) => result.status)).toEqual(["already_granted"]);
    expect(ledger.periods.size).toBe(1);
    expect(ledger.applyCount).toBe(1);
  });

  it("skips the customer search when no Stripe customer is linked", async () => {
    const paid = buildCheckout({
      sessionId: "cs_test_starter",
      invoiceId: "in_starter",
      subscriptionId: "sub_starter_new",
      priceId: "price_starter",
      amount: 900,
      planKey: "pvnavigator_starter",
    });
    const ledger = memoryBilling();
    let listed = false;
    const deps = {
      livemode: false,
      catalog: CATALOG,
      async retrieveSession() {
        return paid.session;
      },
      async retrieveInvoice() {
        return paid.invoice;
      },
      async retrieveSubscription() {
        return paid.subscription;
      },
      async listSubscriptionInvoices() {
        return [];
      },
      async resolveUser() {
        return { userId: USER };
      },
      periodForInvoice: ledger.periodForInvoice,
      async replacesOwner() {
        return "owned" as const;
      },
      apply: ledger.apply,
      finishReplacements: ledger.finishReplacements,
      async customerIdForUser() {
        return null;
      },
      async listCheckoutSessions() {
        listed = true;
        return [];
      },
    };
    expect(await recoverOutstandingCheckouts(deps, { userId: USER })).toEqual({
      status: "skipped",
      reason: "no_customer",
    });
    expect(listed).toBe(false);
    const direct = await recoverPaidCheckout(deps, { userId: USER, sessionId: paid.sessionId });
    expect(direct).toMatchObject({ status: "granted", invoiceId: "in_starter" });
    expect(ledger.cancels).toEqual([]);
  });
});
