import { isPvNavigatorUuid } from "@pv-auth/session";

import type { VerifiedResult } from "@/app/(speicher)/calculate/verifiedResultStore.server";
import type { PvSurfaceInput } from "@/app/(speicher)/types/speicher";
import type { SpeicherGrenzPayload } from "@/lib/calculateSpeicherResult";
import type { WpuqRobustnessPayload } from "@/lib/wpuqRobustnessStats";
import type { WwRobustnessPayload } from "@/lib/wpuqWwRobustnessStats";
import type { EvCalculationMeta } from "@/load/resolveEvLoadComponent";
import type { HeatPumpCalculationMeta } from "@/load/resolveHeatPumpLoadComponent";
import type { ReportHeatPumpCitation } from "@/lib/reportMethodologySources";
import type { FrozenSpeicherPresentation } from "@/lib/persistCompletedCalculation";
import {
  SPEICHER_GRENZE_PRODUCT_KEY,
  SPEICHER_GRENZE_RESULT_SCHEMA_VERSION,
  SPEICHER_GRENZE_RESULT_SCHEMA_VERSION_V1,
} from "@/lib/persistCompletedCalculation";

export type HistoricalSpeicherReportInput = {
  surfaces: PvSurfaceInput[];
  annualConsumptionKwh: number | undefined;
  heatPumpEnabled: boolean | undefined;
  heatPumpConsumptionKwh: number | undefined;
  heatPumpTechnology: "luftwasser" | "wasserwasser" | undefined;
  heatPumpDhwService: "space_heat_only" | "space_heat_and_dhw" | undefined;
  evEnabled: boolean;
  backupReserveKwh: number | undefined;
  totalKwPConfigured: number;
};

export type HistoricalSpeicherReport = {
  id: string;
  createdAt: string;
  batteryModelVersion: string | null;
  resultSchemaVersion: string;
  inputSchemaVersion: string | null;
  displayAddress: string | null;
  verifiedResult: VerifiedResult;
  speicherGrenz: SpeicherGrenzPayload;
  robustness: WpuqRobustnessPayload | null;
  wasserWasserRobustness: WwRobustnessPayload | null;
  ev: EvCalculationMeta | null;
  heatPump: HeatPumpCalculationMeta | null;
  heatPumpCitation: ReportHeatPumpCitation;
  input: HistoricalSpeicherReportInput;
  presentationOverride: FrozenSpeicherPresentation | null;
};

export type HistoricalSpeicherReportOutcome =
  | { status: "ok"; report: HistoricalSpeicherReport }
  | { status: "not_found" }
  | {
      status: "incompatible";
      createdAt: string | null;
      batteryModelVersion: string | null;
      resultSchemaVersion: string | null;
      inputSchemaVersion: string | null;
    };

export type CalculationHistoryRow = {
  id: string;
  product_key: string;
  input: unknown;
  result_snapshot: unknown;
  input_schema_version: string | null;
  result_schema_version: string | null;
  battery_model_version: string | null;
  created_at: string;
};

export const HISTORICAL_SPEICHER_REPORT_SELECT =
  "id, product_key, input, result_snapshot, input_schema_version, result_schema_version, battery_model_version, created_at";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function incompatibleFromRow(
  row: CalculationHistoryRow,
): Extract<HistoricalSpeicherReportOutcome, { status: "incompatible" }> {
  return {
    status: "incompatible",
    createdAt: row.created_at ?? null,
    batteryModelVersion: row.battery_model_version,
    resultSchemaVersion: row.result_schema_version,
    inputSchemaVersion: row.input_schema_version,
  };
}

function parseSurface(value: unknown): PvSurfaceInput | null {
  if (!isRecord(value)) return null;
  const systemSizeKwP = asFiniteNumber(value.systemSizeKwP);
  const tiltDeg = asFiniteNumber(value.tiltDeg);
  const azimuthDeg = asFiniteNumber(value.azimuthDeg);
  if (
    systemSizeKwP === undefined ||
    tiltDeg === undefined ||
    azimuthDeg === undefined
  ) {
    return null;
  }
  return { systemSizeKwP, tiltDeg, azimuthDeg };
}

function parseSurfaces(
  input: Record<string, unknown>,
  totalKwPConfigured: number,
): PvSurfaceInput[] {
  if (Array.isArray(input.pvSurfaces) && input.pvSurfaces.length > 0) {
    const parsed = input.pvSurfaces
      .map(parseSurface)
      .filter((row): row is PvSurfaceInput => row !== null);
    if (parsed.length > 0) return parsed;
  }
  const tiltDeg = asFiniteNumber(input.tiltDeg) ?? 30;
  const azimuthDeg = asFiniteNumber(input.azimuthDeg) ?? 180;
  return [
    {
      systemSizeKwP: totalKwPConfigured,
      tiltDeg,
      azimuthDeg,
    },
  ];
}

function parseHeatPumpTechnology(
  value: unknown,
): "luftwasser" | "wasserwasser" | undefined {
  if (value === "luftwasser" || value === "wasserwasser") return value;
  return undefined;
}

function parseHeatPumpDhwService(
  value: unknown,
): "space_heat_only" | "space_heat_and_dhw" | undefined {
  if (value === "space_heat_only" || value === "space_heat_and_dhw") {
    return value;
  }
  return undefined;
}

