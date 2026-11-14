"use client";

import { shouldReturnToPreviousPage } from "@/lib/infoBack";

export function InfoBackButton() {
  return (
    <a
      href="/"
      className="hub-back hub-quiet-link"
      aria-label="Zurück"
      onClick={(event) => {
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const stayInside = shouldReturnToPreviousPage({
          currentHref: window.location.href,
          referrer: document.referrer,
          historyLength: window.history.length,
          navigationEntryUrl: navigation?.name ?? null,
        });
        if (!stayInside) return;
        event.preventDefault();
        window.history.back();
      }}
    >
      ← Zurück
    </a>
  );
}
