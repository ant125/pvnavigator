import { EV_ENERGY_ABS_TOL_KWH } from "./constants";
import { createEvProfile } from "./createEvProfile";
import { EvProfileError } from "./errors";
import { nearlyEqual } from "./numeric";
import { validateEvProfileInput } from "./validate";
import { buildEvModelDays } from "./calendar";
import { materializeHomeAvailability } from "./windows";
import { placeWorkplaceEvents } from "./workplace";
import type {
  CreateEvProfileInput,
  EvIssue,
  EvPreflightResult,
} from "./types";

function issueFromError(error: EvProfileError): EvIssue {
  return {
    code: error.code,
    severity: error.kind === "infeasible" ? "infeasible" : "error",
    message: error.message,
    details: error.details,
  };
}

/**
 * Non-throwing preflight. Distinguishes invalid input, physical
 * infeasibility, and notable-but-valid results. Does not embed UI copy.
 */
export function preflightEvProfile(
  input: CreateEvProfileInput
): EvPreflightResult {
  try {
    validateEvProfileInput(input);
    const days = buildEvModelDays(input.year);
    materializeHomeAvailability(days, input.homeWindow);
    placeWorkplaceEvents(days, input.workplace);
  } catch (error) {
    if (error instanceof EvProfileError) {
      return {
        ok: false,
        kind: error.kind,
        issues: [issueFromError(error)],
      };
    }
    throw error;
  }

  try {
    const result = createEvProfile(input);
    const notables: EvIssue[] = [];
    if (
      result.meta.workplaceDeclaredKwh >= result.meta.annualDrivingDemandKwh &&
      result.meta.workplace.enabled
    ) {
      notables.push({
        code: "WORKPLACE_EXCEEDS_DRIVING",
        severity: "notable",
        message:
          "workplace declared energy is at least the annual driving demand",
      });
    }
    if (result.meta.workplaceRejectedKwh > EV_ENERGY_ABS_TOL_KWH) {
      notables.push({
        code: "WORKPLACE_REJECTED",
        severity: "notable",
        message: "some workplace energy was rejected because the vehicle was full",
        details: { workplaceRejectedKwh: result.meta.workplaceRejectedKwh },
      });
    }
    if (nearlyEqual(result.meta.homeChargedKwh, 0)) {
      notables.push({
        code: "ZERO_HOME_CHARGING",
        severity: "notable",
        message: "annual home EV charging is zero",
      });
    }
    if (
      result.meta.normalizationFactor != null &&
      !nearlyEqual(result.meta.normalizationFactor, 1)
    ) {
      notables.push({
        code: "MILEAGE_NORMALIZED",
        severity: "notable",
        message:
          "typical distances were scaled so annual km remain authoritative",
        details: { normalizationFactor: result.meta.normalizationFactor },
      });
    }
    return { ok: true, notables };
  } catch (error) {
    if (error instanceof EvProfileError) {
      return {
        ok: false,
        kind: error.kind,
        issues: [issueFromError(error)],
      };
    }
    throw error;
  }
}
