import { describe, expect, it } from "vitest";

import { planChangeUpdate, readScheduledPlan } from "./stripePlanChange";
import type { AllowedPrice } from "./stripeEvents";

const CATALOG: AllowedPrice[] = [
  { priceId: "price_abo", amount: 2900, currency: "eur", planKey: "pvnavigator_abo", addressLimit: 50 },
  { priceId: "price_pro", amount: 5900, currency: "eur", planKey: "pvnavigator_pro", addressLimit: 200 },
];

const START = 1_760_000_000;
const END = 1_762_592_000;

describe("planChangeUpdate", () => {
  it("keeps the current price until the paid period ends and does not prorate", () => {
    const update = planChangeUpdate({
      currentStart: START,
      currentEnd: END,
      currentPriceId: "price_abo",
      nextPriceId: "price_pro",
    });
    expect(update.proration_behavior).toBe("none");
    expect(update.end_behavior).toBe("release");
    expect(update.phases[0]).toMatchObject({
      start_date: START,
      end_date: END,
      proration_behavior: "none",
      items: [{ price: "price_abo", quantity: 1 }],
    });
    expect(update.phases[1]).toMatchObject({
      start_date: END,
      proration_behavior: "none",
      items: [{ price: "price_pro", quantity: 1 }],
    });
    expect(update.phases[1]).not.toHaveProperty("end_date");
    expect(JSON.stringify(update)).not.toContain("phase_start");
    expect(JSON.stringify(update)).not.toContain("create_prorations");
    expect(JSON.stringify(update)).not.toContain("always_invoice");
  });
});

describe("readScheduledPlan", () => {
  it("reads the future catalog price and its start", () => {
    expect(
      readScheduledPlan(
        {
          status: "active",
          current_phase: { start_date: START, end_date: END },
          phases: [
            { start_date: START, end_date: END, items: [{ price: "price_abo" }] },
            { start_date: END, items: [{ price: { id: "price_pro" } }] },
          ],
        },
        CATALOG,
      ),
    ).toEqual({
      kind: "scheduled",
      planKey: "pvnavigator_pro",
      effectiveAt: new Date(END * 1000).toISOString(),
    });
  });

  it("clears a schedule that was released or no longer has a future price", () => {
    expect(readScheduledPlan({ status: "released", phases: [] }, CATALOG)).toEqual({ kind: "clear" });
    expect(
      readScheduledPlan(
        {
          status: "active",
          current_phase: { start_date: START, end_date: END },
          phases: [{ start_date: START, end_date: END, items: [{ price: "price_abo" }] }],
        },
        CATALOG,
      ),
    ).toEqual({ kind: "clear" });
  });

  it("does not invent a plan for a price outside the catalog", () => {
    expect(
      readScheduledPlan(
        {
          status: "active",
          current_phase: { start_date: START, end_date: END },
          phases: [
            { start_date: START, end_date: END, items: [{ price: "price_abo" }] },
            { start_date: END, items: [{ price: "price_other" }] },
          ],
        },
        CATALOG,
      ),
    ).toEqual({ kind: "unchanged" });
  });
});