function parsePresentation(
  snapshot: Record<string, unknown>,
): FrozenSpeicherPresentation | null {
  if (!isRecord(snapshot.presentation)) return null;
  const recommendedTechnicalSize = asFiniteNumber(
    snapshot.presentation.recommendedTechnicalSize,
  );
  const recommendedPlanningSize = asFiniteNumber(
    snapshot.presentation.recommendedPlanningSize,
  );
  if (
    recommendedTechnicalSize === undefined ||
    recommendedPlanningSize === undefined
  ) {
    return null;
  }
  return { recommendedTechnicalSize, recommendedPlanningSize };
}

function parseVerifiedResult(value: unknown): VerifiedResult | null {
  if (!isRecord(value) || !isRecord(value.energy) || !isRecord(value.energy.year)) {
    return null;
  }
  const selfConsumptionWithoutStorage = asFiniteNumber(
    value.energy.year.selfConsumptionWithoutStorage,
  );
  const pvYieldKwhAnnual = asFiniteNumber(value.energy.year.pvYieldKwhAnnual);
  const batteryModelVersion = asString(value.batteryModelVersion);
  if (
    selfConsumptionWithoutStorage === undefined ||
    pvYieldKwhAnnual === undefined ||
    !batteryModelVersion
  ) {
    return null;
  }
  const backupReserveKwh = asFiniteNumber(value.backupReserveKwh);
  return {
    energy: {
      year: { selfConsumptionWithoutStorage, pvYieldKwhAnnual },
    },
    batteryModelVersion,
    ...(backupReserveKwh !== undefined ? { backupReserveKwh } : {}),
  };
}

export function resolveHistoricalSpeicherReport(args: {
  requestedId: string;
  row: CalculationHistoryRow | null;
}): HistoricalSpeicherReportOutcome {
  if (!isPvNavigatorUuid(args.requestedId)) {
    return { status: "not_found" };
  }
  const row = args.row;
  if (!row) return { status: "not_found" };
  if (row.product_key !== SPEICHER_GRENZE_PRODUCT_KEY) {
    return { status: "not_found" };
  }
  return parseHistoricalSpeicherReport(row);
}

export function parseHistoricalSpeicherReport(
  row: CalculationHistoryRow,
): HistoricalSpeicherReportOutcome {
  const version = row.result_schema_version?.trim() ?? "";
  if (
    version !== SPEICHER_GRENZE_RESULT_SCHEMA_VERSION_V1 &&
    version !== SPEICHER_GRENZE_RESULT_SCHEMA_VERSION
  ) {
    return incompatibleFromRow(row);
  }

  if (!isRecord(row.input) || !isRecord(row.result_snapshot)) {
    return incompatibleFromRow(row);
  }

  const verifiedResult = parseVerifiedResult(row.result_snapshot.verifiedResult);
  const speicherGrenz = row.result_snapshot.speicherGrenz;
  if (!verifiedResult || !isRecord(speicherGrenz)) {
    return incompatibleFromRow(row);
  }

  const totalKwPConfigured =
    asFiniteNumber(row.input.pvSystemKwP) ??
    (Array.isArray(row.input.pvSurfaces)
      ? row.input.pvSurfaces.reduce((sum: number, surface) => {
          const parsed = parseSurface(surface);
          return parsed ? sum + parsed.systemSizeKwP : sum;
        }, 0)
      : 0);

  const displayAddress =
    asString(row.result_snapshot.displayAddress)?.trim() ||
    asString(row.input.displayAddress)?.trim() ||
    null;

  const evEnabled =
    isRecord(row.input.ev) && row.input.ev.enabled === true;

  const presentationOverride =
    version === SPEICHER_GRENZE_RESULT_SCHEMA_VERSION
      ? parsePresentation(row.result_snapshot)
      : null;

  const heatPump = isRecord(row.result_snapshot.heatPump)
    ? (row.result_snapshot.heatPump as HeatPumpCalculationMeta)
    : null;
  const ev = isRecord(row.result_snapshot.ev)
    ? (row.result_snapshot.ev as EvCalculationMeta)
    : null;

  return {
    status: "ok",
    report: {
      id: row.id,
      createdAt: row.created_at,
      batteryModelVersion: row.battery_model_version,
      resultSchemaVersion: version,
      inputSchemaVersion: row.input_schema_version,
      displayAddress,
      verifiedResult,
      speicherGrenz: speicherGrenz as unknown as SpeicherGrenzPayload,
      robustness: isRecord(row.result_snapshot.robustness)
        ? (row.result_snapshot.robustness as unknown as WpuqRobustnessPayload)
        : null,
      wasserWasserRobustness: isRecord(
        row.result_snapshot.wasserWasserRobustness,
      )
        ? (row.result_snapshot.wasserWasserRobustness as unknown as WwRobustnessPayload)
        : null,
      ev,
      heatPump,
      heatPumpCitation: heatPump
        ? { methodologySourceId: heatPump.methodologySourceId ?? null }
        : null,
      input: {
        surfaces: parseSurfaces(row.input, totalKwPConfigured),
        annualConsumptionKwh: asFiniteNumber(row.input.annualConsumptionKWh),
        heatPumpEnabled: row.input.heatPumpEnabled === true,
        heatPumpConsumptionKwh: asFiniteNumber(
          row.input.heatPumpConsumptionKWh,
        ),
        heatPumpTechnology: parseHeatPumpTechnology(
          row.input.heatPumpTechnology,
        ),
        heatPumpDhwService: parseHeatPumpDhwService(
          row.input.heatPumpDhwService,
        ),
        evEnabled,
        backupReserveKwh: asFiniteNumber(row.input.backupReserveKwh),
        totalKwPConfigured,
      },
      presentationOverride,
    },
  };
}
