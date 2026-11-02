"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import {
  claimUpgradeSubmit,
  immediateUpgradeDialogCopy,
  subscribeUpgradeSubmit,
  upgradeSubmitLocked,
  type ImmediateUpgradeCurrent,
  type ImmediateUpgradeTarget,
} from "./upgradeDialogCopy";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60";

const ghostBtn =
  "inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#FAFBFC] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Confirmation for an immediate upgrade checkout.
 * ABO → PRO posts no plan field. STARTER posts plan=abo or plan=pro.
 * The form never sends a price or an address limit.
 */
export function ImmediateProUpgrade({
  currentPlan = "abo",
  target = "pro",
  locked = false,
}: {
  currentPlan?: ImmediateUpgradeCurrent;
  target?: ImmediateUpgradeTarget;
  /** A checkout is already pending on the server. The button does not start another one. */
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pending = useSyncExternalStore(subscribeUpgradeSubmit, upgradeSubmitLocked, () => false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const blocked = locked || pending;
  const copy = immediateUpgradeDialogCopy({ current: currentPlan, target });
  const buttonLabel = copy.title;

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (!open) {
      if (node.open) node.close();
      return;
    }
    if (!node.open) node.showModal();
    let frame = 0;
    const pinToStart = () => {
      node.querySelectorAll<HTMLElement>("[data-upgrade-scroll]").forEach((scroller) => {
        scroller.scrollTop = 0;
      });
      titleRef.current?.focus({ preventScroll: true });
    };
    pinToStart();
    frame = requestAnimationFrame(pinToStart);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function close() {
    if (upgradeSubmitLocked()) return;
    setOpen(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!claimUpgradeSubmit()) event.preventDefault();
  }

  return (
    <>
      <button type="button" className={primaryBtn} onClick={() => setOpen(true)} disabled={blocked}>
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-0 text-[#0F172A] shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] backdrop:bg-[#0F172A]/40"
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          if (upgradeSubmitLocked()) event.preventDefault();
        }}
      >
        <div className="flex max-h-[calc(100dvh-1.5rem)] min-w-0 flex-col">
          <div
            data-upgrade-scroll
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4 sm:px-5 sm:pt-5"
          >
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight text-[#0F172A] focus:outline-none"
          >
            {copy.title}
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-[#64748B]">Aktueller Tarif</dt>
              <dd className="font-semibold text-[#0F172A]">{copy.currentLine}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Neuer Tarif</dt>
              <dd className="font-semibold text-[#0F172A]">{copy.nextLine}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-semibold text-[#0F172A]">{copy.dueLine}</p>
          <div className="mt-3 space-y-2 text-sm leading-snug text-[#334155]">
            {copy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-[#E2E8F0] bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <button type="button" className={`${ghostBtn} sm:w-auto`} onClick={close} disabled={pending}>
              Abbrechen
            </button>
            <form
              data-testid={
                currentPlan === "starter" ? `immediate-starter-${target}-upgrade` : "immediate-pro-upgrade"
              }
              action="/api/billing/upgrade"
              method="post"
              className="sm:w-auto"
              onSubmit={onSubmit}
            >
              {currentPlan === "starter" ? <input type="hidden" name="plan" value={target} /> : null}
              <button type="submit" className={`${primaryBtn} sm:w-auto`} disabled={blocked}>
                {pending ? "Weiter zur Zahlung…" : copy.confirmLabel}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
