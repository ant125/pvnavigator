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
});
