import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
} from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { HouseholdCalculationInput } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import type { HouseholdCalculationPayload } from "@/app/(speicher)/calculate/runHouseholdCalculation";
import { PdfDownloadButton } from "@/app/(speicher)/components/PdfDownloadButton";
import { mapCompletedCalculation } from "@/lib/persistCompletedCalculation";
import type { CalculationHistoryRow } from "@/lib/historicalSpeicherReport";

import { PdfSourceError, buildSpeicherPdfModel } from "./buildDisplayModel";
import { pdfAsset, publicAsset } from "./pdfAssets";
import {
  PDF_GENERATION_ERROR_MESSAGE,
  PDF_INCOMPATIBLE_MESSAGE,
  PDF_NOT_FOUND_MESSAGE,
  decidePdfAccess,
  pdfFailureResponse,
  type CalculationPdfRow,
} from "./pdfAccess";
import { filenameFromContentDisposition, pdfContentDisposition, pdfDownloadFilename } from "./pdfDownload";
import {
  PRIVATE_USE_MARK,
  privateUseOutline,
  privateUseTiles,
} from "./privateUseMarking";
import { renderSpeicherPdf } from "./renderSpeicherPdf";
import { ANALYSIS_INTRO, coverLines } from "./reportDocument";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
const CALC_ID = "22222222-2222-4222-8222-222222222222";

const input: HouseholdCalculationInput = {
  annualConsumptionKWh: 4000,
  pvSystemKwP: 10,
  street: "Musterstraße",
  houseNumber: "1",
  postalCode: "80331",
  city: "München",
  tiltDeg: 35,
  azimuthDeg: 180,
  pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 35, azimuthDeg: 180 }],
  heatPumpEnabled: false,
  backupReserveKwh: 0,
};

