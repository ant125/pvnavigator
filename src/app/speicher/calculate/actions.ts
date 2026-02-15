"use server";

import "server-only";
import fs from "fs";
import path from "path";
import {
  getVerifiedResult,
  setVerifiedResult,
  type VerifiedResult,
} from "./verifiedResultStore.server";

export type HouseholdCalculationPayload = {
  verifiedResult: VerifiedResult;
};

type HourlyRow = {
  kWh: number;
};

function loadBDEWH0HourlyProfile(): HourlyRow[] {
  const csvPath = path.join(
    process.cwd(),
    "src",
    "app",
    "speicher",
    "data",
    "processed",
    "bdew_h0_hourly_nonleap.csv"
  );
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n");
  const rows = lines.slice(1).map((line) => {
    const parts = line.split(",");
    const kWh = Number(parts[4]);
    return { kWh };
  });
  if (rows.length !== 8760) {
    throw new Error(`BDEW H0 profile row count mismatch: ${rows.length}`);
  }
  return rows;
}

async function loadPVGISHourlyProfile(params: {
  latitude: number;
  longitude: number;
  systemSizeKwP: number;
  tiltDeg: number;
  azimuthDeg: number;
}): Promise<number[]> {
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
    const pvKwh = hourly.map((row: { P?: number }) => {
      const watts = typeof row?.P === "number" ? row.P : 0;
      return watts / 1000;
    });
    if (pvKwh.length !== 8760) {
      throw new Error(`PVGIS hourly length mismatch: ${pvKwh.length}`);
    }
    return pvKwh;
  }

  const timeSeries = data?.outputs?.time_series?.data;
  if (Array.isArray(timeSeries)) {
    const mapped = timeSeries
      .map((row: { time?: string; P?: number }) => ({
        time: row?.time ?? "",
        kWh: (typeof row?.P === "number" ? row.P : 0) / 1000,
      }))
      .filter((row) => Number.isFinite(row.kWh));

    let filtered = mapped;
    if (mapped.length === 8784) {
      filtered = mapped.filter((row) => {
        if (!row.time) return true;
        const date = new Date(row.time);
        return !(date.getUTCMonth() === 1 && date.getUTCDate() === 29);
      });
    }

    if (filtered.length !== 8760) {
      throw new Error(`PVGIS hourly length mismatch: ${filtered.length}`);
    }

    if (filtered.some((row) => !Number.isFinite(row.kWh))) {
      throw new Error("PVGIS hourly data contains invalid values");
    }

    if (filtered.some((row) => row.kWh < 0)) {
      throw new Error("PVGIS hourly data contains negative values");
    }

    if (filtered[0].time) {
      filtered.sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
    }

    return filtered.map((row) => row.kWh);
  }

  console.error("PVGIS full response:", JSON.stringify(data, null, 2));
  throw new Error("PVGIS response does not contain usable hourly data");
}

export async function calculateHouseholdConsumptionAction(params: {
  annualConsumptionKWh: number;
  pvSystemKwP: number;
  latitude: number;
  longitude: number;
  tiltDeg: number;
  azimuthDeg: number;
}): Promise<HouseholdCalculationPayload> {
  const h0Profile = loadBDEWH0HourlyProfile();
  const scaleFactor = params.annualConsumptionKWh / 1_000_000;
  const loadKwh = h0Profile.map((row) => row.kWh * scaleFactor);
  const pvKwh = await loadPVGISHourlyProfile({
    latitude: params.latitude,
    longitude: params.longitude,
    systemSizeKwP: params.pvSystemKwP,
    tiltDeg: params.tiltDeg,
    azimuthDeg: params.azimuthDeg,
  });

  let selfConsumptionWithoutStorage = 0;
  for (let i = 0; i < 8760; i += 1) {
    selfConsumptionWithoutStorage += Math.min(pvKwh[i], loadKwh[i]);
  }

  const verifiedResult: VerifiedResult = {
    energy: {
      year: {
        selfConsumptionWithoutStorage,
      },
    },
  };

  return {
    verifiedResult: setVerifiedResult(verifiedResult),
  };
}
