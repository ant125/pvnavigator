import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/SpeicherChart", () => ({
  default: () => <div>speicher-chart</div>,
}));

import { SpeicherReportView } from "./SpeicherReportView";
import { RESULT_SECTION_IDS } from "../calculate/resultNav";
import type { SpeicherGrenzPayload } from "@/lib/calculateSpeicherResult";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";

const range = {
  min: 5,
  max: 7,
  median: 6,
  p25: 5,
  p75: 6,
};

const speicherGrenz: SpeicherGrenzPayload = {
  batterySizes: [5, 6, 7],
  average: { 5: 2100, 6: 2200, 7: 2280 },
  averageBatteryChargedKwh: { 5: 400, 6: 450, 7: 500 },
  averageBatteryDischargedKwh: { 5: 380, 6: 430, 7: 480 },
  averageDirectPvToHouseholdKwh: { 5: 1700, 6: 1700, 7: 1700 },
  averageDirectPvToAuxiliaryKwh: { 5: 0, 6: 0, 7: 0 },
  averageBatteryToHouseholdKwh: { 5: 380, 6: 430, 7: 480 },
  averageBatteryToAuxiliaryKwh: { 5: 0, 6: 0, 7: 0 },
  averageGridToHouseholdKwh: { 5: 1900, 6: 1850, 7: 1800 },
  averageGridToAuxiliaryKwh: { 5: 0, 6: 0, 7: 0 },
  averageGridExportKwh: { 5: 7400, 6: 7300, 7: 7200 },
  averageAuxiliaryConsumptionKwh: { 5: 0, 6: 0, 7: 0 },
  averageChargeLossKwh: { 5: 20, 6: 20, 7: 20 },
  averageDischargeLossKwh: { 5: 20, 6: 20, 7: 20 },
  averageChargeLossPvToBatteryKwh: { 5: 10, 6: 10, 7: 10 },
  averageChargeLossChemicalKwh: { 5: 10, 6: 10, 7: 10 },
  averageDischargeLossChemicalKwh: { 5: 10, 6: 10, 7: 10 },
  averageDischargeLossBatteryToAcKwh: { 5: 10, 6: 10, 7: 10 },
  averageSocStartKwh: { 5: 0, 6: 0, 7: 0 },
  averageSocEndKwh: { 5: 0, 6: 0, 7: 0 },
  averageSocEndPct: { 5: 0, 6: 0, 7: 0 },
  averageEnergyBalanceErrorKwh: { 5: 0, 6: 0, 7: 0 },
  averageSelfDischargeLossKwh: { 5: 0, 6: 0, 7: 0 },
  averageSelfConsumptionWithoutStorageKwh: 1800,
  averagePvYieldKwhAnnual: 9500,
  averageLoadKwhAnnual: 4000,
  batteryModelVersion: "1.1.0",
};

const robustness: WpuqRobustnessPayload = {
  cohortSize: 2,
  householdAnnualKwh: 4000,
  bdewTechnicalSizeKwh: 6,
  sizeUnchangedCount: 1,
  sizeFrequency: [{ sizeKwh: 6, householdCount: 2 }],
  ranges: {
    eigenverbrauchKwh: range,
    eigenverbrauchsquotePct: range,
    autarkiePct: range,
    netzbezugKwh: range,
    einspeisungKwh: range,
    technicalSpeichergrenzeKwh: range,
  },
  conclusionParagraphs: ["Die empfohlene Größe bleibt robust."],
  houses: [
    {
      houseId: "h1",
      technicalSpeichergrenzeKwh: 6,
      eigenverbrauchKwh: 2200,
      eigenverbrauchsquotePct: 23,
      autarkiePct: 55,
      netzbezugKwh: 1800,
      einspeisungKwh: 7300,
    },
  ],
};

const sharedProps = {
  verifiedResult: {
    energy: {
      year: {
        selfConsumptionWithoutStorage: 1800,
        pvYieldKwhAnnual: 9500,
      },
    },
    batteryModelVersion: "1.1.0",
  },
  speicherGrenz,
  robustness,
  wasserWasserRobustness: null,
  ev: null,
  heatPumpCitation: null,
  displayAddress: "Musterstraße 1, 80331 München",
  surfaces: [{ systemSizeKwP: 10, tiltDeg: 35, azimuthDeg: 180 }],
  input: {
    annualConsumptionKwh: 4000,
    heatPumpEnabled: false,
    heatPumpConsumptionKwh: undefined,
    backupReserveKwh: 0,
  },
  totalKwPConfigured: 10,
};

