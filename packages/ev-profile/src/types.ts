export type EvDayType = "WD" | "SA" | "SU";

/**
 * Clock time on the 15-minute grid.
 * `hour === 24` is allowed only as an exclusive end (`minute === 0` → 24:00).
 */
export type EvClockTime = {
  hour: number;
  minute: number;
};

/**
 * Explicit home-availability encoding.
 * `start === end` is invalid and is never treated as 24 hours.
 */
export type EvHomeWindow =
  | { kind: "unavailable" }
  | { kind: "fullDay" }
  | { kind: "bounded"; start: EvClockTime; end: EvClockTime };

export type EvTypicalDailyKm = {
  WD: number;
  SA: number;
  SU: number;
};

export type EvHomeWindows = {
  WD: EvHomeWindow;
  SA: EvHomeWindow;
  SU: EvHomeWindow;
};

export type EvWorkplaceInput =
  | { enabled: false }
  | {
      enabled: true;
      kwhPerMonth: number;
      chargingDaysPerMonth: number;
    };

export type CreateEvProfileInput = {
  year: number;
  annualKm: number;
  consumptionKwhPer100Km: number;
  usableBatteryCapacityKwh: number;
  typicalDailyKm: EvTypicalDailyKm;
  maxHomeChargePowerKw: number;
  homeWindow: EvHomeWindows;
  workplace: EvWorkplaceInput;
};

export type EvDayCounts = {
  WD: number;
  SA: number;
  SU: number;
};

export type EvProfileMeta = {
  year: number;
  modelVersion: string;
  methodologySourceIds: readonly string[];
  calendarRemap: true;
  leapDayOmitted: boolean;
  timeStepHours: number;
  steps: number;
  annualKm: number;
  consumptionKwhPer100Km: number;
  usableBatteryCapacityKwh: number;
  maxHomeChargePowerKw: number;
  windows: EvHomeWindows;
  workplace: EvWorkplaceInput;
  annualDrivingDemandKwh: number;
  drivingServedKwh: number;
  drivingUnservedKwh: number;
  workplaceDeclaredKwh: number;
  workplaceAcceptedKwh: number;
  workplaceRejectedKwh: number;
  homeChargedKwh: number;
  annualHomeWindowCapacityKwh: number;
  energyStartKwh: number;
  energyEndKwh: number;
  impliedAnnualKmFromTypicalDistances: number;
  normalizationFactor: number | null;
  impliedAnnualKmFromYearCalendar: number;
  yearNormalizationFactor: number | null;
  dayCounts: EvDayCounts;
  solverPasses: number;
};

export type EvProfile15MinResult = {
  /** Home-charging interval energy only. Length 35 040. */
  profile: number[];
  meta: EvProfileMeta;
};

export type EvIssueKind = "invalid_input" | "infeasible";

export type EvIssueSeverity = "error" | "infeasible" | "notable";

export type EvErrorCode =
  | "INVALID_YEAR"
  | "INVALID_ANNUAL_KM"
  | "INVALID_TYPICAL_KM"
  | "INVALID_CONSUMPTION"
  | "INVALID_CAPACITY"
  | "INVALID_CHARGE_POWER"
  | "MISSING_TEMPORAL_SHAPE"
  | "INVALID_WINDOW"
  | "WORKPLACE_MISSING_FIELDS"
  | "WORKPLACE_INVALID_DAYS"
  | "WORKPLACE_INVALID_ENERGY"
  | "WORKPLACE_DAYS_EXCEED_WEEKDAYS"
  | "DRIVING_UNSERVED"
  | "VEHICLE_ENERGY_OUT_OF_BOUNDS"
  | "HOME_CHARGE_OUTSIDE_WINDOW"
  | "HOME_CHARGE_EXCEEDS_POWER"
  | "CONSERVATION_BROKEN"
  | "SOLVER_NO_CONVERGENCE"
  | "NON_FINITE_PROFILE";

export type EvNotableCode =
  | "WORKPLACE_EXCEEDS_DRIVING"
  | "WORKPLACE_REJECTED"
  | "ZERO_HOME_CHARGING"
  | "MILEAGE_NORMALIZED";

export type EvIssue = {
  code: EvErrorCode | EvNotableCode;
  severity: EvIssueSeverity;
  message: string;
  details?: Record<string, unknown>;
};

export type EvPreflightResult =
  | { ok: true; notables: EvIssue[] }
  | { ok: false; kind: EvIssueKind; issues: EvIssue[] };

export type EvModelDay = {
  year: number;
  month: number;
  day: number;
  dayType: EvDayType;
  dayIndex: number;
};

export type EvWorkplaceEvent = {
  dayIndex: number;
  month: number;
  day: number;
  offerKwh: number;
};

export type EvAvailability = {
  /** Length 35 040. True when home charging is allowed. */
  mask: boolean[];
  /** Per civil day: slot index (0–95) at which drive → workplace is applied. */
  eventBoundarySlot: number[];
};

export type EvYearPass = {
  profile: number[];
  energyStartKwh: number;
  energyEndKwh: number;
  drivingServedKwh: number;
  drivingUnservedKwh: number;
  workplaceAcceptedKwh: number;
  workplaceRejectedKwh: number;
  homeChargedKwh: number;
  minEnergyKwh: number;
  maxEnergyKwh: number;
};

export type EvSolverGuards = {
  initialEnergyKwh: number;
  maxPasses: number;
  energyAbsTolKwh: number;
};