const payload: HouseholdCalculationPayload = {
  displayAddress: "Musterstraße 1, 80331 München",
  verifiedResult: {
    energy: {
      year: {
        selfConsumptionWithoutStorage: 1800,
        pvYieldKwhAnnual: 9500,
      },
    },
    batteryModelVersion: "1.1.0",
  },
  speicherGrenz: {
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
  },
  robustness: {
    cohortSize: 2,
    householdAnnualKwh: 4000,
    bdewTechnicalSizeKwh: 6,
    sizeUnchangedCount: 1,
    sizeFrequency: [{ sizeKwh: 6, householdCount: 2 }],
    ranges: {
      eigenverbrauchKwh: { min: 2000, p25: 2100, median: 2200, p75: 2300, max: 2400 },
      eigenverbrauchsquotePct: { min: 20, p25: 21, median: 22, p75: 23, max: 24 },
      autarkiePct: { min: 50, p25: 51, median: 52, p75: 53, max: 54 },
      netzbezugKwh: { min: 1600, p25: 1700, median: 1800, p75: 1900, max: 2000 },
      einspeisungKwh: { min: 7000, p25: 7100, median: 7200, p75: 7300, max: 7400 },
      technicalSpeichergrenzeKwh: { min: 5, p25: 5, median: 6, p75: 6, max: 7 },
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
  },
  wasserWasserRobustness: null,
  heatPump: null,
  ev: null,
};

function historyRow(
  overrides: Partial<CalculationHistoryRow> = {},
): CalculationHistoryRow {
  const mapped = mapCompletedCalculation({ userId: USER_ID, input, payload });
  return {
    id: CALC_ID,
    product_key: mapped.product_key,
    input: mapped.input,
    result_snapshot: mapped.result_snapshot,
    input_schema_version: mapped.input_schema_version,
    result_schema_version: mapped.result_schema_version,
    battery_model_version: mapped.battery_model_version,
    created_at: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

function ownedRow(row: CalculationHistoryRow, userId = USER_ID): CalculationPdfRow {
  return { ...row, user_id: userId };
}

describe("decidePdfAccess", () => {
  it("rejects a signed-out request", () => {
    expect(
      decidePdfAccess({
        userId: null,
        requestedId: CALC_ID,
        row: ownedRow(historyRow()),
      }).status,
    ).toBe("unauthenticated");
  });

  it("does not reveal a foreign report", () => {
    const decision = decidePdfAccess({
      userId: USER_ID,
      requestedId: CALC_ID,
      row: ownedRow(historyRow(), OTHER_USER_ID),
    });
    expect(decision.status).toBe("not_found");
    expect(PDF_NOT_FOUND_MESSAGE).toBe("Dieser Bericht ist nicht verfügbar.");
  });

  it("treats a missing row like a foreign row", () => {
    expect(
      decidePdfAccess({
        userId: USER_ID,
        requestedId: CALC_ID,
        row: null,
      }).status,
    ).toBe("not_found");
  });

  it("rejects an id that is not a calculation uuid", () => {
    expect(
      decidePdfAccess({
        userId: USER_ID,
        requestedId: "not-a-uuid",
        row: ownedRow(historyRow()),
      }).status,
    ).toBe("not_found");
  });

  it("refuses an incompatible saved schema", () => {
    expect(
      decidePdfAccess({
        userId: USER_ID,
        requestedId: CALC_ID,
        row: ownedRow(
          historyRow({ result_schema_version: "speicher-grenze-result/v0" }),
        ),
      }).status,
    ).toBe("incompatible");
  });

  it("allows the owner of a readable report", () => {
    expect(
      decidePdfAccess({
        userId: USER_ID,
        requestedId: CALC_ID,
        row: ownedRow(historyRow()),
      }).status,
    ).toBe("ok");
  });
});

describe("pdfFailureResponse", () => {
  it("keeps a broken snapshot distinct from a generator failure", () => {
    expect(pdfFailureResponse(new PdfSourceError())).toEqual({
      status: 422,
      message: PDF_INCOMPATIBLE_MESSAGE,
    });
    expect(pdfFailureResponse(new Error("font missing"))).toEqual({
      status: 500,
      message: PDF_GENERATION_ERROR_MESSAGE,
    });
  });
});

describe("buildSpeicherPdfModel", () => {
  it("uses the stored result, not a fresh zero", () => {
    const model = buildSpeicherPdfModel(historyRow());
    expect(model.address).toBe("Musterstraße 1, 80331 München");
    expect(model.technical.value).toMatch(/\d/);
    expect(model.chart.points.find((point) => point.size === 6)?.eigenverbrauch).toBe(
      2200,
    );
    expect(model.chart.markerCaption).toMatch(/Technische Speichergrenze · \d/);
    expect(model.chart.afterBoundary).toBeNull();
    expect(model.chart.lead).toContain("nur noch gering zu");
    expect(model.balance.rowsLeft.find((row) => row.label === "Jahresertrag PV")?.value).toContain(
      "9",
    );
    expect(model.profiles.rows[0]?.eigenverbrauch).toContain("2");
    expect(model.profiles.rows[0]?.eigenverbrauch).toContain("200");
    expect(model.robustness.appendixCount).toBe(2);
    expect(model.profiles.title).toBe("Einzelergebnisse der 2 Haushaltsprofile");
    expect(model.robustness.explanation.join("\n")).not.toContain("Anhang 1");
    expect(model.scene.heatPump).toBeNull();
    expect(model.scene.ev).toBe(false);
    expect(model.scene.backup).toBe(false);
    expect(model.roofTable).toEqual([
      { label: "1", kwp: "10 kWp", azimuth: "Süd (180°)", tilt: "35°" },
    ]);
    expect(model.plantFacts.map((fact) => fact.label)).toEqual([
      "PV-Anlage",
      "Hausverbrauch ohne Wärmepumpe",
    ]);
    expect(model.plantFacts.map((fact) => fact.value).join("\n")).not.toContain("Wärmepumpe");
    expect(model.plantFacts.some((fact) => fact.label === "Elektroauto")).toBe(false);
    expect(model.plantFacts.some((fact) => fact.label === "Notstromreserve")).toBe(false);
    expect(model.storageSteps.map((step) => step.size)).toEqual(
      model.chart.points.map((point) => point.size),
    );
    expect(model.storageSteps.map((step) => step.eigenverbrauch)).toEqual(
      model.chart.points.map((point) => point.eigenverbrauch),
    );
    expect(model.storageSteps[0]?.additional).toBeNull();
    expect(model.storageSteps[0]?.additionalLabel).toBe("—");
    expect(model.storageSteps[1]?.additional).toBe(100);
    expect(model.storageSteps[2]?.additional).toBe(80);
    expect(model.storageSteps.filter((step) => step.boundary).map((step) => step.size)).toEqual([
      model.chart.markerSize,
    ]);
  });

  it("keeps several roofs and the selected extra components", () => {
    const row = historyRow();
    const stored = row.input as Record<string, unknown>;
    stored.pvSystemKwP = 18.5;
    stored.pvSurfaces = [
      { systemSizeKwP: 8, tiltDeg: 30, azimuthDeg: 180 },
      { systemSizeKwP: 6.5, tiltDeg: 25, azimuthDeg: 90 },
      { systemSizeKwP: 4, tiltDeg: 40, azimuthDeg: 270 },
    ];
    stored.heatPumpEnabled = true;
    stored.heatPumpTechnology = "luftwasser";
    stored.heatPumpDhwService = "space_heat_and_dhw";
    stored.heatPumpConsumptionKWh = 3200;
    stored.backupReserveKwh = 2;
    stored.ev = { enabled: true, annualKm: 14000 };
    const snapshot = row.result_snapshot as Record<string, unknown>;
    snapshot.displayAddress =
      "Sehr langer Straßenname mit Umlauten äöüß 12, 86154 Augsburg-Oberhausen";

    const model = buildSpeicherPdfModel(row);
    const facts = model.plantFacts.map((fact) => `${fact.label} ${fact.value}`).join("\n");
    expect(model.address).toContain("äöüß");
    expect(model.address).toContain("Augsburg-Oberhausen");
    expect(model.roofTable).toEqual([
      { label: "1", kwp: "8 kWp", azimuth: "Süd (180°)", tilt: "30°" },
      { label: "2", kwp: "6.5 kWp", azimuth: "Ost (90°)", tilt: "25°" },
      { label: "3", kwp: "4 kWp", azimuth: "West (270°)", tilt: "40°" },
    ]);
    expect(facts).not.toContain("Dachfläche");
    expect(facts).toContain("PV-Anlage 18.5 kWp");
    expect(facts).toContain("Wärmepumpe Luft/Wasser");
    expect(facts).toContain("Elektroauto");
    expect(facts).toContain("14");
    expect(facts).toContain("Notstromreserve");
    expect(facts).toContain("WP-Stromverbrauch");
    expect(facts).toContain("Hausverbrauch ohne Wärmepumpe");
    expect(facts).not.toContain("Gesamtverbrauch");
    expect(model.scene.heatPump).toBe("luftwasser");
    expect(model.scene.ev).toBe(true);
    expect(model.scene.backup).toBe(true);
    expect(model.scene.src).toContain("base-house-no-label.png");
  });

  it("quotes the stored gain past the boundary and keeps the curve", () => {
    const row = historyRow();
    const snapshot = row.result_snapshot as Record<string, unknown>;
    const speicherGrenz = {
      ...(snapshot.speicherGrenz as Record<string, unknown>),
    };
    speicherGrenz.average = { 5: 2100, 6: 2200.4, 7: 2230.9 };
    snapshot.speicherGrenz = speicherGrenz;
    snapshot.presentation = {
      recommendedTechnicalSize: 6,
      recommendedPlanningSize: 8,
    };

    const model = buildSpeicherPdfModel(row);
    expect(model.chart.points.map((point) => point.eigenverbrauch)).toEqual([
      2100, 2200.4, 2230.9,
    ]);
    expect(model.chart.yMin).toBeLessThan(2100);
    expect(model.chart.yMax).toBeGreaterThan(2230.9);
    expect(model.chart.markerCaption).toBe(
      "Technische Speichergrenze · 6\u00A0kWh",
    );
    expect(model.chart.afterBoundary).toBe(
      "Von 6 auf 7\u00A0kWh: zusätzlich 31\u00A0kWh Solarstrom pro Jahr selbst genutzt.",
    );
    expect(model.chart.lead).toContain("nur noch gering zu");
    expect(model.chart.lead).not.toContain("Optimum");
    expect(model.storageSteps.map((step) => step.eigenverbrauch)).toEqual([
      2100, 2200.4, 2230.9,
    ]);
    expect(model.storageSteps.map((step) => step.additionalLabel)).toEqual(["—", "100", "31"]);
    expect(model.storageSteps.find((step) => step.boundary)?.size).toBe(6);
  });

  it("does not invent missing optional fields or loss components", () => {
    const row = historyRow();
    const stored = { ...(row.input as Record<string, unknown>) };
    delete stored.heatPumpEnabled;
    delete stored.heatPumpConsumptionKWh;
    delete stored.heatPumpTechnology;
    delete stored.ev;
    delete stored.backupReserveKwh;
    delete stored.tiltDeg;
    delete stored.azimuthDeg;
    delete stored.pvSurfaces;
    delete stored.annualConsumptionKWh;
    row.input = stored;
    const snapshot = row.result_snapshot as Record<string, unknown>;
    const speicherGrenz = {
      ...(snapshot.speicherGrenz as Record<string, unknown>),
    };
    delete speicherGrenz.averageChargeLossPvToBatteryKwh;
    snapshot.speicherGrenz = speicherGrenz;
    delete snapshot.robustness;

    const model = buildSpeicherPdfModel(row);
    const labels = model.plantFacts.map((fact) => fact.label);
    expect(labels).not.toContain("Wärmepumpe");
    expect(labels).not.toContain("Elektroauto");
    expect(labels).not.toContain("Notstromreserve");
    expect(labels).not.toContain("Ausrichtung");
    expect(labels).not.toContain("Neigung");
    expect(model.roofTable).toEqual([]);
    expect(model.plantFacts.map((fact) => fact.value).join("\n")).toContain("—");
    expect(model.profiles.rows).toEqual([]);
    expect(model.robustness.appendixCount).toBeNull();
    expect(model.profiles.title).toBe("Einzelergebnisse der Haushaltsprofile");
    expect(model.robustness.distribution).toEqual([]);
    const missingLoss = model.balance.losses?.items.find(
      (item) => item.label === "PV → Speicher",
    );
    if (missingLoss) {
      expect(missingLoss.value).toBe("—");
      expect(missingLoss.value).not.toContain("0");
    }
    expect(JSON.stringify(model)).not.toContain("30°");
    expect(JSON.stringify(model)).not.toContain("180°");
  });
});

describe("PDF assets", () => {
  it("resolves fonts, scene overlays, and the house from the app tree", () => {
    expect(readFileSync(pdfAsset("fonts", "Inter-Regular.ttf")).byteLength).toBeGreaterThan(
      1000,
    );
    expect(
      readFileSync(pdfAsset("scene", "heat-pump-luftwasser-gray.png")).byteLength,
    ).toBeGreaterThan(1000);
    expect(readFileSync(pdfAsset("scene", "ev-set-gray.png")).byteLength).toBeGreaterThan(
      1000,
    );
    expect(
      readFileSync(publicAsset("system-scene", "base-house-no-label.png")).byteLength,
    ).toBeGreaterThan(1000);
  });
});

describe("PdfDownloadButton", () => {
  it("offers the download and keeps the agreed file name", () => {
    const html = renderToStaticMarkup(
      <PdfDownloadButton calculationId={CALC_ID} />,
    );
    expect(html).toContain("PDF herunterladen");
    expect(html).not.toContain("disabled");
    const stored = {
      street: "Branderstraße",
      houseNumber: "44",
      reportAttribution: {
        companyName: "Sonnenwerk GmbH",
        clientGivenName: "Andrey",
        clientFamilyName: "Nachname",
      },
    };
    const filename = pdfDownloadFilename(stored);
    expect(filenameFromContentDisposition(pdfContentDisposition(filename))).toBe(filename);
  });
});

function inflatePdfStreams(pdf: Buffer): string {
  const source = pdf.toString("latin1");
  const parts = [source];
  const marker = "stream";
  let cursor = 0;
  while (cursor < pdf.length) {
    const start = pdf.indexOf(marker, cursor);
    if (start < 0) break;
    const dataStart = pdf[start + marker.length] === 0x0d ? start + marker.length + 2 : start + marker.length + 1;
    const end = pdf.indexOf("endstream", dataStart);
    if (end < 0) break;
    try {
      parts.push(inflateSync(pdf.subarray(dataStart, end)).toString("latin1"));
    } catch {
      /* Not a flate stream. */
    }
    cursor = end + "endstream".length;
  }
  return parts.join("\n");
}

function pdfLabel(value: unknown): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  if (value instanceof PDFName) return value.decodeText();
  return null;
}

function pageIndexOf(document: PDFDocument, ref: PDFRef): number {
  return document.getPages().findIndex((page) => page.ref === ref);
}

function nameTreeValue(document: PDFDocument, node: unknown, name: string): unknown {
  const dict = node instanceof PDFRef ? document.context.lookup(node) : node;
  if (!(dict instanceof PDFDict)) return null;
  const kids = dict.lookup(PDFName.of("Kids"));
  if (kids instanceof PDFArray) {
    for (const kid of kids.asArray()) {
      const found = nameTreeValue(document, kid, name);
      if (found) return found;
    }
  }
  const names = dict.lookup(PDFName.of("Names"));
  if (!(names instanceof PDFArray)) return null;
  const entries = names.asArray();
  for (let index = 0; index < entries.length; index += 2) {
    if (pdfLabel(document.context.lookup(entries[index])) === name) {
      return document.context.lookup(entries[index + 1]);
    }
  }
  return null;
}

function destinationPage(document: PDFDocument, dest: unknown, seen = new Set<string>()): number | null {
  const value = dest instanceof PDFRef ? document.context.lookup(dest) : dest;
  if (value instanceof PDFArray) {
    const first = value.get(0);
    if (first instanceof PDFRef) return pageIndexOf(document, first);
    const named = pdfLabel(first instanceof PDFRef ? null : document.context.lookup(first));
    return named ? namedDestinationPage(document, named, seen) : null;
  }
  if (value instanceof PDFDict) {
    const inner = value.lookup(PDFName.of("D"));
    return inner ? destinationPage(document, inner, seen) : null;
  }
  const named = pdfLabel(value);
  return named ? namedDestinationPage(document, named, seen) : null;
}

function namedDestinationPage(document: PDFDocument, name: string, seen: Set<string>): number | null {
  if (seen.has(name)) return null;
  seen.add(name);
  const direct = document.catalog.lookup(PDFName.of("Dests"));
  if (direct instanceof PDFDict) {
    const entry = direct.get(PDFName.of(name));
    if (entry) return destinationPage(document, entry, seen);
  }
  const names = document.catalog.lookup(PDFName.of("Names"));
  if (names instanceof PDFDict) {
    const tree = nameTreeValue(document, names.lookup(PDFName.of("Dests")), name);
    if (tree) return destinationPage(document, tree, seen);
  }
  return null;
}

function internalLinkTargets(document: PDFDocument): { page: number; target: number }[] {
  const links: { page: number; target: number }[] = [];
  document.getPages().forEach((page, pageIndex) => {
    const annots = page.node.Annots();
    if (!(annots instanceof PDFArray)) return;
    for (const entry of annots.asArray()) {
      const annot = document.context.lookup(entry);
      if (!(annot instanceof PDFDict)) continue;
      if (pdfLabel(annot.lookup(PDFName.of("Subtype"))) !== "Link") continue;
      const action = annot.lookup(PDFName.of("A"));
      const dest = annot.lookup(PDFName.of("Dest"))
        ?? (action instanceof PDFDict ? action.lookup(PDFName.of("D")) : null);
      if (!dest) continue;
      const target = destinationPage(document, dest);
      if (target != null) links.push({ page: pageIndex + 1, target: target + 1 });
    }
  });
  return links;
}

describe("renderSpeicherPdf", () => {
  it("embeds fonts, German text, the house, links, and page numbers", async () => {
    const row = historyRow();
    const snapshot = row.result_snapshot as Record<string, unknown>;
    snapshot.displayAddress = "Branderstraße 44, 86154 Augsburg";
    const model = buildSpeicherPdfModel(row);
    const pdf = await renderSpeicherPdf(model);
    const document = await PDFDocument.load(pdf);
    const decoded = inflatePdfStreams(pdf);

    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(decoded).toMatch(/Inter/);
    expect(decoded).toMatch(/Plex|IBMPlex/);
    expect(decoded).toContain("speicher.pvnavigator.de");
    expect(decoded).toContain("https://speicher.pvnavigator.de/methodik");
    expect(decoded).toMatch(/\/Subtype\s*\/Image|\/Subtype\/Image/);
    expect(document.getPageCount()).toBe(8);
    expect(internalLinkTargets(document)).toEqual(
      expect.arrayContaining([
        { page: 3, target: 7 },
        { page: 4, target: 8 },
      ]),
    );
  }, 30000);

  it("drops the Gesamtverbrauch continuation and keeps a long continuation with its first row", async () => {
    const heatPumpRow = historyRow();
    const heatPumpInput = { ...(heatPumpRow.input as Record<string, unknown>) };
    heatPumpInput.annualConsumptionKWh = 5000;
    heatPumpInput.heatPumpEnabled = true;
    heatPumpInput.heatPumpTechnology = "luftwasser";
    heatPumpInput.heatPumpDhwService = "space_heat_and_dhw";
    heatPumpInput.heatPumpConsumptionKWh = 5000;
    heatPumpRow.input = heatPumpInput;
    const heatPumpSnapshot = heatPumpRow.result_snapshot as Record<string, unknown>;
    heatPumpSnapshot.displayAddress = "Branderstraße 44, 86154 Augsburg-Oberhausen, Germany";
    const heatPumpModel = buildSpeicherPdfModel(heatPumpRow);
    expect(heatPumpModel.plantFacts.some((fact) => fact.label === "Gesamtverbrauch")).toBe(false);
    expect(
      heatPumpModel.plantFacts.some((fact) => fact.label === "Hausverbrauch ohne Wärmepumpe"),
    ).toBe(true);
    expect(heatPumpModel.plantFacts.some((fact) => fact.label === "WP-Stromverbrauch")).toBe(
      true,
    );
    const heatPumpPdf = await renderSpeicherPdf(heatPumpModel);

    const complexRow = historyRow();
    const stored = complexRow.input as Record<string, unknown>;
    stored.pvSystemKwP = 18.5;
    stored.annualConsumptionKWh = 4200;
    stored.pvSurfaces = [
      { systemSizeKwP: 8, tiltDeg: 30, azimuthDeg: 180 },
      { systemSizeKwP: 6.5, tiltDeg: 25, azimuthDeg: 90 },
      { systemSizeKwP: 4, tiltDeg: 40, azimuthDeg: 270 },
    ];
    stored.heatPumpEnabled = true;
    stored.heatPumpTechnology = "luftwasser";
    stored.heatPumpDhwService = "space_heat_and_dhw";
    stored.heatPumpConsumptionKWh = 3200;
    stored.backupReserveKwh = 2;
    stored.ev = { enabled: true, annualKm: 14000 };
    const complexSnapshot = complexRow.result_snapshot as Record<string, unknown>;
    complexSnapshot.displayAddress =
      "Sehr langer Straßenname mit Umlauten äöüß und Bindestrich, Hausnummer 128a, 86154 Augsburg-Oberhausen, Bayern";
    const complexModel = buildSpeicherPdfModel(complexRow);
    const complexPdf = await renderSpeicherPdf(complexModel);

    expect((await PDFDocument.load(heatPumpPdf)).getPageCount()).toBe(8);
    expect((await PDFDocument.load(complexPdf)).getPageCount()).toBe(8);
    expect(complexModel.attribution).toBeNull();

    const companyComplex = historyRow();
    companyComplex.input = {
      ...(complexRow.input as Record<string, unknown>),
      reportAttribution: {
        companyName: "Analytical Engines GmbH",
        clientGivenName: "Grace",
        clientFamilyName: "Hopper",
      },
    };
    companyComplex.result_snapshot = complexRow.result_snapshot;
    const companyComplexModel = buildSpeicherPdfModel(companyComplex);
    expect(coverLines(companyComplexModel)).toContain("Erstellt von: Analytical Engines GmbH");
    expect(coverLines(companyComplexModel)).toContain("Erstellt für: Grace Hopper");
    const companyComplexPdf = await renderSpeicherPdf(companyComplexModel);
    expect((await PDFDocument.load(companyComplexPdf)).getPageCount()).toBe(8);
  }, 30000);

  it("prints the frozen company lines on an eight-page report and omits them otherwise", async () => {
    const plain = buildSpeicherPdfModel(historyRow());
    expect(plain.attribution).toBeNull();
    expect(coverLines(plain)).toEqual([
      "Ihre Speicher-Analyse",
      plain.address,
      `Gespeichert am ${plain.savedAt}`,
    ]);
    const plainPdf = await renderSpeicherPdf(plain);

    const companyRow = historyRow();
    const stored = companyRow.input as Record<string, unknown>;
    companyRow.input = {
      ...stored,
      reportAttribution: {
        companyName: "Bombe Ltd",
        clientGivenName: "Grace",
        clientFamilyName: "Hopper",
      },
    };
    const company = buildSpeicherPdfModel(companyRow);
    expect(company.attribution).toEqual({
      companyName: "Bombe Ltd",
      clientName: "Grace Hopper",
    });
    expect(coverLines(company)).toEqual([
      "Ihre Speicher-Analyse",
      company.address,
      "Erstellt von: Bombe Ltd",
      "Erstellt für: Grace Hopper",
      `Gespeichert am ${company.savedAt}`,
    ]);
    const companyPdf = await renderSpeicherPdf(company);
    expect((await PDFDocument.load(companyPdf)).getPageCount()).toBe(
      (await PDFDocument.load(plainPdf)).getPageCount(),
    );
    expect(inflatePdfStreams(companyPdf)).toContain("speicher.pvnavigator.de");
    expect(inflatePdfStreams(plainPdf)).not.toContain("Erstellt von:");
  }, 30000);
});

const REVIEW_DIR = new URL("../../.pdf-sample/roof-layout/", import.meta.url);

function surfacesForCount(count: number) {
  const azimuths = [180, 90, 270, 135, 225, 45, 315, 0, 150, 71];
  const tilts = [30, 25, 40, 35, 15, 45, 60, 0, 22, 35];
  return Array.from({ length: count }, (_, index) => ({
    systemSizeKwP: Math.round((1.4 + index * 0.35) * 1000) / 1000,
    tiltDeg: tilts[index] ?? 30,
    azimuthDeg: azimuths[index] ?? 180,
  }));
}

function rowWithRoofs(
  count: number,
  extras: { heatPump?: boolean; ev?: boolean; backup?: boolean },
) {
  const row = historyRow();
  const stored = row.input as Record<string, unknown>;
  const surfaces = surfacesForCount(count);
  const total = surfaces.reduce((sum, surface) => sum + surface.systemSizeKwP, 0);
  stored.pvSystemKwP = total;
  stored.pvSurfaces = surfaces;
  stored.annualConsumptionKWh = 4200;
  const heatPump = extras.heatPump !== false;
  stored.heatPumpEnabled = heatPump;
  stored.heatPumpTechnology = heatPump ? "luftwasser" : undefined;
  stored.heatPumpDhwService = heatPump ? "space_heat_and_dhw" : undefined;
  stored.heatPumpConsumptionKWh = heatPump ? 3200 : undefined;
  stored.backupReserveKwh = extras.backup ? 2 : 0;
  stored.ev = extras.ev ? { enabled: true, annualKm: 14000 } : { enabled: false };
  stored.reportAttribution = {
    companyName: "Analytical Engines GmbH",
    clientGivenName: "Grace",
    clientFamilyName: "Hopper",
  };
  const snapshot = row.result_snapshot as Record<string, unknown>;
  snapshot.displayAddress =
    "Sehr langer Straßenname mit Umlauten äöüß, Hausnummer 128a, 86154 Augsburg-Oberhausen";
  return row;
}

describe("cover roof layout", () => {
  it("puts every roof in the table and keeps plant facts out of it", () => {
    const one = buildSpeicherPdfModel(rowWithRoofs(1, { ev: true }));
    expect(one.roofTable).toEqual([
      { label: "1", kwp: "1.4 kWp", azimuth: "Süd (180°)", tilt: "30°" },
    ]);
    const oneLabels = one.plantFacts.map((fact) => fact.label);
    expect(oneLabels).not.toContain("Ausrichtung");
    expect(oneLabels).not.toContain("Neigung");
    expect(oneLabels).not.toContain("Dachfläche");

    const two = buildSpeicherPdfModel(rowWithRoofs(2, { ev: true }));
    expect(two.roofTable).toEqual([
      { label: "1", kwp: "1.4 kWp", azimuth: "Süd (180°)", tilt: "30°" },
      { label: "2", kwp: "1.75 kWp", azimuth: "Ost (90°)", tilt: "25°" },
    ]);
    expect(two.plantFacts.map((fact) => fact.label).join("\n")).not.toContain("Dachfläche");

    const plain = buildSpeicherPdfModel(rowWithRoofs(4, { heatPump: false }));
    expect(plain.plantFacts.map((fact) => fact.label)).toEqual([
      "PV-Anlage",
      "Hausverbrauch ohne Wärmepumpe",
    ]);
    expect(plain.roofTable).toHaveLength(4);

    for (const count of [1, 2, 4, 6, 7, 10]) {
      const model = buildSpeicherPdfModel(
        rowWithRoofs(count, { ev: true, backup: true }),
      );
      expect(model.roofTable).toHaveLength(count);
      expect(model.plantFacts.map((fact) => fact.label)).toEqual([
        "PV-Anlage",
        "Hausverbrauch ohne Wärmepumpe",
        "Notstromreserve",
        "Wärmepumpe",
        "Verwendung",
        "WP-Stromverbrauch",
        "Elektroauto",
      ]);
      expect(model.plantFacts.find((fact) => fact.label === "Wärmepumpe")?.value).toBe(
        "Luft/Wasser",
      );
      expect(model.plantFacts.find((fact) => fact.label === "Verwendung")?.value).toBe(
        "Heizung und Warmwasser",
      );
      expect(model.roofTable[0]).toMatchObject({
        label: "1",
        azimuth: "Süd (180°)",
        tilt: "30°",
      });
      expect(model.roofTable[count - 1]?.label).toBe(String(count));
    }

    const six = buildSpeicherPdfModel(rowWithRoofs(6, { ev: true }));
    expect(six.roofTable.map((row) => row.kwp)).toEqual([
      "1.4 kWp",
      "1.75 kWp",
      "2.1 kWp",
      "2.45 kWp",
      "2.8 kWp",
      "3.15 kWp",
    ]);
    expect(six.roofTable[4]?.tilt).toBe("15°");
    expect(six.roofTable[5]?.azimuth).toBe("Nordost (45°)");
  });

  it("states the PVGIS, BDEW H25 and profile roles without treating PVGIS as 15-minute data", () => {
    const text = ANALYSIS_INTRO.join("\n");
    expect(text).toContain("PVNAVIGATOR_");
    expect(text).toContain("stündliche Erzeugungswerte");
    expect(text).toContain("BDEW H25");
    expect(text).toContain("27 gemessenen Haushaltsprofilen");
    expect(text).toContain("Die Hauptrechnung bleibt BDEW H25.");
    expect(text).not.toContain("15-Minuten-Wetter");
  });

  it("keeps every cover on one page and the report at eight pages", async () => {
    mkdirSync(REVIEW_DIR, { recursive: true });
    const cases = [1, 2, 4, 6, 7, 10].flatMap((count) => [
      { count, heatPump: false, ev: false, backup: false },
      { count, heatPump: false, ev: true, backup: false },
      { count, heatPump: true, ev: false, backup: false },
      { count, heatPump: true, ev: true, backup: false },
      { count, heatPump: true, ev: true, backup: true },
    ]);
    for (const item of cases) {
      const model = buildSpeicherPdfModel(
        rowWithRoofs(item.count, {
          heatPump: item.heatPump,
          ev: item.ev,
          backup: item.backup,
        }),
      );
      const pdf = await renderSpeicherPdf(model);
      const name = `roofs-${item.count}${item.heatPump ? "-wp" : ""}${item.ev ? "-ev" : ""}${item.backup ? "-backup" : ""}.pdf`;
      writeFileSync(new URL(name, REVIEW_DIR), pdf);
      expect((await PDFDocument.load(pdf)).getPageCount(), name).toBe(8);
    }

    const sweep = rowWithRoofs(1, { heatPump: false });
    const snapshot = sweep.result_snapshot as Record<string, unknown>;
    const speicherGrenz = {
      ...(snapshot.speicherGrenz as Record<string, unknown>),
    };
    const batterySizes: number[] = [];
    const average: Record<number, number> = {};
    let eigenverbrauch = 2100;
    for (let size = 5; size <= 30; size += 1) {
      batterySizes.push(size);
      average[size] = eigenverbrauch;
      eigenverbrauch += size < 15 ? 80 : 20;
    }
    speicherGrenz.batterySizes = batterySizes;
    speicherGrenz.average = average;
    snapshot.speicherGrenz = speicherGrenz;
    delete snapshot.presentation;
    const sweepModel = buildSpeicherPdfModel(sweep);
    expect(sweepModel.storageSteps).toHaveLength(26);
    expect(sweepModel.storageSteps.map((step) => step.size)).toEqual(
      sweepModel.chart.points.map((point) => point.size),
    );
    expect(sweepModel.storageSteps.map((step) => step.eigenverbrauch)).toEqual(
      sweepModel.chart.points.map((point) => point.eigenverbrauch),
    );
    expect(sweepModel.storageSteps[0]?.additional).toBeNull();
    expect(sweepModel.chart.markerSize).toBe(15);
    expect(sweepModel.storageSteps.filter((step) => step.boundary).map((step) => step.size)).toEqual([
      15,
    ]);
    expect(sweepModel.storageSteps[10]?.additional).toBe(80);
    expect(sweepModel.storageSteps[11]?.additional).toBe(20);
    const sweepPdf = await renderSpeicherPdf(sweepModel);
    writeFileSync(new URL("sizes-5-30.pdf", REVIEW_DIR), sweepPdf);
    expect((await PDFDocument.load(sweepPdf)).getPageCount()).toBe(8);
  }, 180000);
});

describe("private-use marking", () => {
  it("is decided by the stored access tier only", () => {
    expect(buildSpeicherPdfModel(historyRow({ access_tier: "free" })).privateUse).toBe(false);
    expect(buildSpeicherPdfModel(historyRow({ access_tier: "paid" })).privateUse).toBe(false);
    expect(buildSpeicherPdfModel(historyRow({ access_tier: null })).privateUse).toBe(false);
    expect(buildSpeicherPdfModel(historyRow()).privateUse).toBe(false);
  });

  it("places one pale mark inside the content area, clear of header and footer", () => {
    const tiles = privateUseTiles();
    const outline = privateUseOutline();
    expect(tiles).toHaveLength(1);
    expect(outline.d.length).toBeGreaterThan(500);
    expect(outline.width).toBeGreaterThan(200);
    const mm = 72 / 25.4;
    const angle = (Math.abs(PRIVATE_USE_MARK.rotateDeg) * Math.PI) / 180;
    const halfH = (outline.width * Math.sin(angle) + outline.capHeight * Math.cos(angle)) / 2;
    const halfW = (outline.width * Math.cos(angle) + outline.capHeight * Math.sin(angle)) / 2;
    for (const tile of tiles) {
      expect(tile.y - halfH).toBeGreaterThan(20 * mm);
      expect(tile.y + halfH).toBeLessThan(297 * mm - 20 * mm);
      expect(tile.x - halfW).toBeGreaterThan(0);
      expect(tile.x + halfW).toBeLessThan(210 * mm);
    }
    expect(PRIVATE_USE_MARK.fillOpacity).toBeLessThanOrEqual(0.08);
  });

  it("leaves free, paid and legacy reports without the private-use mark", async () => {
    const free = await renderSpeicherPdf(buildSpeicherPdfModel(historyRow({ access_tier: "free" })));
    const paid = await renderSpeicherPdf(buildSpeicherPdfModel(historyRow({ access_tier: "paid" })));
    const legacy = await renderSpeicherPdf(buildSpeicherPdfModel(historyRow()));

    const freeDoc = await PDFDocument.load(free);
    const opacity = PRIVATE_USE_MARK.fillOpacity.toString();
    const marked = new RegExp(`/ca ${opacity}\\b`);
    expect(inflatePdfStreams(free)).not.toMatch(marked);
    expect(inflatePdfStreams(paid)).not.toMatch(marked);
    expect(inflatePdfStreams(legacy)).not.toMatch(marked);
    expect(freeDoc.getPageCount()).toBe((await PDFDocument.load(paid)).getPageCount());
  }, 60000);
});