function indexOf(html: string, snippet: string): number {
  const index = html.indexOf(snippet);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe("SpeicherReportView workspace layout", () => {
  it("uses semantic chapters, anchors, and reordered overview without tab panels", () => {
    const html = renderToStaticMarkup(
      <SpeicherReportView
        mode="live"
        variant="workspace"
        anlageOpen={false}
        anlageScene={<div>original-system-scene</div>}
        {...sharedProps}
      />
    );

    expect(html).not.toContain("Analyse abgeschlossen");
    expect(html).not.toContain("02 / Ergebnis");
    expect(html).not.toContain("03 / Ihre Eingabedaten");
    expect(html).not.toContain("04 / Technische Kennzahlen");
    expect(html).not.toContain("05 / Eigenverbrauch vs Speichergröße");
    expect(html).not.toContain("06 / Unsere Einschätzung");
    expect(html).not.toContain('role="tabpanel"');
    expect(html).not.toContain('hidden=""');

    expect(html).toContain("Überblick");
    expect(html).not.toContain("Berechnung nach BDEW H25");
    expect(html).toContain("Berechnungsgrundlage: BDEW H25");
    expect(html).not.toContain("Unsere Einschätzung");
    expect(html).toContain("Speichergröße");
    expect(html).toContain("Robustheit");
    expect(html).toContain("Bilanz");
    expect(html).toContain("Grundlage der Berechnung");
    expect(html).toContain("original-system-scene");
    expect(html).toContain("sg-anlage-collapsed");
    expect(html.match(/Grundlage der Berechnung/g)).toHaveLength(1);
    expect(html).toContain("speicher-chart");
    expect(html).not.toContain(`id="${RESULT_SECTION_IDS.foundation}"`);

    const anlage = indexOf(html, "Grundlage der Berechnung");
    const overview = indexOf(html, `id="${RESULT_SECTION_IDS.overview}"`);
    const storage = indexOf(html, `id="${RESULT_SECTION_IDS.storageSize}"`);
    const profiles = indexOf(html, `id="${RESULT_SECTION_IDS.profiles}"`);
    const balance = indexOf(html, `id="${RESULT_SECTION_IDS.balance}"`);
    const sources = indexOf(html, `id="${RESULT_SECTION_IDS.sources}"`);

    expect(anlage).toBeLessThan(overview);
    expect(overview).toBeLessThan(storage);
    expect(storage).toBeLessThan(profiles);
    expect(profiles).toBeLessThan(balance);
    expect(balance).toBeLessThan(sources);

    expect(html).toContain("Quellen &amp; wissenschaftliche Grundlagen");

    const overviewHtml = html.slice(overview, storage);
    const storageHtml = html.slice(storage, profiles);
    expect(overviewHtml).toContain("Technische Speichergrenze");
    expect(overviewHtml).toContain("Planerische Anfangskapazität");
    expect(overviewHtml).toContain(
      "Für die Kaufplanung bei angenommenen 75"
    );
    expect(overviewHtml).toContain("Restkapazität");
    expect(overviewHtml).not.toContain("Alterungsreserve");
    expect(html).toContain(
      'class="sg-speicher-bar mt-2 h-2.5 w-full overflow-hidden rounded-[2px] bg-transparent"'
    );
    expect(html).toContain("bg-chart-grid");
    expect(overviewHtml).toContain("Robustheit der technischen Speichergrenze");
    expect(overviewHtml).toContain(
      "Bei 2 realen Haushaltsprofilen liegt sie zwischen 5 und 7 kWh."
    );
    expect(overviewHtml).not.toContain("Stärker lastabhängig");
    expect(overviewHtml).toContain("Haushaltsprofile");
    expect(overviewHtml).not.toContain("Planerische Anfangskapazität =");
    expect(overviewHtml).not.toContain("75-%-Annahme");
    expect(overviewHtml.match(/Technische Speichergrenze/g)).toHaveLength(1);
    expect(overviewHtml.match(/Planerische Anfangskapazität/g)).toHaveLength(1);
    expect(overviewHtml).toContain("Was bringt Ihnen der Speicher?");
    expect(overviewHtml).toContain("Mehr Solarstrom selbst nutzen");
    expect(overviewHtml).toContain("Weniger Strom aus dem Netz");
    expect(overviewHtml).toContain("1 800");
    expect(overviewHtml).toContain("2 280");
    expect(overviewHtml).toContain("45");
    expect(overviewHtml).toContain("57");
    expect(overviewHtml).not.toContain("Eigenverbrauch ohne Speicher (jährlich)");
    expect(overviewHtml).not.toContain("Autarkie ohne Speicher:");
    expect(overviewHtml).not.toContain("Autarkie mit Speicher:");
    expect(overviewHtml).not.toContain("Prozentpunkte");
    expect(overviewHtml).not.toContain("3109");
    expect(overviewHtml).not.toContain("6508");
    expect(overviewHtml.match(/Eigener Solarstrom/g)).toHaveLength(1);
    expect(html).toContain(
      "Eigenverbrauch und Autarkie beziehen sich auf die technische"
    );
    expect(html).toContain("Berechnungsgrundlage: BDEW H25");
    expect(storageHtml).toContain(
      "Die technische Speichergrenze liegt bei"
    );
    expect(storageHtml).toContain("Planerische Anfangskapazität =");
    expect(storageHtml).toContain("75-%-Annahme");
    expect(html).not.toContain("einschließlich Wärmepumpe");

    expect(indexOf(html, "Eigenverbrauch vs Speichergröße")).toBeLessThan(
      indexOf(html, "Technische Kennzahlen")
    );
    expect(indexOf(html, "Grundlage der Berechnung")).toBeLessThan(
      indexOf(html, "Technische Kennzahlen")
    );
    expect(html).toContain("sg-result-anchor");
    expect(html).toContain(
      "font-sans text-[1.5rem] font-bold leading-[1.15]"
    );
    expect(html).toContain("text-[11px]");
    expect(html).toContain("tracking-[0.14em]");
    expect(html).not.toContain('id="report-quellen-heading"');
  });
});

describe("SpeicherReportView saved report variant", () => {
  it("keeps historical numbering, masthead, and original section order", () => {
    const html = renderToStaticMarkup(
      <SpeicherReportView
        mode="historical"
        variant="page"
        savedAt="2026-09-01T10:00:00.000Z"
        batteryModelVersion="1.1.0"
        {...sharedProps}
      />
    );

    expect(html).toContain("Gespeicherter Bericht");
    expect(html).toContain("02 / Ergebnis");
    expect(html).not.toContain("Berechnung nach BDEW H25");
    expect(html).toContain("Berechnungsgrundlage: BDEW H25");
    expect(html).toContain("Was bringt Ihnen der Speicher?");
    expect(html).toContain("Für die Kaufplanung bei angenommenen 75");
    expect(html).toContain("Restkapazität");
    expect(html).not.toContain("Für die Kaufplanung mit 25");
    expect(html).toContain(
      'class="sg-speicher-bar mt-2 h-2.5 w-full overflow-hidden rounded-[2px] bg-transparent"'
    );
    expect(html).toContain("bg-chart-grid");
    expect(html).not.toContain("Eigenverbrauch ohne Speicher (jährlich)");
    expect(html).not.toContain("Autarkie ohne Speicher:");
    expect(html).toContain("03 / Ihre Eingabedaten");
    expect(html).toContain("Musterstraße");
    expect(html).toContain("04 / Technische Kennzahlen");
    expect(html).toContain("05 / Eigenverbrauch vs Speichergröße");
    expect(html).toContain("06 / Unsere Einschätzung");
    expect(html).not.toContain("Grundlage der Berechnung");
    expect(html).not.toContain(`id="${RESULT_SECTION_IDS.overview}"`);
    expect(html).not.toContain(`id="${RESULT_SECTION_IDS.sources}"`);
    expect(html).toContain('id="report-quellen-heading"');
    expect(html).toContain("Quellen &amp; wissenschaftliche Grundlagen");

    expect(indexOf(html, "03 / Ihre Eingabedaten")).toBeLessThan(
      indexOf(html, "04 / Technische Kennzahlen")
    );
    expect(indexOf(html, "04 / Technische Kennzahlen")).toBeLessThan(
      indexOf(html, "05 / Eigenverbrauch vs Speichergröße")
    );
    expect(indexOf(html, "05 / Eigenverbrauch vs Speichergröße")).toBeLessThan(
      indexOf(html, "06 / Unsere Einschätzung")
    );
  });
});

describe("SpeicherReportView balance helper", () => {
  it("mentions the heat pump in grid import only when one is part of the run", () => {
    const withoutHeatPump = renderToStaticMarkup(
      <SpeicherReportView mode="live" variant="workspace" {...sharedProps} />
    );
    const withHeatPump = renderToStaticMarkup(
      <SpeicherReportView
        mode="live"
        variant="workspace"
        {...sharedProps}
        input={{
          ...sharedProps.input,
          heatPumpEnabled: true,
          heatPumpConsumptionKwh: 4500,
          heatPumpTechnology: "luftwasser",
        }}
      />
    );

    expect(withoutHeatPump).not.toContain("einschließlich Wärmepumpe");
    expect(withHeatPump).toContain("einschließlich Wärmepumpe");
  });
});
