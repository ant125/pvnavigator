import { describe, expect, it } from "vitest";

import { patchForHeatPumpEnabled } from "./HeatPumpInputSection";
import { buildHouseholdCalculationInput } from "./householdCalculationInput";
import type { SpeicherInput } from "../types/speicher";

const WITH_HEAT_PUMP: Partial<SpeicherInput> = {
  annualConsumptionKwh: 4000,
  street: "Branderstraße",
  houseNumber: "44",
  postalCode: "86154",
  city: "Augsburg",
  pvSurfaces: [{ systemSizeKwP: 6, tiltDeg: 40, azimuthDeg: 180 }],
  heatPumpEnabled: true,
  heatPumpConsumptionKwh: 5000,
  heatPumpTechnology: "luftwasser",
  heatPumpDhwService: "space_heat_and_dhw",
  evEnabled: false,
  backupReserveKwh: 0,
};

describe("buildHouseholdCalculationInput", () => {
  it("drops stored heat-pump consumption after Nein", () => {
    const withHeatPump = buildHouseholdCalculationInput(WITH_HEAT_PUMP);
    expect(withHeatPump.heatPumpEnabled).toBe(true);
    expect(withHeatPump.heatPumpConsumptionKWh).toBe(5000);

    const edited = {
      ...WITH_HEAT_PUMP,
      ...patchForHeatPumpEnabled(false),
    };
    const withoutHeatPump = buildHouseholdCalculationInput(edited);

    expect(edited.heatPumpEnabled).toBe(false);
    expect(edited.heatPumpConsumptionKwh).toBeUndefined();
    expect(withoutHeatPump.heatPumpEnabled).toBe(false);
    expect(withoutHeatPump.heatPumpConsumptionKWh).toBeUndefined();
    expect(withoutHeatPump.heatPumpTechnology).toBeUndefined();
    expect(withoutHeatPump.heatPumpDhwService).toBeUndefined();
    expect(withoutHeatPump.annualConsumptionKWh).toBe(4000);
  });
});
