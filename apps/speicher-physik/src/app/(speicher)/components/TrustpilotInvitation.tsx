"use client";

import { useEffect, useState } from "react";

import { recordTrustpilotClick } from "@/app/actions/trustpilot";
import { BTN_SECONDARY } from "@/app/(speicher)/calculate/formStyles";
import { TRUSTPILOT_REVIEW_URL } from "@/lib/trustpilotInvitation";

import { useTrustpilotInvitation } from "../trustpilotInvitation";

export function TrustpilotInvitation() {
  const invitation = useTrustpilotInvitation();
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!invitation.show) return;
    invitation.recordShownOnce();
  }, [invitation.show, invitation.recordShownOnce]);

  if (!invitation.show) return null;

  return (
    <section
      aria-labelledby="trustpilot-invitation-heading"
      className="sg-print-hide mt-4 border-t border-line pt-5"
    >
      <h2 id="trustpilot-invitation-heading" className="text-base font-semibold text-ink">
        Ihre Meinung ist uns wichtig!
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-secondary">
        SPEICHERGRENZE ist kostenlos. Wenn Sie Ihre Analyse angesehen haben, freuen wir uns
        über Ihre ehrliche Bewertung auf Trustpilot.
      </p>
      <a
        href={TRUSTPILOT_REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN_SECONDARY} mt-4 max-w-full`}
        onClick={() => {
          void recordTrustpilotClick().then((result) => {
            if (result === "saved") invitation.hide();
            else setSaveFailed(true);
          });
        }}
      >
        Auf Trustpilot bewerten
        <span className="sr-only"> (öffnet einen neuen Tab)</span>
      </a>
      {saveFailed ? (
        <p role="alert" className="mt-2 max-w-prose text-sm leading-relaxed text-warning">
          Der Klick konnte nicht gespeichert werden. Trustpilot wurde trotzdem geöffnet.
        </p>
      ) : null}
    </section>
  );
}
