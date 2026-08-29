#!/usr/bin/env node
/**
 * Generate the runtime BDEW H25 quarter-hour templates from the official XLSX.
 *
 * Source (do not interpolate the hourly CSV):
 *   apps/speicher-physik/src/app/(speicher)/data/source/
 *     bdew_representative_profiles_2025.xlsx  sheet H25
 *
 * Semantics (parity with current hourly production, Phase 4B):
 *   - Sunday uses the FT (Feiertag) template
 *   - Saturday → SA, other weekdays → WT
 *   - weekday public holidays are NOT remapped to FT
 *   - Dynamisierungsfunktion is NOT applied
 *   - leap day is omitted when assembling a year (same as hourly)
 *   - one uniform scale so calendar 2025 sums to 1_000_000 kWh
 *
 * Runtime artifact: src/bdew_h25_quarter_hour.ts
 * Production SpeicherGrenze still uses the hourly path until Phase 4D.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");

const XLSX_REL =
  "apps/speicher-physik/src/app/(speicher)/data/source/bdew_representative_profiles_2025.xlsx";
const SHEET_NAME = "H25";
const REFERENCE_YEAR = 2025;
const REFERENCE_ANNUAL_KWH = 1_000_000;
const SLOTS_PER_DAY = 96;
const SOURCE_DAY_TYPES = ["SA", "FT", "WT"];

const OUT_TS = path.join(PACKAGE_ROOT, "src", "bdew_h25_quarter_hour.ts");

function colLettersToNumber(col) {
  let n = 0;
  for (const ch of col) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

function parseCellRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Bad cell ref ${ref}`);
  return { col: m[1], row: Number(m[2]), colNum: colLettersToNumber(m[1]) };
}

function parseSharedStrings(xml) {
  const strings = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(m[1]))) {
      texts.push(decodeXml(tm[1]));
    }
    strings.push(texts.join(""));
  }
  return strings;
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSheetCells(xml, sharedStrings) {
  const cells = new Map();
  const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let m;
  while ((m = cRe.exec(xml))) {
    const attrs = m[1];
    const body = m[2];
    const refM = /r="([A-Z]+\d+)"/.exec(attrs);
    if (!refM) continue;
    const tM = /\bt="([^"]+)"/.exec(attrs);
    const type = tM ? tM[1] : null;
    const vM = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);
    if (!vM) continue;
    let value = vM[1];
    if (type === "s") {
      value = sharedStrings[Number(value)] ?? "";
    }
    cells.set(refM[1], { type, value });
  }
  return cells;
}

function cell(cells, col, row) {
  return cells.get(`${col}${row}`);
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function* iterateDays(year) {
  const leap = isLeapYear(year);
  const monthLengths = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= monthLengths[m]; d++) {
      if (leap && m === 1 && d === 29) continue;
      yield { month: m + 1, day: d };
    }
  }
}

function classifyDayTypeEuropeBerlin(year, month, day) {
  const ms = Date.UTC(year, month - 1, day, 12, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (wd === "Sat") return "SA";
  if (wd === "Sun") return "SU";
  return "WD";
}

/** Production parity: Sunday uses FT template; no weekday holiday remap. */
function sourceDayType(calendarDayType) {
  if (calendarDayType === "SA") return "SA";
  if (calendarDayType === "SU") return "FT";
  return "WT";
}

