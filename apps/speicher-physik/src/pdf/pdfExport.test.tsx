import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { PDFDocument } from "pdf-lib";
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
import { PDF_DOWNLOAD_FILENAME } from "./pdfDownload";
import { renderSpeicherPdf } from "./renderSpeicherPdf";

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
    const chipTexts = model.chips.map((chip) => chip.text);
    expect(chipTexts.some((text) => text.startsWith("Wärmepumpe"))).toBe(false);
    expect(chipTexts.some((text) => text.startsWith("Elektroauto"))).toBe(false);
    expect(chipTexts.some((text) => text.startsWith("Notstrom"))).toBe(false);
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
    const chips = model.chips.map((chip) => chip.text).join("\n");
    expect(model.address).toContain("äöüß");
    expect(model.address).toContain("Augsburg-Oberhausen");
    expect(chips).toContain("Dachfläche 1");
    expect(chips).toContain("Dachfläche 2");
    expect(chips).toContain("Dachfläche 3");
    expect(chips).toContain("Wärmepumpe · Luft/Wasser");
    expect(chips).toContain("Elektroauto");
    expect(chips).toContain("14");
    expect(chips).toContain("Notstromreserve");
    expect(chips).toContain("WP-Stromverbrauch");
    expect(chips).toContain("Hausverbrauch ohne Wärmepumpe");
    expect(chips).not.toContain("Gesamtverbrauch");
    expect(model.scene.heatPump).toBe("luftwasser");
    expect(model.scene.ev).toBe(true);
    expect(model.scene.backup).toBe(true);
    expect(model.scene.src).toContain("base-house-no-label.png");
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
    const chipTexts = model.chips.map((chip) => chip.text);
    expect(chipTexts.some((text) => text.startsWith("Wärmepumpe"))).toBe(false);
    expect(chipTexts.some((text) => text.startsWith("Elektroauto"))).toBe(false);
    expect(chipTexts.some((text) => text.startsWith("Notstrom"))).toBe(false);
    expect(chipTexts.some((text) => text.startsWith("Ausrichtung"))).toBe(false);
    expect(chipTexts.some((text) => text.startsWith("Neigung"))).toBe(false);
    expect(chipTexts.join("\n")).toContain("—");
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
    expect(PDF_DOWNLOAD_FILENAME).toBe("SpeicherGrenze-Bericht.pdf");
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
    expect(heatPumpModel.chips.some((chip) => chip.text.startsWith("Gesamtverbrauch"))).toBe(
      false,
    );
    expect(
      heatPumpModel.chips.some((chip) => chip.text.startsWith("Hausverbrauch ohne Wärmepumpe")),
    ).toBe(true);
    expect(heatPumpModel.chips.some((chip) => chip.text.startsWith("WP-Stromverbrauch"))).toBe(
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

    expect((await PDFDocument.load(heatPumpPdf)).getPageCount()).toBe(6);
    expect((await PDFDocument.load(complexPdf)).getPageCount()).toBe(7);
  }, 30000);
});
