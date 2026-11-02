"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { paymentStatusCopy, type PaymentView } from "./paymentStatusCopy";

type State = PaymentView;

const card =
  "rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] sm:p-8";

const primaryButton =
  "inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-[1.03] active:brightness-[0.98]";

const accountLink = "text-sm font-semibold text-[#b45309] hover:underline";

/**
 * Waits until the server has a paid period. This page does not grant access.
 * The tariff block uses the plan key returned by that check.
 */
export function PaymentConfirmation({
  sessionId,
  speicherUrl,
}: {
  sessionId: string;
  speicherUrl: string;
}) {
  const [state, setState] = useState<State>("pending");
  const [planKey, setPlanKey] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    let timer = 0;
    const finish = () => {
      stopped = true;
      window.clearInterval(timer);
    };
    const tick = async () => {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/billing/confirmation?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        if (stopped) return;
        if (response.status === 401 || response.status === 403) {
          setState("forbidden");
          finish();
          return;
        }
        const body = (await response.json()) as { state?: string; planKey?: unknown };
        if (body.state === "active") {
          setPlanKey(typeof body.planKey === "string" ? body.planKey : null);
          setState("active");
          finish();
          return;
        }
        if (body.state === "unpaid") {
          setState("unpaid");
          finish();
          return;
        }
        if (body.state === "unavailable") {
          setState("unavailable");
          if (attempts >= 15) finish();
          return;
        }
        if (attempts >= 15) setState("waiting");
      } catch {
        if (!stopped && attempts >= 15) setState("unavailable");
      }
    };
    void tick();
    timer = window.setInterval(() => {
      if (stopped) return;
      void tick();
    }, 2000);
    return () => {
      finish();
    };
  }, [sessionId]);

  return <PaymentConfirmationView state={state} planKey={planKey} speicherUrl={speicherUrl} />;
}

export function PaymentConfirmationView({
  state,
  planKey,
  speicherUrl,
}: {
  state: PaymentView;
  planKey: string | null;
  speicherUrl: string;
}) {
  const copy = paymentStatusCopy(state, planKey);

  return (
    <div className={card} role="status" aria-live="polite">
      <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">{copy.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#334155]">{copy.detail}</p>
      {copy.tariff ? (
        <ul className="mt-5 space-y-1.5 border-t border-[#E2E8F0] pt-5 text-sm leading-relaxed text-[#0F172A]">
          <li className="font-semibold">
            {copy.tariff.label} — {copy.tariff.priceLabel} / Monat
          </li>
          <li>{copy.tariff.addressLimit} Adressen pro Abrechnungszeitraum</li>
          <li>SPEICHERGRENZE inklusive</li>
          <li>RENDITEGUIDE nach Veröffentlichung inklusive</li>
        </ul>
      ) : null}
      {state === "active" ? (
        <div className="mt-6 flex flex-col items-start gap-4">
          <a href={speicherUrl} className={primaryButton}>
            SPEICHERGRENZE starten
          </a>
          <Link href="/konto" className={accountLink}>
            Mein Konto
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <Link href="/konto" className={accountLink}>
            Mein Konto
          </Link>
        </div>
      )}
    </div>
  );
}
