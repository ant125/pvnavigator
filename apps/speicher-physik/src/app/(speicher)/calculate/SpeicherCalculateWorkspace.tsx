"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FORM_COLUMN_BAR,
  FORM_COLUMN_BAR_LABEL,
  suppressPointerFocus,
} from "./formStyles";

const DESKTOP_FORM_QUERY = "(min-width: 1024px)";

/** Visible height for the pinned input column, so its footer stays in the window. */
export function pinnedFormMaxHeightPx({
  panelTop,
  stickyTop,
  viewportHeight,
  bottomGap,
  minHeight,
}: {
  panelTop: number;
  stickyTop: number;
  viewportHeight: number;
  bottomGap: number;
  minHeight: number;
}): number {
  const anchorTop = Math.max(panelTop, stickyTop);
  return Math.max(minHeight, viewportHeight - anchorTop - bottomGap);
}

export function SpeicherCalculateWorkspace({
  form,
  main,
  pinMain = false,
  pinForm = false,
  mainColumnHeading = null,
}: {
  form: ReactNode;
  main: ReactNode;
  collapseFormOnMobile?: boolean;
  pinMain?: boolean;
  pinForm?: boolean;
  mainColumnHeading?: { number: string; label: string } | null;
}) {
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const scrollYRef = useRef(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  function openMobileForm() {
    scrollYRef.current = window.scrollY;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMobileFormOpen(true);
  }

  function closeMobileForm() {
    setMobileFormOpen(false);
  }

  useEffect(() => {
    if (!mobileFormOpen) return;

    const panel = panelRef.current;
    const closeButton = panel?.querySelector<HTMLElement>(
      "[data-close-inputs]"
    );
    closeButton?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileFormOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusables = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => element.getClientRects().length > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollYRef.current);
      previousFocusRef.current?.focus();
    };
  }, [mobileFormOpen]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_FORM_QUERY);
    const onChange = () => {
      if (media.matches) setMobileFormOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!pinForm) return;
    const panel = panelRef.current;
    if (!panel) return;
    const media = window.matchMedia(DESKTOP_FORM_QUERY);

    function fit() {
      if (!panel) return;
      if (!media.matches) {
        panel.style.removeProperty("max-height");
        return;
      }
      const rem = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize
      ) || 16;
      const headerHeight =
        document.querySelector("header")?.getBoundingClientRect().height ??
        3.75 * rem;
      const stickyTop = headerHeight + 0.75 * rem;
      const bottomGap = 1.25 * rem;
      panel.style.maxHeight = `${pinnedFormMaxHeightPx({
        panelTop: panel.getBoundingClientRect().top,
        stickyTop,
        viewportHeight: window.innerHeight,
        bottomGap,
        minHeight: 16 * rem,
      })}px`;
    }

    let frame = 0;
    function scheduleFit() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    scheduleFit();
    window.addEventListener("scroll", scheduleFit, { passive: true });
    window.addEventListener("resize", scheduleFit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleFit);
      window.removeEventListener("resize", scheduleFit);
      panel.style.removeProperty("max-height");
    };
  }, [pinForm]);

  return (
    <>
      {pinForm ? (
        <button
          type="button"
          className="sg-mobile-inputs mb-3 inline-flex border border-line bg-transparent px-3 py-1.5 text-left text-sm font-medium text-ink-secondary lg:hidden"
          aria-controls="inputs-panel"
          aria-expanded={mobileFormOpen}
          onMouseDown={suppressPointerFocus}
          onClick={openMobileForm}
        >
          Eingabedaten anzeigen
        </button>
      ) : null}
      {mobileFormOpen ? (
        <button
          type="button"
          className="sg-form-backdrop lg:hidden"
          aria-label="Eingabedaten schließen"
          onClick={closeMobileForm}
        />
      ) : null}
      <div className="sg-calculate-layout grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(22rem,32%)_minmax(0,68%)] lg:items-start lg:gap-column-gap">
        <section
          ref={panelRef}
          id="inputs-panel"
          aria-label="Eingabedaten"
          role={mobileFormOpen ? "dialog" : undefined}
          aria-modal={mobileFormOpen ? true : undefined}
          className={`sg-form-column min-w-0 rounded-none border border-line bg-surface ${
            pinForm ? "sg-form-pin overflow-hidden" : "overflow-visible"
          }${mobileFormOpen ? " sg-form-dialog-open" : ""}`}
        >
          <header className={`${FORM_COLUMN_BAR} shrink-0`}>
            <p className={FORM_COLUMN_BAR_LABEL}>
              <span>01</span>
              <span>Eingabedaten</span>
            </p>
            {pinForm ? (
              <button
                type="button"
                data-close-inputs
                className="lg:hidden -mr-1 inline-flex min-h-9 shrink-0 items-center px-2 font-mono text-base font-bold text-white"
                aria-label="Eingabedaten schließen"
                onMouseDown={suppressPointerFocus}
                onClick={closeMobileForm}
              >
                ×
              </button>
            ) : null}
          </header>
          <div
            className={`sg-form-body p-panel-gap${
              pinForm ? " sg-form-pin-body" : ""
            }`}
            tabIndex={pinForm ? undefined : 0}
          >
            {form}
          </div>
        </section>

        {mainColumnHeading ? (
          <section
            aria-label="Ergebnisbereich"
            className={`min-w-0 overflow-visible rounded-none border border-line bg-surface${pinMain ? " lg:self-stretch" : ""}`}
          >
            <header className={FORM_COLUMN_BAR}>
              <p className={FORM_COLUMN_BAR_LABEL}>
                <span>{mainColumnHeading.number}</span>
                <span>{mainColumnHeading.label}</span>
              </p>
            </header>
            <div className="min-w-0">{main}</div>
          </section>
        ) : (
          <section
            aria-label="Ergebnisbereich"
            className={`min-w-0 space-y-3${pinMain ? " lg:self-stretch" : ""}`}
          >
            {main}
          </section>
        )}
      </div>
    </>
  );
}
