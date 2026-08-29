/**
 * PVGIS Adapter – loads hourly PV production (8760h) from PVGIS API.
 * Server-only: fetch, no client usage.
 * Handles hourly, hourly_fixed, time_series.data.
 *
 * Temporal model: UTC stamps → Europe/Berlin civil parts → skip local Feb 29 →
 * explicit non-leap 8760 index. DST is a fixed-grid approximation (spring gap /
 * autumn accumulation), not 23/25-hour simulation days.
 *
 * Multi-year responses MUST be split by UTC year before alignment (local year is
 * ignored when indexing into the 8760 grid).
 */

export type LoadPVGISParams = {
  latitude: number;
  longitude: number;
  systemSizeKwP: number;
  tiltDeg: number;
  azimuthDeg: number;
  /** Optional PVGIS `startyear`. Defaults to 2018 for backward compatibility. */
  startYear?: number;
  /** Optional PVGIS `endyear`. Defaults to `startYear ?? 2018`. */
  endYear?: number;
};

export type PVGISHourlyRow = {
  ts: string;
  pvKWh: number;
};

export type LoadPVGISHourlyProductionResult = {
  hourly: PVGISHourlyRow[];
  meta: {
    count: number;
    source: "hourly" | "hourly_fixed" | "time_series";
  };
};

export type PvgisRawHourlyRow = {
  time?: string;
  P?: number;
};

export const HOURS_PER_NON_LEAP_YEAR = 8760;

/** Month lengths for the fixed non-leap civil grid (February = 28). */
export const NON_LEAP_MONTH_LENGTHS = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/** Single-year default; multi-year range gets a modest increase. */
const PVGIS_TIMEOUT_MS_SINGLE_YEAR = 10_000;
/** Cap for multi-year range fetches (e.g. 2006–2020 ≈ 15× hourly payload). */
const PVGIS_TIMEOUT_MS_MULTI_YEAR_CAP = 30_000;
/** Extra ms per calendar year beyond the first in a range request. */
const PVGIS_TIMEOUT_MS_PER_EXTRA_YEAR = 4_000;

/**
 * Timeout for a PVGIS seriescalc fetch.
 * Single year: 10s (unchanged). Multi-year: 10s + 4s × (years−1), capped at 30s.
 * Example: 2016–2020 → 5 years → 26s; 2006–2020 → 15 years → capped at 30s.
 */
export function pvgisFetchTimeoutMs(startYear: number, endYear: number): number {
  const span = Math.max(1, endYear - startYear + 1);
  if (span <= 1) return PVGIS_TIMEOUT_MS_SINGLE_YEAR;
  return Math.min(
    PVGIS_TIMEOUT_MS_MULTI_YEAR_CAP,
    PVGIS_TIMEOUT_MS_SINGLE_YEAR + (span - 1) * PVGIS_TIMEOUT_MS_PER_EXTRA_YEAR
  );
}

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) {
    return true;
  }
  if (typeof err === "object" && err !== null) {
    const e = err as {
      code?: string;
      name?: string;
      cause?: { code?: string; name?: string };
    };
    if (e.code && RETRYABLE_ERROR_CODES.has(e.code)) return true;
    if (e.cause?.code && RETRYABLE_ERROR_CODES.has(e.cause.code)) return true;
    if (e.name === "AbortError" || e.cause?.name === "ConnectTimeoutError") {
      return true;
    }
  }
  return false;
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  attempts: number = 3,
  timeoutMs: number = PVGIS_TIMEOUT_MS_SINGLE_YEAR
): Promise<Response> {
  const delays = [500, 1000];
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isRetryableNetworkError(err)) throw err;
      const wait = delays[i] ?? delays[delays.length - 1];
      console.warn(
        `[PVGIS] fetch failed (attempt ${i + 1}/${attempts}), retry in ${wait}ms:`,
        err instanceof Error ? err.message : err
      );
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/**
 * Map validated Europe/Berlin civil month/day/hour onto the fixed non-leap
 * 8760 grid. Does not use Date.UTC rollover; rejects Feb 29 and invalid dates.
 *
 * @param month - 1..12
 * @param day - 1..monthLength (Feb max 28)
 * @param hour - 0..23
 * @returns index in 0..8759
 */
