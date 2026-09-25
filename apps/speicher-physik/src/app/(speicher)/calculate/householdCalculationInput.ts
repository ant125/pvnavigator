import type { EvCalculationInput } from "@/load/resolveEvLoadComponent";
import type { SpeicherInput } from "../types/speicher";
import { mapEvFormToCalculationInput } from "../utils/evForm";
import { surfacesOrDefault, sumSurfaceKwP } from "./calculateFormModel";

export type HouseholdCalculationRequest = {
  annualConsumptionKWh: number;
  pvSystemKwP: number;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  tiltDeg: number;
  azimuthDeg: number;
  pvSurfaces: Array<{
    systemSizeKwP: number;
    tiltDeg: number;
    azimuthDeg: number;
  }>;
  heatPumpEnabled: boolean;
  heatPumpConsumptionKWh?: number;
  heatPumpTechnology?: SpeicherInput["heatPumpTechnology"];
  heatPumpDhwService?: SpeicherInput["heatPumpDhwService"];
  ev: EvCalculationInput;
  backupReserveKwh?: number;
};

/**
 * Maps the live form into the calculation request.
 * A disabled heat pump or EV drops its stored consumption so a later
 * recalculation does not keep the previous component.
 */
export function buildHouseholdCalculationInput(
  formData: Partial<SpeicherInput>
): HouseholdCalculationRequest {
  const pvSurfaces = surfacesOrDefault(formData).map((surface) => ({
    systemSizeKwP: surface.systemSizeKwP,
    tiltDeg: surface.tiltDeg,
    azimuthDeg: surface.azimuthDeg,
  }));
  const heatPumpEnabled = formData.heatPumpEnabled === true;

  return {
    annualConsumptionKWh: formData.annualConsumptionKwh as number,
    pvSystemKwP: sumSurfaceKwP(pvSurfaces),
    street: formData.street as string,
    houseNumber: formData.houseNumber as string,
    postalCode: formData.postalCode as string,
    city: formData.city as string,
    tiltDeg: pvSurfaces[0].tiltDeg,
    azimuthDeg: pvSurfaces[0].azimuthDeg,
    pvSurfaces,
    heatPumpEnabled,
    heatPumpConsumptionKWh: heatPumpEnabled
      ? formData.heatPumpConsumptionKwh
      : undefined,
    ...(heatPumpEnabled
      ? {
          heatPumpTechnology: formData.heatPumpTechnology,
          heatPumpDhwService: formData.heatPumpDhwService,
        }
      : {}),
    ev: mapEvFormToCalculationInput(formData),
    backupReserveKwh: formData.backupReserveKwh,
  };
}
