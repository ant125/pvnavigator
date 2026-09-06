import { describe, expect, it } from "vitest";
import {
  evClock,
  evWindowBounded,
} from "@ev-profile/loader";
import { commuterEvInput } from "@/test/evFixtures";
import type { SpeicherInput } from "../types/speicher";
import {
  mapEvFormToCalculationInput,
  mapHomeWindowForm,
  parseEvClockTime,
  parseEvDecimalInput,
  parseEvIntegerInput,
  validateHomeWindowForm,
} from "./evForm";
import { validateInput } from "./validateInput";

const VALID_EV_FORM: Partial<SpeicherInput> = {
  evEnabled: true,
  evAnnualKm: 15000,
  evConsumptionKwhPer100Km: 18,
  evUsableBatteryCapacityKwh: 60,
  evTypicalDailyKmWd: 40,
  evTypicalDailyKmSa: 20,
  evTypicalDailyKmSu: 10,
  evMaxHomeChargePowerKw: 11,
  evHomeWindowWd: { start: "18:00", end: "07:00" },
  evHomeWindowSa: { start: "10:00", end: "16:00" },
  evHomeWindowSu: { start: "10:00", end: "20:00" },
  evWorkplaceEnabled: true,
  evWorkplaceKwhPerMonth: 80,
  evWorkplaceChargingDaysPerMonth: 8,
};

describe("EV numeric parsing", () => {
  it("parses digits and German decimals without units", () => {
    expect(parseEvIntegerInput("15000")).toBe(15000);
    expect(parseEvIntegerInput("")).toBeUndefined();
    expect(parseEvIntegerInput("15 000")).toBeNaN();
    expect(parseEvIntegerInput("15000 km")).toBeNaN();
    expect(parseEvDecimalInput("18")).toBe(18);
    expect(parseEvDecimalInput("18,5")).toBe(18.5);
    expect(parseEvDecimalInput("18 kWh")).toBeNaN();
  });
});

describe("EV home-window encoding", () => {
  it("accepts a same-day window", () => {
    const window = { start: "10:00", end: "20:00" };
    expect(validateHomeWindowForm(window)).toBe("ok");
    expect(mapHomeWindowForm(window)).toEqual(
      evWindowBounded(evClock(10, 0), evClock(20, 0))
    );
  });

  it("accepts an overnight window", () => {
    const window = { start: "17:30", end: "07:00" };
    expect(validateHomeWindowForm(window)).toBe("ok");
    expect(mapHomeWindowForm(window)).toEqual(
      evWindowBounded(evClock(17, 30), evClock(7, 0))
    );
  });

  it("does not accept leftover full-day form state", () => {
    expect(validateHomeWindowForm({ start: "", end: "" })).toBe("missing");
    expect(
      validateHomeWindowForm({
        start: "",
        end: "",
        fullDay: true,
      } as never)
    ).toBe("missing");
  });

  it("does not treat equal start/end as 24 hours", () => {
    const window = { start: "18:00", end: "18:00" };
    expect(validateHomeWindowForm(window)).toBe("invalid");
    expect(parseEvClockTime("18:00")).toEqual({ hour: 18, minute: 0 });
    expect(() => mapHomeWindowForm(window)).toThrow(/start and end must differ/);
  });

  it("rejects times off the 15-minute grid", () => {
    expect(
      validateHomeWindowForm({
        start: "17:10",
        end: "07:00",
      })
    ).toBe("invalid");
  });
});

describe("mapEvFormToCalculationInput", () => {
  it("sends enabled:false for legacy / Nein and does not require EV fields", () => {
    expect(mapEvFormToCalculationInput({})).toEqual({ enabled: false });
    expect(mapEvFormToCalculationInput({ evEnabled: false })).toEqual({
      enabled: false,
    });
  });

  it("maps a valid form into the exact EvCalculationInput shape", () => {
    const mapped = mapEvFormToCalculationInput(VALID_EV_FORM);
    expect(mapped).toEqual(commuterEvInput());
  });

  it("maps typicalDailyKm as WD/SA/SU numbers without unit strings", () => {
    const mapped = mapEvFormToCalculationInput(VALID_EV_FORM);
    expect(mapped).toMatchObject({
      enabled: true,
      typicalDailyKm: { WD: 40, SA: 20, SU: 10 },
    });
    if (mapped.enabled) {
      expect(typeof mapped.annualKm).toBe("number");
      expect(typeof mapped.consumptionKwhPer100Km).toBe("number");
      expect(typeof mapped.usableBatteryCapacityKwh).toBe("number");
    }
  });

  it("maps each allowed home-charging power exactly", () => {
    for (const kw of [2.3, 3.7, 7.4, 11, 22] as const) {
      const mapped = mapEvFormToCalculationInput({
        ...VALID_EV_FORM,
        evMaxHomeChargePowerKw: kw,
      });
      expect(mapped).toMatchObject({
        enabled: true,
        maxHomeChargePowerKw: kw,
      });
    }
  });

  it("maps a validated form into the payload runHouseholdCalculation expects", () => {
    const form: Partial<SpeicherInput> = {
      pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
      street: "Marienplatz",
      houseNumber: "1",
      postalCode: "80331",
      city: "München",
      annualConsumptionKwh: 4500,
      evEnabled: true,
      evAnnualKm: 15000,
      evConsumptionKwhPer100Km: 18,
      evUsableBatteryCapacityKwh: 60,
      evTypicalDailyKmWd: 40,
      evTypicalDailyKmSa: 20,
      evTypicalDailyKmSu: 10,
      evMaxHomeChargePowerKw: 11,
      evHomeWindowWd: { start: "18:00", end: "07:00" },
      evHomeWindowSa: { start: "10:00", end: "16:00" },
      evHomeWindowSu: { start: "10:00", end: "20:00" },
      evWorkplaceEnabled: true,
      evWorkplaceKwhPerMonth: 80,
      evWorkplaceChargingDaysPerMonth: 8,
    };
    expect(validateInput(form).isValid).toBe(true);
    expect(mapEvFormToCalculationInput(form)).toEqual(commuterEvInput());
  });

  it("maps workplace Nein without workplace energy fields", () => {
    const mapped = mapEvFormToCalculationInput({
      ...VALID_EV_FORM,
      evWorkplaceEnabled: false,
      evWorkplaceKwhPerMonth: undefined,
      evWorkplaceChargingDaysPerMonth: undefined,
    });
    expect(mapped).toMatchObject({
      enabled: true,
      workplace: { enabled: false },
    });
  });
});
