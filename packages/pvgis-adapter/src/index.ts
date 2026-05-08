/**
 * PVGIS Adapter – loads hourly PV production (8760h) from PVGIS API.
 * Server-only: fetch, no client usage.
 * Handles hourly, hourly_fixed, time_series.data. Leap-year: filters Feb 29.
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

function realignPvToBerlinLocal8760(
  raw: ReadonlyArray<{ time?: string; P?: number }>,
  anchorYear: number = 2018
): { ts: string; pvKWh: number }[] {
  const result = new Array<number>(8760).fill(0);
  const tsArr: string[] = new Array(8760);

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const watts = typeof row?.P === "number" ? row.P : 0;
    const pvKwh = watts / 1000;

    const timeStr = row?.time;
    if (!timeStr) continue;

    // YYYYMMDD:HHMM
    const year = Number(timeStr.slice(0, 4));
    const month = Number(timeStr.slice(4, 6)) - 1;
    const day = Number(timeStr.slice(6, 8));
    const hour = Number(timeStr.slice(9, 11));
    const minute = Number(timeStr.slice(11, 13));

    const utcMs = Date.UTC(year, month, day, hour, minute);

    // convert to Berlin
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

    const y = get("year");
    const m = get("month") - 1;
    const d = get("day");
    const h = get("hour");

    // индекс зависит только от дня года и часа (год не учитывается)
    const dayOfYear = Math.floor(
      (Date.UTC(2018, m, d) - Date.UTC(2018, 0, 1)) / (1000 * 60 * 60 * 24)
    );
    const idx = dayOfYear * 24 + h;

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
 * Load PVGIS hourly production with full timestamp + value format.
 */
export async function loadPVGISHourlyProduction(
  params: LoadPVGISParams
): Promise<LoadPVGISHourlyProductionResult> {
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

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`PVGIS request failed: ${res.status}`);
  }
  const data = await res.json();

  console.log("[PVGIS DEBUG] keys present:", {
    hourly: Array.isArray(data?.outputs?.hourly),
    hourly_fixed: Array.isArray(data?.outputs?.hourly_fixed),
    time_series: Array.isArray(data?.outputs?.time_series?.data),
  });

  const branch = Array.isArray(data?.outputs?.hourly)
    ? "hourly"
    : Array.isArray(data?.outputs?.hourly_fixed)
      ? "hourly_fixed"
      : Array.isArray(data?.outputs?.time_series?.data)
        ? "time_series"
        : "none";

  const arr =
    data?.outputs?.hourly ??
    data?.outputs?.hourly_fixed ??
    data?.outputs?.time_series?.data ??
    [];

  console.log("[PVGIS DEBUG] branch:", branch);
  console.log("[PVGIS DEBUG] length:", arr.length);
  console.log(
    "[PVGIS DEBUG] first 5 time:",
    arr.slice(0, 5).map((r: { time?: string }) => r?.time)
  );

  let hourly = data?.outputs?.hourly ?? data?.outputs?.hourly_fixed;

  if (Array.isArray(hourly)) {
    hourly = hourly.filter((row: { time?: string }) => {
      if (!row?.time) return true;
      const month = Number(row.time.slice(4, 6));
      const day = Number(row.time.slice(6, 8));
      return !(month === 2 && day === 29);
    });

    if (hourly.length !== 8760) {
      throw new Error(
        `PVGIS hourly length mismatch AFTER FILTER: ${hourly.length}`
      );
    }

    const rows = realignPvToBerlinLocal8760(hourly);

    return { hourly: rows, meta: { count: rows.length, source: "hourly" } };
  }

  const timeSeries = data?.outputs?.time_series?.data;
  if (Array.isArray(timeSeries)) {
    let mappedRaw: ReadonlyArray<{ time?: string; P?: number }> = timeSeries;

    if (mappedRaw.length === 8784) {
      mappedRaw = mappedRaw.filter((row) => {
        if (!row?.time) return true;
        const month = Number(row.time.slice(4, 6));
        const day = Number(row.time.slice(6, 8));
        return !(month === 2 && day === 29);
      });
    }

    if (mappedRaw.length !== 8760) {
      throw new Error(`PVGIS hourly length mismatch: ${mappedRaw.length}`);
    }

    if (
      mappedRaw.some((row) => {
        const v = typeof row?.P === "number" ? row.P / 1000 : NaN;
        return !Number.isFinite(v);
      })
    ) {
      throw new Error("PVGIS hourly data contains invalid values");
    }
    if (
      mappedRaw.some((row) => {
        const v = typeof row?.P === "number" ? row.P / 1000 : 0;
        return v < 0;
      })
    ) {
      throw new Error("PVGIS hourly data contains negative values");
    }

    const rows = realignPvToBerlinLocal8760(mappedRaw, startYear);

    return {
      hourly: rows,
      meta: { count: rows.length, source: "time_series" },
    };
  }

  throw new Error("PVGIS response does not contain usable hourly data");
}

/**
 * Load PVGIS hourly profile as plain number[] (backward compatible).
 */
export async function loadPVGISHourlyProfile(
  params: LoadPVGISParams
): Promise<number[]> {
  const { hourly } = await loadPVGISHourlyProduction(params);
  return hourly.map((r) => r.pvKWh);
}
