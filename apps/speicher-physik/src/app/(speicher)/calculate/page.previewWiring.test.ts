import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("calculate page preview wiring", () => {
  it("keeps the compact sticky preview on input only", () => {
    expect(pageSource).toContain("<InputSystemPreview formData={formData} />");
    expect(pageSource).toContain('pinMain={step === "input"}');
    expect(pageSource).toContain("collapseFormOnMobile={false}");
  });

  it("uses a collapsible run preview and progress on later steps", () => {
    expect(pageSource).toContain("RunSystemPreview");
    expect(pageSource).toContain("formData={runPreview ?? formData}");
    expect(pageSource).toContain("pendingScrollToRunRef.current = true");
    expect(pageSource).toContain("setRunSceneOpen(false)");
    expect(pageSource).toContain('behavior: "auto", block: "start"');
    expect(pageSource).toContain("sg-run-focus");
    expect(pageSource).toContain("focus({ preventScroll: true })");
    expect(pageSource).not.toContain("focusVisible");
    expect(pageSource).not.toContain("SelectedSystemSummary");
    expect(pageSource).not.toContain("getSceneHighlightTarget");
    expect(pageSource).not.toContain("min-width: 1024px");
    expect(pageSource).not.toContain("{scene}");
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
      "mt-1.5 text-[1.125rem] font-medium leading-snug text-ink-secondary"
    );
    expect(pageSource).not.toContain("min-w-0 p-page-inner-gap");
    expect(pageSource).not.toContain("min-w-0 px-4 py-4");
    expect(pageSource).not.toContain("py-5 sm:py-6");
    expect(pageSource).toContain(
      'text-[1.875rem] font-semibold leading-none tracking-tight text-ink sm:text-[2.375rem] lg:text-[2.875rem]'
    );
    expect(pageSource).toContain("CalculatePageStatus");
    expect(pageSource).toContain("scroll-mt-sg-sticky");
    expect(pageSource).not.toContain("Designentwurf");
    expect(pageSource).not.toContain("useCalculateHeaderStatus");
    expect(pageSource).not.toMatch(
      /uppercase tracking-\[0\.16em\] text-accent-text[\s\S]{0,80}SpeicherGrenze/
    );
  });
});
