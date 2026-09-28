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
  it("keeps the household question as plain text without the BDEW hint", () => {
    const html = renderSection();
    const heading = html.slice(
      html.indexOf("Was ändert sich, wenn Ihr Haushalt"),
      html.indexOf("Die Hauptrechnung verwendet das BDEW-H25-Standardprofil"),
    );

    expect(heading).toContain("BDEW-Standardprofil?");
    expect(heading).not.toContain("<button");
    expect(heading).not.toContain("role=\"tooltip\"");
    expect(heading).not.toContain("title=");
    expect(heading).not.toContain("Was ist das BDEW-Standardprofil?");
    expect(html).not.toContain("standardisiertes Haushaltslastprofil");
    expect(html).toContain(
      "Die Hauptrechnung verwendet das BDEW-H25-Standardprofil",
    );
  });

  it("leads with the conclusion, then the table, then the method", () => {
    const html = renderSection(true);
    const householdConclusion = html.indexOf(
      "getesteten Haushaltsprofile zwischen 8 und 16 kWh"
    );
    const householdTable = html.indexOf("Hauptrechnung BDEW H25 im Vergleich");
    const householdMethod = html.indexOf("Was ändert sich, wenn Ihr Haushalt");
    const wwConclusion = html.indexOf(
      "getesteten Wasser/Wasser-Profile zwischen 8 und 16 kWh"
    );
    const wwTable = html.indexOf(
      "Hauptrechnung Wasser/Wasser-Referenzprofil im Vergleich"
    );
    const wwMethod = html.indexOf("Was ändert sich, wenn Ihre Wasser/Wasser");

    expect(householdConclusion).toBeGreaterThanOrEqual(0);
    expect(householdConclusion).toBeLessThan(householdTable);
    expect(householdTable).toBeLessThan(householdMethod);
    expect(wwConclusion).toBeGreaterThan(householdMethod);
    expect(wwConclusion).toBeLessThan(wwTable);
    expect(wwTable).toBeLessThan(wwMethod);
    expect(html).toContain("Haushaltsprofile");
    expect(html).toContain("Wasser/Wasser-Wärmepumpenprofile");
    expect(html).not.toContain("Verteilung der technischen Speichergrenze");
    expect(html).toContain("Details anzeigen");
  });

  it("lets comparison tables shrink and scroll locally", () => {
    const html = renderSection(true);

    expect(html).toContain("min-w-0 max-w-full overflow-x-auto");
    expect(html).toContain("min-w-[28rem]");
    expect(html).toContain("Wasser/Wasser-Referenzprofil");
  });
});
