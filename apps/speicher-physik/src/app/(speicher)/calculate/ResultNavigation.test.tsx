import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ResultNavigation } from "./ResultNavigation";
import { RESULT_NAV_ITEMS, RESULT_SECTION_IDS } from "./resultNav";

describe("ResultNavigation", () => {
  it("renders five in-page anchors with a single current item", () => {
    const html = renderToStaticMarkup(<ResultNavigation />);

    expect(html).toContain('aria-label="Ergebnisbereiche"');
    expect(html).toContain("sg-result-nav");
    expect(html).toContain("text-[11px]");
    expect(html).toContain("font-bold");
    expect(html).toContain("tracking-[0.09em]");
    expect(html).toContain("min-h-11");
    expect(html).toContain("cursor-pointer");
    for (const item of RESULT_NAV_ITEMS) {
      expect(html).toContain(`href="#${item.id}"`);
      expect(html).toContain(item.label);
    }
    expect(html).toContain(`href="#${RESULT_SECTION_IDS.sources}"`);
    expect(html).toContain("Quellen");
    expect(html.match(/aria-current="location"/g)?.length).toBe(1);
    expect(html).toMatch(
      /href="#result-overview"[^>]*aria-current="location"/
    );
    expect(html).not.toMatch(
      /href="#result-storage-size"[^>]*aria-current="location"/
    );
    expect(html).not.toContain('role="tabpanel"');
    expect(html).not.toContain("hidden");
    expect(html).not.toContain(RESULT_SECTION_IDS.foundation);
    expect(html).not.toContain("bg-accent px-");
  });
});
