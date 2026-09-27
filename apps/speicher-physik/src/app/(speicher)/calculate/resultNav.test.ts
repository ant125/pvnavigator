import { describe, expect, it, vi } from "vitest";

import {
  RESULT_NAV_ITEMS,
  RESULT_NAV_ORDERED_IDS,
  RESULT_SECTION_IDS,
  RESULT_SPY_OFFSET_CSS,
  applyPinnedNavSpy,
  pickActiveSectionByTops,
  scrollResultSectionIntoView,
} from "./resultNav";

describe("resultNav", () => {
  it("exposes five tab targets and keeps Grundlage out of the nav", () => {
    expect(RESULT_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Überblick",
      "Speichergröße",
      "Robustheit",
      "Bilanz",
      "Quellen",
    ]);
    expect(RESULT_NAV_ORDERED_IDS).toEqual([
      RESULT_SECTION_IDS.overview,
      RESULT_SECTION_IDS.storageSize,
      RESULT_SECTION_IDS.profiles,
      RESULT_SECTION_IDS.balance,
      RESULT_SECTION_IDS.sources,
    ]);
    expect(RESULT_SECTION_IDS.sources).toBe("result-sources");
    expect(RESULT_SECTION_IDS.foundation).toBe("result-foundation");
    expect(RESULT_NAV_ORDERED_IDS).not.toContain(RESULT_SECTION_IDS.foundation);
    expect(RESULT_SPY_OFFSET_CSS).toContain("--spacing-sg-calculate-header");
    expect(RESULT_SPY_OFFSET_CSS).not.toContain("--spacing-sg-sticky");
  });

  it("activates the last section whose top has passed the spy line", () => {
    const sections = [
      { id: RESULT_SECTION_IDS.overview, top: -240 },
      { id: RESULT_SECTION_IDS.storageSize, top: 72 },
      { id: RESULT_SECTION_IDS.profiles, top: 420 },
      { id: RESULT_SECTION_IDS.balance, top: 900 },
      { id: RESULT_SECTION_IDS.sources, top: 1400 },
    ];

    expect(
      pickActiveSectionByTops(sections, 80, RESULT_SECTION_IDS.overview)
    ).toBe(RESULT_SECTION_IDS.storageSize);

    expect(
      pickActiveSectionByTops(
        sections.map((section) =>
          section.id === RESULT_SECTION_IDS.storageSize
            ? { ...section, top: 96 }
            : section
        ),
        80,
        RESULT_SECTION_IDS.overview
      )
    ).toBe(RESULT_SECTION_IDS.overview);
  });

  it("does not keep Überblick active merely because that section is still huge", () => {
    expect(
      pickActiveSectionByTops(
        [
          { id: RESULT_SECTION_IDS.overview, top: -800 },
          { id: RESULT_SECTION_IDS.storageSize, top: 64 },
          { id: RESULT_SECTION_IDS.profiles, top: 900 },
        ],
        80,
        RESULT_SECTION_IDS.overview
      )
    ).toBe(RESULT_SECTION_IDS.storageSize);
  });

  it("clicking Speichergröße immediately becomes active even if Überblick still wins the spy", () => {
    expect(
      applyPinnedNavSpy(
        RESULT_SECTION_IDS.storageSize,
        RESULT_SECTION_IDS.overview
      )
    ).toBe(RESULT_SECTION_IDS.storageSize);
  });

  it("clicking Robustheit immediately becomes active even if Überblick still wins the spy", () => {
    expect(
      applyPinnedNavSpy(
        RESULT_SECTION_IDS.profiles,
        RESULT_SECTION_IDS.overview
      )
    ).toBe(RESULT_SECTION_IDS.profiles);
  });

  it("lets the spy change the active tab after the click pin is released", () => {
    expect(
      applyPinnedNavSpy(null, RESULT_SECTION_IDS.balance)
    ).toBe(RESULT_SECTION_IDS.balance);
    expect(
      applyPinnedNavSpy(null, RESULT_SECTION_IDS.profiles)
    ).toBe(RESULT_SECTION_IDS.profiles);
  });

  it("scrolls the document section into view without pixel offsets", () => {
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn((id: string) =>
      id === RESULT_SECTION_IDS.overview
        ? ({ id, scrollIntoView } as unknown as HTMLElement)
        : null
    );
    vi.stubGlobal("document", { getElementById });

    expect(scrollResultSectionIntoView(RESULT_SECTION_IDS.overview)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(scrollResultSectionIntoView("missing")).toBe(false);

    vi.unstubAllGlobals();
  });
});
