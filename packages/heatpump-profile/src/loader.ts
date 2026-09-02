import heatingAndDhwJson from "../data/luftwasser/lw-heating-dhw-thermbuild-n2-v1.json";
import heatingOnlyJson from "../data/luftwasser/lw-heating-only-thermbuild-o5-v1.json";
import wasserWasserHeatingAndDhwJson from "../data/wasserwasser/ww-heating-dhw-wpuq-2019-sfh38-v1.json";
import type { HeatPumpCatalogueEntry, HeatPumpProfileEnvelope } from "./types";
import {
  HEAT_PUMP_ENVELOPE_SCHEMA_VERSION,
  HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR,
  HEAT_PUMP_TIME_STEP_HOURS,
} from "./types";

const WEIGHT_SUM_TOLERANCE = 1e-12;
const SEASONAL_SHARE_SUM_TOLERANCE = 1e-5;
const SEASONAL_SHARE_KEYS = ["winter", "spring", "summer", "autumn"] as const;

/**
 * Immutable production envelopes, keyed by catalogue profileId.
 *
 * Static imports keep the module serverless-safe (no `fs`). Only default
 * catalogue assets are bundled. The loader never selects and never scales.
 */
const PRODUCTION_ASSETS: Readonly<Record<string, HeatPumpProfileEnvelope>> = {
  "lw-heating-only-thermbuild-o5-v1":
    heatingOnlyJson as HeatPumpProfileEnvelope,
  "lw-heating-dhw-thermbuild-n2-v1":
    heatingAndDhwJson as HeatPumpProfileEnvelope,
  "ww-heating-dhw-wpuq-2019-sfh38-v1":
    wasserWasserHeatingAndDhwJson as HeatPumpProfileEnvelope,
};

/**
 * Load the immutable production envelope for a resolved catalogue row.
 * Weights remain unit-normalised. Callers that need user kWh must scale.
 */
export function loadHeatPumpProfile(
  entry: HeatPumpCatalogueEntry
): HeatPumpProfileEnvelope {
  const envelope = PRODUCTION_ASSETS[entry.profileId];
  if (!envelope) {
    throw new Error(
      `No production asset bundled for heat-pump profileId ${entry.profileId}`
    );
  }
  assertEnvelopeMatchesCatalogue(envelope, entry);
  return envelope;
}

function assertEnvelopeMatchesCatalogue(
  envelope: HeatPumpProfileEnvelope,
  entry: HeatPumpCatalogueEntry
): void {
  if (envelope.schemaVersion !== HEAT_PUMP_ENVELOPE_SCHEMA_VERSION) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: unsupported schemaVersion ${envelope.schemaVersion}`
    );
  }
  if (envelope.profileId !== entry.profileId) {
    throw new Error(
      `heat-pump envelope profileId ${envelope.profileId} != catalogue ${entry.profileId}`
    );
  }
  if (envelope.technology !== entry.technology) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: technology ${envelope.technology} != catalogue ${entry.technology}`
    );
  }
  if (envelope.dhwService !== entry.dhwService) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: dhwService ${envelope.dhwService} != catalogue ${entry.dhwService}`
    );
  }
  if (envelope.quality !== entry.quality) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: quality ${envelope.quality} != catalogue ${entry.quality}`
    );
  }
  if (envelope.methodologySourceId !== entry.methodologySourceId) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: methodologySourceId mismatch`
    );
  }
  if (envelope.license !== entry.license) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: license ${envelope.license} != catalogue ${entry.license}`
    );
  }
  if (envelope.timeStepHours !== HEAT_PUMP_TIME_STEP_HOURS) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: timeStepHours ${envelope.timeStepHours}`
    );
  }
  if (envelope.steps !== HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: steps ${envelope.steps}`
    );
  }

  const weights = envelope.weights;
  if (!Array.isArray(weights) || weights.length !== HEAT_PUMP_STEPS_PER_NON_LEAP_YEAR) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: weights length ${weights?.length}`
    );
  }

  let weightSum = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(
        `heat-pump envelope ${entry.profileId}: invalid weight at index ${i}`
      );
    }
    weightSum += w;
  }
  if (!(weightSum > 0) || !Number.isFinite(weightSum)) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: weight sum is not a positive finite number`
    );
  }
  if (Math.abs(weightSum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: sum(weights)=${weightSum}, expected 1`
    );
  }
  if (
    !Number.isFinite(envelope.measuredAnnualElectricalKwh) ||
    envelope.measuredAnnualElectricalKwh <= 0
  ) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: measuredAnnualElectricalKwh is invalid`
    );
  }

  if (
    typeof envelope.calendarAlignment !== "string" ||
    envelope.calendarAlignment.trim() === ""
  ) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: calendarAlignment is missing`
    );
  }

  const shares = envelope.seasonalShares;
  if (!shares || typeof shares !== "object") {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: seasonalShares is missing`
    );
  }
  let shareSum = 0;
  for (const key of SEASONAL_SHARE_KEYS) {
    const value = shares[key];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(
        `heat-pump envelope ${entry.profileId}: seasonalShares.${key} is invalid`
      );
    }
    shareSum += value;
  }
  if (Math.abs(shareSum - 1) > SEASONAL_SHARE_SUM_TOLERANCE) {
    throw new Error(
      `heat-pump envelope ${entry.profileId}: seasonalShares sum=${shareSum}, expected 1`
    );
  }
}
