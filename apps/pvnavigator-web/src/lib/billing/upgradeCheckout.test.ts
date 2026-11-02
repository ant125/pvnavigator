import { describe, expect, it } from "vitest";

import { checkoutInvoiceCollection } from "./checkoutInvoice";
import {
  storedUpgradeSessionDisposition,
  upgradeCheckoutSession,
  upgradeTargetFromForm,
} from "./upgradeCheckout";

describe("upgradeTargetFromForm", () => {
  it("keeps a missing plan as PRO and rejects STARTER", () => {
    expect(upgradeTargetFromForm(null)).toBe("pro");
    expect(upgradeTargetFromForm("")).toBe("pro");
    expect(upgradeTargetFromForm("pro")).toBe("pro");
    expect(upgradeTargetFromForm("abo")).toBe("abo");
    expect(upgradeTargetFromForm("starter")).toBeNull();
    expect(upgradeTargetFromForm("pvnavigator_abo")).toBeNull();
  });
});

describe("storedUpgradeSessionDisposition", () => {
  it("does not reuse a paid session, including one for another plan", () => {
    expect(
      storedUpgradeSessionDisposition({
        paymentStatus: "paid",
        status: "complete",
        planKey: "pvnavigator_abo",
        targetPlanKey: "pvnavigator_pro",
      }),
    ).toBe("replace-settled");
    expect(
      storedUpgradeSessionDisposition({
        paymentStatus: "unpaid",
        status: "complete",
        planKey: "pvnavigator_pro",
        targetPlanKey: "pvnavigator_pro",
      }),
    ).toBe("replace-settled");
  });

  it("keeps an open unpaid session for another plan blocked", () => {
    expect(
      storedUpgradeSessionDisposition({
        paymentStatus: "unpaid",
        status: "open",
        planKey: "pvnavigator_abo",
        targetPlanKey: "pvnavigator_pro",
      }),
    ).toBe("block-open");
  });

  it("reuses an open unpaid session for the same plan", () => {
    expect(
      storedUpgradeSessionDisposition({
        paymentStatus: "unpaid",
        status: "open",
        planKey: "pvnavigator_pro",
        targetPlanKey: "pvnavigator_pro",
      }),
    ).toBe("reuse");
    expect(
      storedUpgradeSessionDisposition({
        paymentStatus: "unpaid",
        status: "open",
        planKey: null,
        targetPlanKey: "pvnavigator_pro",
      }),
    ).toBe("reuse");
  });
});

describe("upgradeCheckoutSession", () => {
  it("sells only the server PRO price and names the ABO subscription to end later", () => {
    const session = upgradeCheckoutSession({
      userId: "11111111-1111-4111-8111-111111111111",
      customerId: "cus_1",
      priceId: "price_pro_server",
      plan: "pro",
      replacesSubscriptionId: "sub_abo",
      periodId: "period-abo",
      origin: "http://localhost:3000",
      submitMessage: "59 € pro Monat ist der Endpreis.",
    });

    expect(session.mode).toBe("subscription");
    expect(session.line_items).toEqual([{ price: "price_pro_server", quantity: 1 }]);
    expect(session).not.toHaveProperty("amount");
    expect(session.metadata).toEqual({
      user_id: "11111111-1111-4111-8111-111111111111",
      plan_key: "pvnavigator_pro",
      replaces_subscription_id: "sub_abo",
    });
    expect(session.subscription_data?.metadata).toEqual(session.metadata);
    expect(session.subscription_data?.description).toBe("PVNAVIGATOR_ PRO");
    expect(session).toMatchObject(checkoutInvoiceCollection());
    expect(session.customer_update).toEqual({ name: "auto", address: "auto" });
    expect(session.success_url).toBe("http://localhost:3000/tarife/erfolg?session_id={CHECKOUT_SESSION_ID}");
    expect(session.cancel_url).toBe("http://localhost:3000/tarife/abgebrochen");
    expect(session.idempotencyKey).toBe(
      "pvn-upgrade-11111111-1111-4111-8111-111111111111-period-abo-pro",
    );
  });

  it("sells the full ABO price when STARTER moves to ABO", () => {
    const session = upgradeCheckoutSession({
      userId: "22222222-2222-4222-8222-222222222222",
      customerId: "cus_2",
      priceId: "price_abo_server",
      plan: "abo",
      replacesSubscriptionId: "sub_starter",
      periodId: "period-starter",
      origin: "http://localhost:3000",
      submitMessage: "29 € pro Monat ist der Endpreis.",
    });

    expect(session.line_items).toEqual([{ price: "price_abo_server", quantity: 1 }]);
    expect(session.metadata?.plan_key).toBe("pvnavigator_abo");
    expect(session.metadata?.replaces_subscription_id).toBe("sub_starter");
    expect(session.subscription_data?.description).toBe("PVNAVIGATOR_ ABO");
    expect(session).toMatchObject(checkoutInvoiceCollection());
    expect(session.automatic_tax).toEqual({ enabled: false });
    expect(session.idempotencyKey).toContain("-abo");
    expect(session.idempotencyKey).not.toBe(
      upgradeCheckoutSession({
        userId: "22222222-2222-4222-8222-222222222222",
        customerId: "cus_2",
        priceId: "price_pro_server",
        plan: "pro",
        replacesSubscriptionId: "sub_starter",
        periodId: "period-starter",
        origin: "http://localhost:3000",
        submitMessage: "59 € pro Monat ist der Endpreis.",
      }).idempotencyKey,
    );
  });
});
