import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { scrollPageToTop } from "./scrollPageToTop";

const helperSource = readFileSync(
  path.join(__dirname, "scrollPageToTop.ts"),
  "utf8"
);

describe("scrollPageToTop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always zeros window and document.scrollingElement", () => {
    const scrollTo = vi.fn();
    const scrollingElement = { scrollTop: 640 };
    vi.stubGlobal("window", { scrollTo });
    vi.stubGlobal("document", { scrollingElement });

    scrollPageToTop();

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(scrollingElement.scrollTop).toBe(0);
  });

  it("still zeros window when scrollingElement is missing", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("window", { scrollTo });
    vi.stubGlobal("document", { scrollingElement: null });

    scrollPageToTop();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("does not pick an overflow-x-clip ancestor as the page scroller", () => {
    expect(helperSource).not.toContain("findVerticalScrollContainer");
    expect(helperSource).not.toContain("overflowY");
    expect(helperSource).toContain("window.scrollTo");
    expect(helperSource).toContain("document.scrollingElement");
  });
});
