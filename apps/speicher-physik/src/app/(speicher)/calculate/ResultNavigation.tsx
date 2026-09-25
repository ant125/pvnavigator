"use client";

import { useEffect, useRef, useState } from "react";

import { suppressPointerFocus } from "./formStyles";
import {
  RESULT_NAV_ITEMS,
  RESULT_NAV_ORDERED_IDS,
  RESULT_SPY_OFFSET_CSS,
  applyPinnedNavSpy,
  pickActiveSectionByTops,
  readCssLengthPx,
  scrollResultSectionIntoView,
} from "./resultNav";

export function ResultNavigation() {
  const [activeId, setActiveId] = useState<string>(RESULT_NAV_ITEMS[0].id);
  const pinnedIdRef = useRef<string | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const syncFromScroll = () => {
      const spyY = readCssLengthPx(RESULT_SPY_OFFSET_CSS);
      const tops = RESULT_NAV_ORDERED_IDS.map((id) => {
        const element = document.getElementById(id);
        return {
          id,
          top: element
            ? element.getBoundingClientRect().top
            : Number.POSITIVE_INFINITY,
        };
      });
      setActiveId((previousId) =>
        applyPinnedNavSpy(
          pinnedIdRef.current,
          pickActiveSectionByTops(tops, spyY, previousId)
        )
      );
    };

    const releasePin = () => {
      pinnedIdRef.current = null;
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = null;
      }
      syncFromScroll();
    };

    window.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("resize", syncFromScroll);
    window.addEventListener("scrollend", releasePin);
    syncFromScroll();
    return () => {
      window.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
      window.removeEventListener("scrollend", releasePin);
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

  return (
    <nav aria-label="Ergebnisbereiche" className="sg-result-nav">
      <ul className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto [scrollbar-width:thin]">
        {RESULT_NAV_ITEMS.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={active ? "location" : undefined}
                className={
                  active
                    ? "inline-flex min-h-11 cursor-pointer items-center border-b-2 border-accent px-[0.6875rem] py-3 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.09em] text-ink"
                    : "inline-flex min-h-11 cursor-pointer items-center border-b-2 border-transparent px-[0.6875rem] py-3 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.09em] text-ink-muted hover:text-ink"
                }
                onMouseDown={suppressPointerFocus}
                onClick={(event) => {
                  event.preventDefault();
                  pinnedIdRef.current = item.id;
                  setActiveId(item.id);
                  if (unlockTimerRef.current !== null) {
                    window.clearTimeout(unlockTimerRef.current);
                  }
                  unlockTimerRef.current = window.setTimeout(() => {
                    pinnedIdRef.current = null;
                    unlockTimerRef.current = null;
                  }, 1000);
                  if (!scrollResultSectionIntoView(item.id)) {
                    pinnedIdRef.current = null;
                    return;
                  }
                  history.replaceState(null, "", `#${item.id}`);
                }}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
