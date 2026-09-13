"use client";

import { useEffect, useState, type ReactNode } from "react";

export function SpeicherCalculateWorkspace({
  form,
  main,
  formLocked,
  collapseFormOnMobile,
}: {
  form: ReactNode;
  main: ReactNode;
  formLocked: boolean;
  collapseFormOnMobile: boolean;
}) {
  const [mobileFormOpen, setMobileFormOpen] = useState(!collapseFormOnMobile);

  useEffect(() => {
    setMobileFormOpen(!collapseFormOnMobile);
  }, [collapseFormOnMobile]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(22rem,32%)_minmax(0,68%)] lg:items-start lg:gap-8">
      <section
        aria-label="Eingabedaten"
        className={`min-w-0 rounded-sm border border-line bg-surface ${
          formLocked ? "bg-surface-muted/60" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 lg:hidden">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-text">
            01 / Eingabedaten
          </p>
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-secondary"
            aria-expanded={mobileFormOpen}
            onClick={() => setMobileFormOpen((open) => !open)}
          >
            {mobileFormOpen ? "Einklappen" : "Anzeigen"}
          </button>
        </div>
        <div
          className={`${mobileFormOpen ? "block" : "hidden"} p-4 sm:p-5 lg:block`}
        >
          <p className="mb-4 hidden font-mono text-[11px] uppercase tracking-[0.16em] text-accent-text lg:block">
            01 / Eingabedaten
          </p>
          {form}
        </div>
      </section>

      <section aria-label="Ergebnisbereich" className="min-w-0 space-y-6">
        {main}
      </section>
    </div>
  );
}
