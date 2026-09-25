import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("calculate page preview wiring", () => {
  it("keeps the compact sticky preview on input only", () => {
    expect(pageSource).toContain("<InputSystemPreview formData={formData} />");
    expect(pageSource).toContain('pinMain={step === "input"}');
    expect(pageSource).toContain('pinForm={step !== "input"}');
  });

  it("uses a collapsible run preview and progress on later steps", () => {
    expect(pageSource).toContain("RunSystemPreview");
    expect(pageSource).toContain("formData={runPreview ?? formData}");
    expect(pageSource).toContain("pendingScrollToRunRef.current = true");
    expect(pageSource).toContain("setRunSceneOpen(false)");
    expect(pageSource).toContain("useLayoutEffect");
    expect(pageSource).toContain("scrollPageToTop()");
    expect(pageSource).not.toContain("scrollPageToTop(pageTopRef");
    expect(pageSource).not.toContain("pageTopRef");
    expect(pageSource).not.toContain("scrollIntoView({ behavior: \"auto\", block: \"start\" })");
    expect(pageSource).toContain("sg-run-focus");
    expect(pageSource).toContain("focus({ preventScroll: true })");
    expect(pageSource).toContain("assertTopFrame");
    expect(pageSource).toContain("sg-calculate-page");
    expect(pageSource).toMatch(
      /scrollPageToTop\(\);\s*mainPaneRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*const assertTopFrame = requestAnimationFrame\(\(\) => \{[\s\S]*scrollPageToTop\(\);/
    );
    expect(pageSource).not.toContain("focusVisible");
    expect(pageSource).not.toContain("SelectedSystemSummary");
    expect(pageSource).not.toContain("getSceneHighlightTarget");
    expect(pageSource).not.toContain("min-width: 1024px");
    expect(pageSource).not.toContain("{scene}");
  });

  it("stacks result chrome as completed bar, tabs, then report", () => {
    expect(pageSource).toMatch(
      /<CompletedCalculationRow[\s\S]*\{report \? <ResultNavigation \/> : null\}[\s\S]*\{report\}/
    );
    expect(pageSource).toContain("onToggleAnlage");
    expect(pageSource).toContain("anlageScene");
    expect(pageSource).toContain("anlageOpen={runSceneOpen}");
    expect(pageSource).not.toContain("detailsExpanded");
    expect(pageSource).toContain("mainColumnHeading");
  });

  it("places the page title and live status beside each other without the overline", () => {
    expect(pageSource).toContain("Ihre Speicher-Analyse");
    expect(pageSource).toContain("Technische Analyse");
    expect(pageSource).not.toContain("SpeicherGrenze · Analyse");
    expect(pageSource).toContain("min-w-0 px-layout-gap pb-3 pt-5");
    expect(pageSource).toContain(
      "mb-title-section-gap flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5"
    );
    expect(pageSource).toContain(
      "mt-1.5 text-[1.125rem] leading-[1.45] text-ink-secondary"
    );
    expect(pageSource).not.toContain("min-w-0 p-page-inner-gap");
    expect(pageSource).not.toContain("min-w-0 px-4 py-4");
    expect(pageSource).not.toContain("py-5 sm:py-6");
    expect(pageSource).toContain(
      'text-[1.875rem] font-bold leading-none tracking-[-0.035em] text-ink sm:text-[2.375rem] lg:text-[2.875rem]'
    );
    expect(pageSource).toContain("CalculatePageStatus");
    expect(pageSource).toContain("scrollPageToTop");
    expect(pageSource).not.toContain("pageTopRef");
    expect(pageSource).not.toContain("scroll-mt-sg-sticky");
    expect(pageSource).toContain("ResultNavigation");
    expect(pageSource).toContain("sg-run-focus flex flex-col");
    expect(pageSource).toContain('showColumnHeader={step !== "results"}');
    expect(pageSource).toContain('label: "Ergebnis"');
    expect(pageSource).not.toContain("Designentwurf");
    expect(pageSource).not.toContain("useCalculateHeaderStatus");
    expect(pageSource).not.toMatch(
      /uppercase tracking-\[0\.16em\] text-accent-text[\s\S]{0,80}SpeicherGrenze/
    );
  });

  it("does not attach calculate result navigation to saved /result/[id] pages", () => {
    const resultPage = readFileSync(
      path.join(__dirname, "../result/[id]/page.tsx"),
      "utf8"
    );
    expect(resultPage).not.toContain("ResultNavigation");
    expect(resultPage).not.toContain("sg-result-nav");
    expect(resultPage).not.toContain('variant="workspace"');
  });

  it("disables scroll anchoring only on the calculate page wrapper", () => {
    const css = readFileSync(
      path.join(__dirname, "../../../app/globals.css"),
      "utf8"
    );
    expect(css).toMatch(
      /\.sg-calculate-page\s*\{\s*overflow-anchor:\s*none;/
    );
    expect(css).toContain(".sg-result-nav");
    expect(css).toContain("top: var(--spacing-sg-calculate-header)");
    expect(css).toContain("z-index: 30");
    expect(css).toContain("background-color: var(--color-surface)");
    expect(css).not.toMatch(
      /\.sg-result-nav\s*\{[^}]*top:\s*var\(--spacing-sg-sticky\)/
    );
    expect(css).toContain(".sg-result-anchor");
    expect(css).toContain("--spacing-sg-calculate-header");
    expect(css).toContain("--spacing-sg-result-anchor-gap");
    expect(css).toContain(
      "var(--spacing-sg-calculate-header) + var(--spacing-sg-result-nav)"
    );
    expect(pageSource).toContain("sg-calculate-page min-w-0 px-layout-gap pb-3 pt-5");
    expect(pageSource).toMatch(
      /useLayoutEffect\(\(\) => \{[\s\S]*pendingScrollToRunRef[\s\S]*\}, \[step\]\);/
    );
  });
});