async function loadH25Sheet(xlsxPath) {
  const zip = await JSZip.loadAsync(readFileSync(xlsxPath));
  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip
    .file("xl/_rels/workbook.xml.rels")
    .async("string");

  const sheetM = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)];
  let rId = null;
  for (const sm of sheetM) {
    const attrs = sm[1];
    const nameM = /name="([^"]+)"/.exec(attrs);
    const idM = /r:id="([^"]+)"/.exec(attrs);
    if (nameM && nameM[1] === SHEET_NAME && idM) {
      rId = idM[1];
      break;
    }
  }
  if (!rId) {
    throw new Error(`Workbook has no sheet named ${SHEET_NAME}`);
  }

  const relM = new RegExp(
    `<Relationship\\b[^>]*Id="${rId}"[^>]*Target="([^"]+)"`
  ).exec(relsXml);
  if (!relM) {
    throw new Error(`No relationship for ${rId}`);
  }
  const target = relM[1].replace(/^\//, "");
  const sheetPath = target.startsWith("xl/")
    ? target
    : `xl/${target}`;

  const sharedXml = await zip.file("xl/sharedStrings.xml").async("string");
  const sheetXml = await zip.file(sheetPath).async("string");
  const sharedStrings = parseSharedStrings(sharedXml);
  return parseSheetCells(sheetXml, sharedStrings);
}

function extractRawTemplates(cells) {
  const labels = [];
  for (let row = 5; row <= 100; row++) {
    const lab = cell(cells, "B", row);
    if (!lab || !lab.value) {
      throw new Error(`Missing H25 slot label at B${row}`);
    }
    labels.push(String(lab.value));
  }
  if (labels.length !== SLOTS_PER_DAY) {
    throw new Error(`Expected ${SLOTS_PER_DAY} slot labels, got ${labels.length}`);
  }
  if (labels[0] !== "00:00-00:15" || labels[95] !== "23:45-00:00") {
    throw new Error(
      `Unexpected H25 slot labels: first=${labels[0]} last=${labels[95]}`
    );
  }

  const startCol = colLettersToNumber("C");
  const templates = {};
  for (let month = 1; month <= 12; month++) {
    templates[month] = { SA: [], FT: [], WT: [] };
    for (let t = 0; t < 3; t++) {
      const colNum = startCol + (month - 1) * 3 + t;
      const typeCell = cell(
        cells,
        colNumberToLetters(colNum),
        4
      );
      const typ = typeCell?.value;
      if (!SOURCE_DAY_TYPES.includes(typ)) {
        throw new Error(
          `Expected SA/FT/WT at month ${month} type col ${t}, got ${typ}`
        );
      }
      const slots = [];
      for (let row = 5; row <= 100; row++) {
        const c = cell(cells, colNumberToLetters(colNum), row);
        const n = Number(c?.value);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(
            `Invalid H25 value month=${month} type=${typ} row=${row}`
          );
        }
        slots.push(n);
      }
      templates[month][typ] = slots;
    }
  }
  return { labels, templates };
}

