"use client";

import { useEffect, useRef, useState } from "react";

import { recordTrustpilotClick, recordTrustpilotShown } from "@/app/actions/trustpilot";
import { TRUSTPILOT_REVIEW_URL } from "@/lib/trustpilotInvitation";

type Props = {
  show: boolean;
  recordShown: boolean;
};

export function TrustpilotInvitation({ show, recordShown }: Props) {
  const [visible, setVisible] = useState(show);
  const [saveFailed, setSaveFailed] = useState(false);
  const shownRequested = useRef(false);

  useEffect(() => {
    if (!show) setVisible(false);
  }, [show]);

  useEffect(() => {
    if (!visible || !recordShown || shownRequested.current) return;
    shownRequested.current = true;
    void recordTrustpilotShown();
  }, [visible, recordShown]);

  if (!visible) return null;

  return (
    <section aria-labelledby="trustpilot-invitation-heading" className="hub-trustpilot">
      <h2 id="trustpilot-invitation-heading">Ihre Meinung ist uns wichtig!</h2>
      <p>
        Hat Ihnen SPEICHERGRENZE bei Ihrer Planung geholfen? Wir freuen uns über Ihre
        ehrliche Bewertung auf Trustpilot.
      </p>
      <a
        href={TRUSTPILOT_REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hub-secondary"
        onClick={() => {
          void recordTrustpilotClick().then((result) => {
            if (result === "saved") setVisible(false);
            else setSaveFailed(true);
          });
        }}
      >
        Auf Trustpilot bewerten
        <span className="hub-sr"> (öffnet einen neuen Tab)</span>
      </a>
      {saveFailed ? (
        <p role="alert">Der Klick konnte nicht gespeichert werden. Trustpilot wurde trotzdem geöffnet.</p>
      ) : null}
    </section>
  );
}
