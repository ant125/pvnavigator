import { PAID_PLANS } from "@pv-access/core";

import type { TariffViewer } from "@/lib/accessSummary";

export type ImmediateUpgradeTarget = "abo" | "pro";
export type ImmediateUpgradeCurrent = "starter" | "abo";

/**
 * A still-valid ABO period can switch to PRO immediately.
 * Active, cancel-at-period-end, and already canceled subscriptions all qualify.
 * PRO does not.
 */
export function canImmediateProUpgrade(viewer: TariffViewer): boolean {
  return viewer.kind === "current_paid" && viewer.planKey === PAID_PLANS.abo.planKey;
}

/**
 * Immediate switches that the current paid period may start.
 * STARTER may move to ABO or PRO. ABO may move to PRO.
 * A canceled subscription still qualifies while its paid period contains now.
 */
export function immediateUpgradeOffer(
  viewer: TariffViewer,
): { current: "starter" | "abo"; targets: ImmediateUpgradeTarget[] } | null {
  if (viewer.kind !== "current_paid") return null;
  if (viewer.planKey === PAID_PLANS.starter.planKey) {
    return { current: "starter", targets: ["abo", "pro"] };
  }
  if (canImmediateProUpgrade(viewer)) return { current: "abo", targets: ["pro"] };
  return null;
}

const UPGRADE_TERMS = [
  "Der neue Abrechnungszeitraum beginnt nach erfolgreicher Zahlung.",
  "Verbleibende Tage und ungenutzte Adressen Ihres bisherigen Tarifs werden nicht übertragen.",
  "Es erfolgt keine anteilige Verrechnung oder Rückerstattung.",
] as const;

export type UpgradeDialogCopy = {
  title: string;
  currentLine: string;
  nextLine: string;
  dueLine: string;
  paragraphs: readonly string[];
  confirmLabel: string;
};

function planLine(plan: (typeof PAID_PLANS)[ImmediateUpgradeCurrent | ImmediateUpgradeTarget]): string {
  return `${plan.label} — ${plan.priceLabel}/Monat, ${plan.addressLimit} Adressen`;
}

/** Compact confirmation. Prices and address limits come from the paid-plan catalog. */
export function immediateUpgradeDialogCopy(args: {
  current: ImmediateUpgradeCurrent;
  target: ImmediateUpgradeTarget;
}): UpgradeDialogCopy {
  const current = PAID_PLANS[args.current];
  const next = PAID_PLANS[args.target];
  return {
    title: `Zu ${next.label} wechseln`,
    currentLine: planLine(current),
    nextLine: planLine(next),
    dueLine: `Jetzt zu zahlen: ${next.priceLabel}`,
    paragraphs: UPGRADE_TERMS,
    confirmLabel: `Jetzt für ${next.priceLabel} zu ${next.label} wechseln`,
  };
}

/** First submit proceeds. A second submit while the first is in flight does not. */
export function claimSingleSubmit(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

const upgradeSubmit = { locked: false };
const upgradeSubmitListeners = new Set<() => void>();

/** One upgrade checkout at a time, shared by every upgrade button on the page. */
export function claimUpgradeSubmit(): boolean {
  if (upgradeSubmit.locked) return false;
  upgradeSubmit.locked = true;
  upgradeSubmitListeners.forEach((listener) => listener());
  return true;
}

export function upgradeSubmitLocked(): boolean {
  return upgradeSubmit.locked;
}

export function subscribeUpgradeSubmit(listener: () => void): () => void {
  upgradeSubmitListeners.add(listener);
  return () => upgradeSubmitListeners.delete(listener);
}

export function resetUpgradeSubmit(): void {
  upgradeSubmit.locked = false;
  upgradeSubmitListeners.forEach((listener) => listener());
}
