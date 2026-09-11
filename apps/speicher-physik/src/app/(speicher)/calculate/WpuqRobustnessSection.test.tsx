import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";
import type { WwRobustnessPayload } from "@/lib/wpuqWwRobustnessStats";

import { WpuqRobustnessSection } from "./WpuqRobustnessSection";

const range = {
  min: 8,
  max: 16,
  median: 12,
  p25: 10,
  p75: 14,
};

const robustness: WpuqRobustnessPayload = {
  cohortSize: 2,
  householdAnnualKwh: 4500,
  bdewTechnicalSizeKwh: 12,
  sizeUnchangedCount: 2,
  sizeFrequency: [{ sizeKwh: 12, householdCount: 2 }],
  ranges: {
    eigenverbrauchKwh: range,
    eigenverbrauchsquotePct: range,
    autarkiePct: range,
    netzbezugKwh: range,
    einspeisungKwh: range,
    technicalSpeichergrenzeKwh: range,
  },
  conclusionParagraphs: [],
  houses: [
    {
      houseId: "SFH1",
      technicalSpeichergrenzeKwh: 12,
      eigenverbrauchKwh: 3000,
      eigenverbrauchsquotePct: 40,
      autarkiePct: 50,
      netzbezugKwh: 1500,
      einspeisungKwh: 2000,
    },
    {
      houseId: "SFH2",
      technicalSpeichergrenzeKwh: 12,
      eigenverbrauchKwh: 3100,
      eigenverbrauchsquotePct: 41,
      autarkiePct: 51,
      netzbezugKwh: 1400,
      einspeisungKwh: 1900,
    },
  ],
};

const ww: WwRobustnessPayload = {
  cohortSize: 2,
  heatPumpAnnualKwh: 2500,
  productionTechnicalSizeKwh: 12,
  sizeUnchangedCount: 2,
  aggregates: {
    eigenverbrauchKwh: { min: 8, max: 16, median: 12, mean: 12 },
    eigenverbrauchsquotePct: { min: 8, max: 16, median: 12, mean: 12 },
    autarkiePct: { min: 8, max: 16, median: 12, mean: 12 },
    netzbezugKwh: { min: 8, max: 16, median: 12, mean: 12 },
    einspeisungKwh: { min: 8, max: 16, median: 12, mean: 12 },
    technicalSpeichergrenzeKwh: { min: 8, max: 16, median: 12, mean: 12 },
  },
  profiles: [
    {
      profileId: "ww-1",
      houseId: "WW1",
      technicalSpeichergrenzeKwh: 12,
      eigenverbrauchKwh: 3000,
      eigenverbrauchsquotePct: 40,
      autarkiePct: 50,
      netzbezugKwh: 1500,
      einspeisungKwh: 2000,
    },
  ],
};

function renderSection(includeWw = false) {
  return renderToStaticMarkup(
    <WpuqRobustnessSection
      robustness={robustness}
      wasserWasserRobustness={includeWw ? ww : null}
      bdew={{
        technicalSpeichergrenzeKwh: 12,
        eigenverbrauchsquotePct: 40,
        autarkiePct: 50,
      }}
    />,
  );
}

describe("WpuqRobustnessSection mobile overflow containment", () => {
  it("keeps the idle BDEW tooltip out of document overflow", () => {
    const html = renderSection();
    const tooltip = html.match(/role="tooltip"[^>]*>/)?.[0];

    expect(tooltip).toBeDefined();
    expect(tooltip).toContain("hidden");
    expect(tooltip).toContain("max-w-full");
    expect(tooltip).toContain("whitespace-normal");
    expect(tooltip).toContain("left-0");
    expect(tooltip).toContain("right-0");
    expect(tooltip).not.toContain("invisible");
    expect(tooltip).not.toContain("opacity-0");
    expect(tooltip).not.toContain("100vw");
    expect(html).toContain("relative min-w-0 max-w-reading");
  });

  it("lets comparison tables shrink and scroll locally", () => {
    const html = renderSection(true);

    expect(html).toContain("min-w-0 max-w-full overflow-x-auto");
    expect(html).toContain("min-w-[28rem]");
    expect(html).toContain("Wasser/Wasser-Referenzprofil");
  });
});
