"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  FORM_COLUMN_BAR,
  FORM_COLUMN_BAR_LABEL,
  FORM_COLUMN_BAR_TOGGLE,
} from "./formStyles";

export function SpeicherCalculateWorkspace({
  form,
  main,
  formLocked,
  collapseFormOnMobile,
  pinMain = false,
}: {
  form: ReactNode;
  main: ReactNode;
  formLocked: boolean;
  collapseFormOnMobile: boolean;
  pinMain?: boolean;
}) {
  const [mobileFormOpen, setMobileFormOpen] = useState(!collapseFormOnMobile);

  useEffect(() => {
    setMobileFormOpen(!collapseFormOnMobile);
  }, [collapseFormOnMobile]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(22rem,32%)_minmax(0,68%)] lg:items-start lg:gap-column-gap">
      <section
        aria-label="Eingabedaten"
        className="min-w-0 overflow-visible rounded-none border border-line bg-surface"
      >
        <header className={FORM_COLUMN_BAR}>
          <p className={FORM_COLUMN_BAR_LABEL}>
            <span>01</span>
            <span>Eingabedaten</span>
          </p>
          <button
            type="button"
            className={FORM_COLUMN_BAR_TOGGLE}
            aria-expanded={mobileFormOpen}
            onClick={() => setMobileFormOpen((open) => !open)}
          >
            {mobileFormOpen ? "Einklappen" : "Anzeigen"}
          </button>
        </header>
        <div
          className={`${mobileFormOpen ? "block" : "hidden"} p-panel-gap lg:block${
            formLocked ? " bg-surface-muted/60" : ""
          }`}
        >
          {form}
        </div>
      </section>

      <section
        aria-label="Ergebnisbereich"
        className={`min-w-0 space-y-3${pinMain ? " lg:self-stretch" : ""}`}
      >
        {main}
      </section>
    </div>
  );
}
