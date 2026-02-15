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
  url.searchParams.set("startyear", "2018");
  url.searchParams.set("endyear", "2018");
  url.searchParams.set("pvcalculation", "1");
  url.searchParams.set("pvtechchoice", "crystSi");
  url.searchParams.set("raddatabase", "PVGIS-SARAH2");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`PVGIS request failed: ${res.status}`);
  }
  const data = await res.json();
  const hourly = data?.outputs?.hourly ?? data?.outputs?.hourly_fixed;

  if (Array.isArray(hourly)) {
    const rows: PVGISHourlyRow[] = hourly.map(
      (row: { time?: string; P?: number }, i: number) => {
        const watts = typeof row?.P === "number" ? row.P : 0;
        const ts =
          row?.time ?? `2018-01-01T${String(Math.floor(i / 24)).padStart(2, "0")}:${String(i % 24).padStart(2, "0")}:00Z`;
        return { ts, pvKWh: watts / 1000 };
      }
    );
    if (rows.length !== 8760) {
      throw new Error(`PVGIS hourly length mismatch: ${rows.length}`);
    }
    return { hourly: rows, meta: { count: rows.length, source: "hourly" } };
  }

  const timeSeries = data?.outputs?.time_series?.data;
  if (Array.isArray(timeSeries)) {
    let mapped = timeSeries.map((row: { time?: string; P?: number }) => ({
      ts: row?.time ?? "",
      pvKWh: (typeof row?.P === "number" ? row.P : 0) / 1000,
    }));

    if (mapped.length === 8784) {
      mapped = mapped.filter((row) => {
        if (!row.ts) return true;
        const date = new Date(row.ts);
        return !(date.getUTCMonth() === 1 && date.getUTCDate() === 29);
      });
    }

    if (mapped.length !== 8760) {
      throw new Error(`PVGIS hourly length mismatch: ${mapped.length}`);
    }

    if (mapped.some((row) => !Number.isFinite(row.pvKWh))) {
      throw new Error("PVGIS hourly data contains invalid values");
    }
    if (mapped.some((row) => row.pvKWh < 0)) {
      throw new Error("PVGIS hourly data contains negative values");
    }

    if (mapped[0]?.ts) {
      mapped.sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
      );
    }

    return {
      hourly: mapped,
      meta: { count: mapped.length, source: "time_series" },
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
