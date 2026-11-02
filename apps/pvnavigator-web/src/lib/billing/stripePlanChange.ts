import type { AllowedPrice } from "./stripeEvents";

/**
 * Stripe subscription schedule update that keeps the current price until the
 * paid period ends, then continues on the next price.
 *
 * `proration_behavior: "none"` on the request stops a charge for restating
 * the current phase. The same value on the next phase stops a proration
 * invoice when that phase starts. The next regular renewal invoice
 * (`subscription_cycle`) is what opens the new address quota.
 *
 * https://docs.stripe.com/billing/subscriptions/subscription-schedules
 */
export function planChangeUpdate(args: {
  currentStart: number;
  currentEnd: number;
  currentPriceId: string;
  nextPriceId: string;
}): {
  end_behavior: "release";
  proration_behavior: "none";
  phases: Array<{
    items: Array<{ price: string; quantity: number }>;
    start_date: number;
    end_date?: number;
    proration_behavior: "none";
  }>;
} {
  return {
    end_behavior: "release",
    proration_behavior: "none",
    phases: [
      {
        items: [{ price: args.currentPriceId, quantity: 1 }],
        start_date: args.currentStart,
        end_date: args.currentEnd,
        proration_behavior: "none",
      },
      {
        items: [{ price: args.nextPriceId, quantity: 1 }],
        start_date: args.currentEnd,
        proration_behavior: "none",
      },
    ],
  };
}

type SchedulePhase = {
  start_date?: number;
  end_date?: number;
  items?: Array<{ price?: unknown }>;
};

export type ScheduledPlanView =
  | { kind: "clear" }
  | { kind: "scheduled"; planKey: string; effectiveAt: string }
  | { kind: "unchanged" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function priceIdOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value) && typeof value.id === "string" && value.id.trim()) return value.id.trim();
  return null;
}

function phasePrice(phase: SchedulePhase): string | null {
  const item = phase.items?.[0];
  return item ? priceIdOf(item.price) : null;
}

/**
 * Reads a future phase whose price is in the server catalog.
 * An unknown future price is left unchanged so a missing env var cannot
 * wipe a change. Released schedules clear the scheduled tariff.
 */
export function readScheduledPlan(schedule: unknown, catalog: readonly AllowedPrice[]): ScheduledPlanView {
  if (!isRecord(schedule)) return { kind: "unchanged" };
  const status = typeof schedule.status === "string" ? schedule.status : "";
  if (status === "released" || status === "canceled" || status === "completed") {
    return { kind: "clear" };
  }
  if (status !== "active" && status !== "not_started") return { kind: "unchanged" };

  const current = isRecord(schedule.current_phase) ? schedule.current_phase : null;
  const currentEnd = current && typeof current.end_date === "number" ? current.end_date : null;
  const currentStart = current && typeof current.start_date === "number" ? current.start_date : null;
  const phases = Array.isArray(schedule.phases) ? schedule.phases.filter(isRecord) : [];
  if (currentEnd === null) return { kind: "unchanged" };

  const currentPhase = phases.find((phase) => phase.start_date === currentStart) ?? null;
  const currentPrice = currentPhase ? phasePrice(currentPhase as SchedulePhase) : null;
  const future = phases
    .filter((phase) => typeof phase.start_date === "number" && phase.start_date >= currentEnd)
    .sort((a, b) => (a.start_date as number) - (b.start_date as number));
  const next = future[0] as SchedulePhase | undefined;
  if (!next || typeof next.start_date !== "number") return { kind: "clear" };

  const nextPrice = phasePrice(next);
  if (!nextPrice || nextPrice === currentPrice) return { kind: "clear" };
  const match = catalog.find((entry) => entry.priceId === nextPrice);
  if (!match) return { kind: "unchanged" };
  const effective = new Date(next.start_date * 1000);
  if (Number.isNaN(effective.getTime())) return { kind: "unchanged" };
  return { kind: "scheduled", planKey: match.planKey, effectiveAt: effective.toISOString() };
}