export function nonLeapCivilHourIndex(
  month: number,
  day: number,
  hour: number
): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: ${hour}`);
  }
  if (month === 2 && day === 29) {
    throw new Error("February 29 is not part of the non-leap 8760 grid");
  }
  const monthLen = NON_LEAP_MONTH_LENGTHS[month - 1];
  if (!Number.isInteger(day) || day < 1 || day > monthLen) {
    throw new Error(`Invalid day ${day} for month ${month}`);
  }

  let dayOfYear0 = 0;
  for (let m = 1; m < month; m++) {
    dayOfYear0 += NON_LEAP_MONTH_LENGTHS[m - 1];
  }
  dayOfYear0 += day - 1;
  return dayOfYear0 * 24 + hour;
}

export type BerlinLocalParts = {
  year: number;
  /** 1..12 */
  month: number;
  day: number;
  hour: number;
};

/** Convert a UTC instant to Europe/Berlin civil calendar parts. */
export function utcMsToBerlinLocalParts(utcMs: number): BerlinLocalParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
  }).formatToParts(new Date(utcMs));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  };
}

/**
 * Align raw PVGIS hourly rows onto the fixed 8760 Berlin civil grid.
 *
 * Pipeline per row:
 * 1. Parse `YYYYMMDD:HHMM` as UTC.
 * 2. Convert to Europe/Berlin local year/month/day/hour.
 * 3. Skip intervals whose local date is February 29 (energy discarded).
 * 4. Index via {@link nonLeapCivilHourIndex} (no Date rollover).
 * 5. Accumulate with `+=` when multiple UTC stamps map to the same local hour
 *    (intentional autumn DST simplification on a fixed 24×365 grid).
 * 6. Missing local hours (e.g. spring DST gap) remain 0.
 *
 * Year-boundary UTC stamps may land on the periodic civil grid by local
 * month/day/hour only (local year is ignored for indexing).
 *
 * Callers with multi-year rows MUST {@link bucketPvgisRowsByUtcYear} first and
 * align each year separately — otherwise years are superimposed.
 */
export function alignPvgisRowsToBerlinLocal8760(
  raw: ReadonlyArray<PvgisRawHourlyRow>
): { ts: string; pvKWh: number }[] {
  const result = new Array<number>(HOURS_PER_NON_LEAP_YEAR).fill(0);
  const tsArr: string[] = new Array(HOURS_PER_NON_LEAP_YEAR);

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const watts = typeof row?.P === "number" ? row.P : 0;
    const pvKwh = watts / 1000;

    const timeStr = row?.time;
    if (!timeStr) continue;

    // YYYYMMDD:HHMM
    const year = Number(timeStr.slice(0, 4));
    const monthUtc = Number(timeStr.slice(4, 6));
    const dayUtc = Number(timeStr.slice(6, 8));
    const hour = Number(timeStr.slice(9, 11));
    const minute = Number(timeStr.slice(11, 13));

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(monthUtc) ||
      !Number.isFinite(dayUtc) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      continue;
    }

    const utcMs = Date.UTC(year, monthUtc - 1, dayUtc, hour, minute);
    const berlin = utcMsToBerlinLocalParts(utcMs);

    // Leap-day policy: drop Europe/Berlin February 29 entirely (do not fold).
    if (berlin.month === 2 && berlin.day === 29) {
      continue;
    }

    const idx = nonLeapCivilHourIndex(berlin.month, berlin.day, berlin.hour);
    result[idx] += pvKwh;

    if (!tsArr[idx]) {
      tsArr[idx] = timeStr;
    }
  }

  return result.map((v, i) => ({
    ts: tsArr[i] ?? "",
    pvKWh: v,
  }));
}

/**
 * Bucket raw PVGIS rows by UTC calendar year from `YYYYMMDD:HHMM`.
 * Rows without a parseable year are skipped.
 */
export function bucketPvgisRowsByUtcYear(
  raw: ReadonlyArray<PvgisRawHourlyRow>
): Map<number, PvgisRawHourlyRow[]> {
  const buckets = new Map<number, PvgisRawHourlyRow[]>();
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const timeStr = row?.time;
    if (!timeStr || timeStr.length < 4) continue;
    const year = Number(timeStr.slice(0, 4));
    if (!Number.isInteger(year) || year < 1900 || year > 2100) continue;
    let bucket = buckets.get(year);
    if (!bucket) {
      bucket = [];
      buckets.set(year, bucket);
    }
    bucket.push(row);
  }
  return buckets;
}

/**
 * Split multi-year raw rows by UTC year, then align each year with the existing
 * Berlin 8760 pipeline. Returns one `number[]` of length 8760 per year.
 *
 * Order: bucket by UTC year → {@link alignPvgisRowsToBerlinLocal8760} per year.
 * Never aligns the full multi-year array in one pass.
 */
export function alignMultiYearPvgisRowsByUtcYear(
  raw: ReadonlyArray<PvgisRawHourlyRow>
): Record<number, number[]> {
  const buckets = bucketPvgisRowsByUtcYear(raw);
  const out: Record<number, number[]> = {};
  for (const [year, rows] of buckets) {
    const aligned = alignPvgisRowsToBerlinLocal8760(rows);
    if (aligned.length !== HOURS_PER_NON_LEAP_YEAR) {
      throw new Error(
        `PVGIS hourly length mismatch AFTER ALIGN for year ${year}: ${aligned.length}`
      );
    }
    out[year] = aligned.map((r) => r.pvKWh);
  }
  return out;
}

function buildSeriescalcUrl(params: LoadPVGISParams): {
  url: string;
  startYear: number;
  endYear: number;
} {
  const url = new URL("https://re.jrc.ec.europa.eu/api/v5_2/seriescalc");
  url.searchParams.set("lat", String(params.latitude));
  url.searchParams.set("lon", String(params.longitude));
  url.searchParams.set("peakpower", String(params.systemSizeKwP));
  url.searchParams.set("angle", String(params.tiltDeg));
  url.searchParams.set("aspect", String(params.azimuthDeg));
  url.searchParams.set("loss", "14");
  url.searchParams.set("outputformat", "json");
  url.searchParams.set("hourly", "1");
  const startYear = params.startYear ?? 2018;
  const endYear = params.endYear ?? startYear;
  url.searchParams.set("startyear", String(startYear));
  url.searchParams.set("endyear", String(endYear));
  url.searchParams.set("pvcalculation", "1");
  url.searchParams.set("pvtechchoice", "crystSi");
  url.searchParams.set("raddatabase", "PVGIS-SARAH2");
  return { url: url.toString(), startYear, endYear };
}

type ExtractedHourly = {
  rows: PvgisRawHourlyRow[];
  source: "hourly" | "hourly_fixed" | "time_series";
};

function extractRawHourlyFromPvgisJson(data: unknown): ExtractedHourly {
  const outputs =
    typeof data === "object" && data !== null
      ? (data as { outputs?: Record<string, unknown> }).outputs
      : undefined;

  const hourly = outputs?.hourly ?? outputs?.hourly_fixed;
  if (Array.isArray(hourly)) {
    return {
      rows: hourly as PvgisRawHourlyRow[],
      source: outputs?.hourly ? "hourly" : "hourly_fixed",
    };
  }

  const timeSeries =
    typeof outputs?.time_series === "object" &&
    outputs.time_series !== null &&
    Array.isArray((outputs.time_series as { data?: unknown }).data)
      ? ((outputs.time_series as { data: PvgisRawHourlyRow[] }).data)
      : null;

  if (timeSeries) {
    if (
      timeSeries.some((row) => {
        const v = typeof row?.P === "number" ? row.P / 1000 : NaN;
        return !Number.isFinite(v);
      })
    ) {
      throw new Error("PVGIS hourly data contains invalid values");
    }
    if (
      timeSeries.some((row) => {
        const v = typeof row?.P === "number" ? row.P / 1000 : 0;
        return v < 0;
      })
    ) {
      throw new Error("PVGIS hourly data contains negative values");
    }
    return { rows: timeSeries, source: "time_series" };
  }

  throw new Error("PVGIS response does not contain usable hourly data");
}

async function fetchPvgisRawHourly(
  params: LoadPVGISParams
): Promise<ExtractedHourly> {
  const { url, startYear, endYear } = buildSeriescalcUrl(params);
  const timeoutMs = pvgisFetchTimeoutMs(startYear, endYear);
  const res = await fetchWithRetry(url, undefined, 3, timeoutMs);
  if (!res.ok) {
    throw new Error(`PVGIS request failed: ${res.status}`);
  }
  const data = await res.json();
  return extractRawHourlyFromPvgisJson(data);
}

/**
 * Load PVGIS hourly production with full timestamp + value format.
 * Intended for a single calendar year (`startyear` === `endyear`).
 * For multi-year ranges use {@link loadPVGISHourlyProfilesByYear}.
 */
export async function loadPVGISHourlyProduction(
  params: LoadPVGISParams
): Promise<LoadPVGISHourlyProductionResult> {
  const { rows, source } = await fetchPvgisRawHourly(params);

  if (source === "hourly" || source === "hourly_fixed") {
    // Leap/DST normalization happens inside align (Berlin Feb 29 skipped).
    const aligned = alignPvgisRowsToBerlinLocal8760(rows);
    if (aligned.length !== HOURS_PER_NON_LEAP_YEAR) {
      throw new Error(
        `PVGIS hourly length mismatch AFTER ALIGN: ${aligned.length}`
      );
    }
    return {
      hourly: aligned,
      meta: { count: aligned.length, source: "hourly" },
    };
  }

  const aligned = alignPvgisRowsToBerlinLocal8760(rows);
  if (aligned.length !== HOURS_PER_NON_LEAP_YEAR) {
    throw new Error(`PVGIS hourly length mismatch: ${aligned.length}`);
  }

  return {
    hourly: aligned,
    meta: { count: aligned.length, source: "time_series" },
  };
}

/**
 * Load PVGIS hourly profile as plain number[] (backward compatible).
 * Single-year path; for multi-year use {@link loadPVGISHourlyProfilesByYear}.
 */
export async function loadPVGISHourlyProfile(
  params: LoadPVGISParams
): Promise<number[]> {
  const { hourly } = await loadPVGISHourlyProduction(params);
  return hourly.map((r) => r.pvKWh);
}

/**
 * One PVGIS range request (`startyear`…`endyear`), then split by UTC year and
 * align each year onto the fixed Berlin 8760 grid.
 *
 * Returns `Record<year, number[]>` where each array has length 8760.
 */
export async function loadPVGISHourlyProfilesByYear(
  params: LoadPVGISParams
): Promise<Record<number, number[]>> {
  const { rows } = await fetchPvgisRawHourly(params);
  const byYear = alignMultiYearPvgisRowsByUtcYear(rows);

  const startYear = params.startYear ?? 2018;
  const endYear = params.endYear ?? startYear;
  for (let y = startYear; y <= endYear; y++) {
    const profile = byYear[y];
    if (!profile) {
      throw new Error(
        `PVGIS multi-year response missing year ${y} (requested ${startYear}–${endYear})`
      );
    }
    if (profile.length !== HOURS_PER_NON_LEAP_YEAR) {
      throw new Error(
        `PVGIS hourly length mismatch for year ${y}: ${profile.length}`
      );
    }
  }

  return byYear;
}
