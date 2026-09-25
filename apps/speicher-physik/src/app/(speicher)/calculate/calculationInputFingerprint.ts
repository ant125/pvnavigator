import type { SpeicherInput } from "../types/speicher";
import { mapEvFormToCalculationInput } from "../utils/evForm";
import { surfacesOrDefault, sumSurfaceKwP } from "./calculateFormModel";

function finiteOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * Canonical snapshot of calculation-relevant inputs.
 * Compares parsed values, not raw text buffers, so "10,0" and "10" match.
 */
export function calculationInputFingerprint(
  form: Partial<SpeicherInput>
): string {
  const surfaces = surfacesOrDefault(form).map((surface) => ({
    systemSizeKwP: finiteOrNull(surface.systemSizeKwP),
    tiltDeg: finiteOrNull(surface.tiltDeg),
    azimuthDeg: finiteOrNull(surface.azimuthDeg),
  }));

  const heatPumpEnabled = form.heatPumpEnabled === true;
  let ev: unknown = { enabled: false };
  try {
    ev = mapEvFormToCalculationInput(form);
  } catch {
    ev = {
      enabled: form.evEnabled === true,
      incomplete: true,
      annualKm: finiteOrNull(form.evAnnualKm),
      consumptionKwhPer100Km: finiteOrNull(form.evConsumptionKwhPer100Km),
      usableBatteryCapacityKwh: finiteOrNull(form.evUsableBatteryCapacityKwh),
      typicalDailyKmWd: finiteOrNull(form.evTypicalDailyKmWd),
      typicalDailyKmSa: finiteOrNull(form.evTypicalDailyKmSa),
      typicalDailyKmSu: finiteOrNull(form.evTypicalDailyKmSu),
      maxHomeChargePowerKw: finiteOrNull(form.evMaxHomeChargePowerKw),
      homeWindowWd: form.evHomeWindowWd ?? null,
      homeWindowSa: form.evHomeWindowSa ?? null,
      homeWindowSu: form.evHomeWindowSu ?? null,
      workplaceEnabled: form.evWorkplaceEnabled ?? null,
      workplaceKwhPerMonth: finiteOrNull(form.evWorkplaceKwhPerMonth),
      workplaceChargingDaysPerMonth: finiteOrNull(
        form.evWorkplaceChargingDaysPerMonth
      ),
    };
  }

  return JSON.stringify({
    surfaces,
    pvSystemKwP: sumSurfaceKwP(surfacesOrDefault(form)) || null,
    street: trimOrEmpty(form.street),
    houseNumber: trimOrEmpty(form.houseNumber),
    postalCode: trimOrEmpty(form.postalCode),
    city: trimOrEmpty(form.city),
    annualConsumptionKwh: finiteOrNull(form.annualConsumptionKwh),
    heatPumpEnabled,
    heatPumpTechnology: heatPumpEnabled ? form.heatPumpTechnology ?? null : null,
    heatPumpDhwService: heatPumpEnabled ? form.heatPumpDhwService ?? null : null,
    heatPumpConsumptionKwh: heatPumpEnabled
      ? finiteOrNull(form.heatPumpConsumptionKwh)
      : null,
    ev,
    backupReserveKwh: finiteOrNull(form.backupReserveKwh) ?? 0,
  });
}

export function calculationInputsAreStale(
  current: Partial<SpeicherInput>,
  calculatedFingerprint: string | null
): boolean {
  if (!calculatedFingerprint) return false;
  return calculationInputFingerprint(current) !== calculatedFingerprint;
}
