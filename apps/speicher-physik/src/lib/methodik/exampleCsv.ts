import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const EV_HOME_CHARGING_EXAMPLE_FILENAME =
  "ev-home-charging-profile-example.csv";

export const EV_HOME_CHARGING_EXAMPLE_DOWNLOAD_PATH = `/methodik/examples/${EV_HOME_CHARGING_EXAMPLE_FILENAME}`;

export const METHODIK_EXAMPLE_FILES = [
  EV_HOME_CHARGING_EXAMPLE_FILENAME,
] as const;

export type MethodikExampleFile = (typeof METHODIK_EXAMPLE_FILES)[number];

export type MethodikCsvRow = {
  date: string;
  time: string;
  kwh: number;
};

export type MethodikChartPoint = {
  x: string;
  y: number;
};

export type MethodikCsvWeekSeries = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  points: MethodikChartPoint[];
};

export type MethodikCsvDocument = {
  filename: string;
  headers: string[];
  preview: MethodikCsvRow[];
  previewGroups: MethodikCsvRow[][];
  daily: MethodikChartPoint[];
  week: MethodikCsvWeekSeries;
  rowCount: number;
  yearEnergyKwh: number;
};

/**
 * Friday–Sunday window from the 2025 reference year.
 * Same period as the CSV preview: weekday overnight charging,
 * Saturday 10:00–16:00, and Sunday with the same explicit window.
 */
export const EV_HOME_CHARGING_CHART_WEEK = {
  startDate: "2025-01-10",
  endDate: "2025-01-12",
  startTime: "00:00",
  endTime: "23:45",
} as const;

const PREVIEW_EXCERPT: readonly (readonly [string, string])[][] = [
  [
    ["2025-01-10", "17:30"],
    ["2025-01-10", "17:45"],
    ["2025-01-10", "18:00"],
    ["2025-01-10", "18:15"],
  ],
  [
    ["2025-01-11", "09:45"],
    ["2025-01-11", "10:00"],
    ["2025-01-11", "10:15"],
    ["2025-01-11", "10:30"],
  ],
  [
    ["2025-01-12", "10:00"],
    ["2025-01-12", "10:15"],
    ["2025-01-12", "10:30"],
    ["2025-01-12", "10:45"],
  ],
];

function resolveExampleFile(filename: string): string {
  const candidates = [
    path.join(
      process.cwd(),
      "..",
      "..",
      "docs",
      "public",
      "methodik",
      "examples",
      filename
    ),
    path.join(
      process.cwd(),
      "docs",
      "public",
      "methodik",
      "examples",
      filename
    ),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`Methodik example file not found: ${filename}`);
  }
  return match;
}

export function isAllowedMethodikExample(
  filename: string
): filename is MethodikExampleFile {
  return (METHODIK_EXAMPLE_FILES as readonly string[]).includes(filename);
}

export function readMethodikExampleCsv(filename: MethodikExampleFile): string {
  return readFileSync(resolveExampleFile(filename), "utf8");
}

function rowKey(date: string, time: string): string {
  return `${date}\t${time}`;
}

function requireRow(
  byKey: Map<string, MethodikCsvRow>,
  date: string,
  time: string,
  filename: string
): MethodikCsvRow {
  const row = byKey.get(rowKey(date, time));
  if (!row) {
    throw new Error(
      `Missing Methodik CSV row ${date} ${time} in ${filename}`
    );
  }
  return row;
}

export function parseHomeChargingCsv(
  csvText: string,
  filename: string
): MethodikCsvDocument {
  const lines = csvText.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error(`Methodik CSV is empty: ${filename}`);
  }

  const headers = lines[0].split(",");
  const byKey = new Map<string, MethodikCsvRow>();
  const dailyTotals = new Map<string, number>();
  const weekPoints: MethodikChartPoint[] = [];
  let yearEnergyKwh = 0;
  let rowCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const [date, time, energy] = lines[i].split(",");
    if (!date || !time || energy === undefined) {
      throw new Error(`Invalid Methodik CSV row ${i + 1} in ${filename}`);
    }
    const kwh = Number(energy);
    if (!Number.isFinite(kwh)) {
      throw new Error(`Non-numeric energy in ${filename} row ${i + 1}`);
    }

    const row = { date, time, kwh };
    rowCount += 1;
    yearEnergyKwh += kwh;
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + kwh);
    byKey.set(rowKey(date, time), row);

    if (
      date >= EV_HOME_CHARGING_CHART_WEEK.startDate &&
      date <= EV_HOME_CHARGING_CHART_WEEK.endDate
    ) {
      weekPoints.push({ x: `${date}T${time}`, y: kwh });
    }
  }

  const previewGroups = PREVIEW_EXCERPT.map((group) =>
    group.map(([date, time]) => requireRow(byKey, date, time, filename))
  );

  const daily = [...dailyTotals.entries()].map(([x, y]) => ({ x, y }));

  return {
    filename,
    headers,
    preview: previewGroups[0] ?? [],
    previewGroups,
    daily,
    week: {
      startDate: EV_HOME_CHARGING_CHART_WEEK.startDate,
      endDate: EV_HOME_CHARGING_CHART_WEEK.endDate,
      startTime: EV_HOME_CHARGING_CHART_WEEK.startTime,
      endTime: EV_HOME_CHARGING_CHART_WEEK.endTime,
      points: weekPoints,
    },
    rowCount,
    yearEnergyKwh,
  };
}

export function loadEvHomeChargingExample(): MethodikCsvDocument {
  const filename = EV_HOME_CHARGING_EXAMPLE_FILENAME;
  return parseHomeChargingCsv(readMethodikExampleCsv(filename), filename);
}

export function formatMethodikIsoDateDe(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

export function formatMethodikKwhDe(
  value: number,
  fractionDigits: number
): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatMethodikPreviewKwh(value: number): string {
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
  return `${formatted} kWh`;
}
