import { BillingPostButton } from "@/components/tariffs/BillingPostButton";
import { ImmediateProUpgrade } from "@/components/tariffs/ImmediateProUpgrade";
import { immediateUpgradeOffer } from "@/components/tariffs/upgradeDialogCopy";
import {
  accessCardCopy,
  billingPortalButtonLabel,
  blocksAnotherSubscription,
  canOpenBillingPortal,
  tariffViewer,
  type AccessSummary,
} from "@/lib/accessSummary";

const card =
  "rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]";

const badgeBase =
  "inline-flex w-fit rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1";

const primaryLink =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03]";

/**
 * Compact "Zugang" card: current tariff, quota, paid-period end, renewal or
 * cancellation. Portal and upgrade actions follow the shared billing rules.
 */
export function AccessCard({ summary }: { summary: AccessSummary }) {
  const copy = accessCardCopy(summary);
  const badgeTone =
    summary.kind === "subscription" && summary.billingStatus !== "past_due" && summary.billingStatus !== "unpaid"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-100/90"
      : "bg-slate-50 text-slate-600 ring-slate-200/90";
  const upgrade = immediateUpgradeOffer(tariffViewer(true, summary));
  const showPortal = canOpenBillingPortal(summary);
  const showTariffs = summary.kind === "free" && !blocksAnotherSubscription(summary);

  return (
    <div className={`px-5 py-4 sm:px-6 ${card}`} data-access-kind={summary.kind}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[0.95rem] font-semibold text-[#0F172A]">{copy.title}</p>
        <span className={`${badgeBase} ${badgeTone}`}>{copy.badge}</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-[#0F172A]">
        {copy.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {copy.note ? (
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#64748B]">{copy.note}</p>
      ) : null}
      {upgrade || showPortal || showTariffs ? (
        <div className="mt-4 flex w-full max-w-[22.5rem] flex-col gap-2">
          {upgrade && summary.kind === "subscription" ? (
            upgrade.current === "starter" ? (
              <>
                <ImmediateProUpgrade currentPlan="starter" target="abo" />
                <ImmediateProUpgrade currentPlan="starter" target="pro" />
              </>
            ) : (
              <ImmediateProUpgrade />
            )
          ) : null}
          {showPortal ? (
            <BillingPostButton
              action="/api/billing/portal"
              label={billingPortalButtonLabel(summary.kind === "subscription", summary.billingStatus)}
              pendingLabel="Wird geöffnet…"
              tone="ghost"
            />
          ) : null}
          {showTariffs ? (
            <a href="/tarife" className={primaryLink}>
              Tarife ansehen
            </a>
          ) : null}
        </div>
      ) : null}
      {summary.kind === "subscription" ? (
        <p className="mt-3">
          <a
            href="/tarife"
            className="text-sm font-medium text-[#475569] underline decoration-[#CBD5E1] underline-offset-2 transition hover:text-[#0F172A]"
          >
            Alle Tarife ansehen
          </a>
        </p>
      ) : null}
    </div>
  );
}
