export const RESULT_SECTION_IDS = {
  overview: "result-overview",
  storageSize: "result-storage-size",
  profiles: "result-profiles",
  balance: "result-balance",
  foundation: "result-foundation",
  sources: "result-sources",
} as const;

export const RESULT_NAV_ITEMS = [
  { id: RESULT_SECTION_IDS.overview, label: "Überblick" },
  { id: RESULT_SECTION_IDS.storageSize, label: "Speichergröße" },
  { id: RESULT_SECTION_IDS.profiles, label: "Profile" },
  { id: RESULT_SECTION_IDS.balance, label: "Bilanz" },
  { id: RESULT_SECTION_IDS.sources, label: "Quellen" },
] as const;

export type ResultNavItemId = (typeof RESULT_NAV_ITEMS)[number]["id"];

export const RESULT_NAV_ORDERED_IDS: readonly ResultNavItemId[] =
  RESULT_NAV_ITEMS.map((item) => item.id);

/**
 * Distance from the viewport top to the spy line: sticky calculate header,
 * sticky result tabs, and a small gap. Must stay in sync with the CSS
 * scroll-margin on `.sg-result-anchor`.
 */
export const RESULT_SPY_OFFSET_CSS =
  "calc(var(--spacing-sg-calculate-header) + var(--spacing-sg-result-nav) + var(--spacing-sg-result-anchor-gap))";

export function readCssLengthPx(expression: string): number {
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = expression;
  document.documentElement.appendChild(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px;
}

/**
 * Active section is the last one whose top has reached or passed the spy
 * line (just below sticky header + tabs). Huge sections still in the
 * viewport do not keep the previous tab active.
 */
export function pickActiveSectionByTops(
  sections: ReadonlyArray<{ id: string; top: number }>,
  spyLineY: number,
  previousId: string
): string {
  let active: string | null = null;
  for (const section of sections) {
    if (section.top <= spyLineY) active = section.id;
  }
  return active ?? previousId;
}

export function applyPinnedNavSpy(
  pinnedId: string | null,
  measuredId: string
): string {
  return pinnedId ?? measuredId;
}

export function scrollResultSectionIntoView(id: string): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}
