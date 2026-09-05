import { describe, expect, it } from "vitest";
import {
  evWindowBounded,
  evWindowFullDay,
  evClock,
} from "@ev-profile/loader";
import { commuterEvInput } from "@/test/evFixtures";
import {
  buildEvCalculationMeta,
  resolveEvLoadComponentForYear,
} from "@/load/resolveEvLoadComponent";
import {
  deriveEvReportView,
  formatEvChargePowerKw,
  formatEvHomeWindow,
} from "./evReportPresentation";

describe("EV window/power formatting", () => {
  it("formats overnight, full-day, and German charge-power labels", () => {
    expect(
      formatEvHomeWindow(evWindowBounded(evClock(18, 0), evClock(7, 0)))
    ).toBe("18:00–07:00");
    expect(formatEvHomeWindow(evWindowFullDay())).toBe("Ganztägig verfügbar");
    expect(formatEvChargePowerKw(2.3)).toBe("2,3 kW");
    expect(formatEvChargePowerKw(11)).toBe("11 kW");
  });
});

describe("deriveEvReportView", () => {
  it("shows the calculation inputs and multi-year derived energy", () => {
    const evInput = commuterEvInput();
    const y2018 = resolveEvLoadComponentForYear({ evInput, year: 2018 });
    const y2019 = resolveEvLoadComponentForYear({ evInput, year: 2019 });
    const ev = buildEvCalculationMeta(
      { 2018: y2018.meta, 2019: y2019.meta },
      [2018, 2019],
      evInput
    );
    const view = deriveEvReportView(ev);
    const byLabel = Object.fromEntries(
      view.inputRows.map((row) => [row.label, row.value])
    );

    expect(byLabel["Jahresfahrleistung"]).toBe("15.000 km / Jahr");
    expect(byLabel["Stromverbrauch"]).toBe("18 kWh / 100 km");
    expect(byLabel["nutzbare Batteriekapazität"]).toBe("60 kWh");
    expect(byLabel["typische Fahrstrecke Montag–Freitag"]).toBe("40 km / Tag");
    expect(byLabel["typische Fahrstrecke Samstag"]).toBe("20 km");
    expect(byLabel["typische Fahrstrecke Sonntag"]).toBe("10 km");
    expect(byLabel["maximale Heimladeleistung"]).toBe("11 kW");
    expect(byLabel["Ladefenster Montag–Freitag"]).toBe("18:00–07:00");
    expect(byLabel["Ladefenster Samstag"]).toBe("Ganztägig verfügbar");
    expect(byLabel["Laden am Arbeitsplatz"]).toBe("Ja");
    expect(byLabel["kWh / Monat"]).toBe("80 kWh / Monat");
    expect(byLabel["Ladetage / Monat"]).toBe("8 Tage / Monat");

    const derived = Object.fromEntries(
      view.derivedRows.map((row) => [row.label, row.valueKwh])
    );
    expect(derived["Jährlicher EV-Energiebedarf"]).toBe(
      ev.annualDrivingDemandKwh
    );
    expect(derived["Davon am Arbeitsplatz geladen"]).toBe(
      ev.averageWorkplaceAcceptedKwh
    );
    expect(derived["Zu Hause geladen"]).toBe(ev.averageHomeChargedKwh);
    expect(derived["Zu Hause geladen"]).toBeGreaterThan(0);
    expect(derived["Davon am Arbeitsplatz geladen"]).toBe(
      ev.averageWorkplaceAcceptedKwh
    );
    expect(
      view.derivedRows.some((row) => row.label.includes("deklariert"))
    ).toBe(false);
  });
});