function colNumberToLetters(n) {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function buildReferenceYear(templates, year) {
  const out = [];
  for (const { month, day } of iterateDays(year)) {
    const cal = classifyDayTypeEuropeBerlin(year, month, day);
    const src = sourceDayType(cal);
    const block = templates[month][src];
    if (!block || block.length !== SLOTS_PER_DAY) {
      throw new Error(`Missing template ${month}:${src}`);
    }
    out.push(...block);
  }
  return out;
}

function formatNumberArray(arr) {
  const parts = arr.map((n) => JSON.stringify(n));
  const lines = [];
  for (let i = 0; i < parts.length; i += 8) {
    lines.push("      " + parts.slice(i, i + 8).join(", "));
  }
  return "[\n" + lines.join(",\n") + ",\n    ]";
}

function emitTs({ labels, scaled, scaleFactor, rawYearSum }) {
  const monthBlocks = [];
  for (let month = 1; month <= 12; month++) {
    monthBlocks.push(
      `  ${month}: {\n` +
        `    WT: ${formatNumberArray(scaled[month].WT)},\n` +
        `    SA: ${formatNumberArray(scaled[month].SA)},\n` +
        `    FT: ${formatNumberArray(scaled[month].FT)},\n` +
        `  }`
    );
  }

  return `/**
 * AUTO-GENERATED — do not edit by hand.
 * Regenerated by: npm run generate:h25 --workspace=packages/bdew-profile
 *
 * Official source profile is BDEW **H25** (household representative 2025),
 * not the legacy H0 name used by the hourly runtime files.
 *
 * Source XLSX: ${XLSX_REL}
 * Sheet: ${SHEET_NAME}
 * Native resolution: 96 quarter-hour slots/day
 *
 * Intentionally NOT applied (parity with current hourly production):
 *   - Dynamisierungsfunktion
 *   - weekday public-holiday → FT remap
 *
 * Sunday uses the FT template (same rule as the existing hourly series).
 * Uniform scale so calendar ${REFERENCE_YEAR} sums to ${REFERENCE_ANNUAL_KWH} kWh.
 */

export const BDEW_H25_SLOTS_PER_DAY = ${SLOTS_PER_DAY} as const;
export const BDEW_H25_STEPS_PER_NON_LEAP_YEAR = ${SLOTS_PER_DAY * 365} as const;
export const BDEW_H25_REFERENCE_CALENDAR_YEAR = ${REFERENCE_YEAR} as const;
export const BDEW_H25_REFERENCE_ANNUAL_KWH = ${REFERENCE_ANNUAL_KWH} as const;

export type BdewH25SourceDayType = "WT" | "SA" | "FT";

export const BDEW_H25_SOURCE = {
  profileKey: "H25",
  xlsxRelPath: ${JSON.stringify(XLSX_REL)},
  sheetName: ${JSON.stringify(SHEET_NAME)},
  dynamisierungApplied: false,
  weekdayHolidayRemap: false,
  sundayUsesFtTemplate: true,
  referenceCalendarYear: ${REFERENCE_YEAR},
  referenceAnnualKwh: ${REFERENCE_ANNUAL_KWH},
  slotsPerDay: ${SLOTS_PER_DAY},
  rawReferenceYearSumKwh: ${JSON.stringify(rawYearSum)},
  scaleAppliedToMatchReferenceYear: ${JSON.stringify(scaleFactor)},
} as const;

export const BDEW_H25_SLOT_LABELS: readonly string[] = ${JSON.stringify(labels)};

/**
 * month (1–12) → H25 source day type → 96 kWh weights.
 * Values are already scaled so a ${REFERENCE_YEAR} civil year sums to 1e6 kWh.
 */
export const BDEW_H25_TEMPLATES: {
  readonly [month: number]: {
    readonly WT: readonly number[];
    readonly SA: readonly number[];
    readonly FT: readonly number[];
  };
} = {
${monthBlocks.join(",\n")}
};
`;
}

async function main() {
  const xlsxPath = path.join(REPO_ROOT, XLSX_REL);
  const cells = await loadH25Sheet(xlsxPath);
  const { labels, templates } = extractRawTemplates(cells);
  const rawYear = buildReferenceYear(templates, REFERENCE_YEAR);
  if (rawYear.length !== SLOTS_PER_DAY * 365) {
    throw new Error(`Reference year length ${rawYear.length}`);
  }
  const rawYearSum = rawYear.reduce((a, b) => a + b, 0);
  if (!(rawYearSum > 0) || !Number.isFinite(rawYearSum)) {
    throw new Error(`Bad raw year sum ${rawYearSum}`);
  }
  const scaleFactor = REFERENCE_ANNUAL_KWH / rawYearSum;
  const scaled = {};
  for (let month = 1; month <= 12; month++) {
    scaled[month] = { WT: [], SA: [], FT: [] };
    for (const typ of SOURCE_DAY_TYPES) {
      scaled[month][typ] = templates[month][typ].map((v) => v * scaleFactor);
    }
  }

  const ts = emitTs({ labels, scaled, scaleFactor, rawYearSum });
  writeFileSync(OUT_TS, ts, "utf8");
  console.log(`Wrote ${path.relative(REPO_ROOT, OUT_TS)}`);
  console.log(`  raw 2025 sum: ${rawYearSum}`);
  console.log(`  scale:        ${scaleFactor}`);
  console.log(`  templates:    12 months × 3 types × ${SLOTS_PER_DAY} slots`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
