import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SpeicherInput } from "../types/speicher";
import { DISABLED_EV_FORM_FIELDS, EV_FORM_COPY, EV_HOME_CHARGE_POWER_OPTIONS } from "../utils/evForm";
import {
  EvEnableToggle,
  EvInputSection,
  patchForEvEnabled,
} from "./EvInputSection";

function renderEv(formData: Partial<SpeicherInput> = {}) {
  return renderToStaticMarkup(
    <EvInputSection
      formData={formData}
      fieldErrors={{}}
      onChange={() => {}}
      clearFieldError={() => {}}
    />
  );
}

describe("patchForEvEnabled", () => {
  it("keeps Ja as a single-field patch and Nein as DISABLED_EV_FORM_FIELDS", () => {
    expect(patchForEvEnabled(true)).toEqual({ evEnabled: true });
    expect(patchForEvEnabled(false)).toEqual({ ...DISABLED_EV_FORM_FIELDS });
    expect(DISABLED_EV_FORM_FIELDS).toMatchObject({
      evEnabled: false,
      evAnnualKm: undefined,
      evConsumptionKwhPer100Km: undefined,
      evUsableBatteryCapacityKwh: undefined,
      evTypicalDailyKmWd: undefined,
      evTypicalDailyKmSa: undefined,
      evTypicalDailyKmSu: undefined,
      evMaxHomeChargePowerKw: undefined,
      evHomeWindowWd: undefined,
      evHomeWindowSa: undefined,
      evHomeWindowSu: undefined,
      evWorkplaceEnabled: undefined,
      evWorkplaceKwhPerMonth: undefined,
      evWorkplaceChargingDaysPerMonth: undefined,
    });
  });
});

describe("EvEnableToggle", () => {
  it("labels the radio group for screen readers and checks Nein by default", () => {
    const html = renderToStaticMarkup(
      <EvEnableToggle evEnabled={false} onChange={() => {}} />
    );
    expect(html).toContain(
      `<legend class="sr-only">${EV_FORM_COPY.enableQuestion}</legend>`
    );
    expect(html).toContain('name="evEnabled"');
    expect(html).toMatch(/name="evEnabled"[^>]*checked=""/);
    expect(html).toContain("Nein");
    expect(html).toContain("Ja");
  });
});

describe("EvInputSection compact layout", () => {
  it("renders compact vehicle fields without a Fahrzeug heading", () => {
    const html = renderEv({ evEnabled: true });
    expect(html).toContain("Jahresfahrleistung");
    expect(html).toContain("Verbrauch");
    expect(html).toContain("Nutzbare Batterie");
    expect(html).toContain('id="evAnnualKm"');
    expect(html).toContain('id="evConsumptionKwhPer100Km"');
    expect(html).toContain('id="evUsableBatteryCapacityKwh"');
    expect(html).toContain("Mo–Fr");
    expect(html).toContain('id="evTypicalDailyKmWd"');
    expect(html).toContain('id="evTypicalDailyKmSa"');
    expect(html).toContain('id="evTypicalDailyKmSu"');
    expect(html).toContain("@min-[18rem]:grid-cols-3");
    expect(html).toContain("@min-[18rem]:grid-cols-2");
    expect(html).toContain('id="evAnnualKm-unit"');
    expect(html).toContain(
      "whitespace-nowrap border-l border-line bg-field-subtle"
    );
    expect(html).toContain("km/Jahr");
    expect(html).toContain("kWh/100 km");
    expect(html).not.toContain(">Fahrzeug<");
    expect(html).not.toContain(
      "Verbrauch und Batteriekapazität finden Sie in den technischen Daten Ihres Fahrzeugs."
    );
    expect(html).toContain("Typische Fahrstrecken");
    expect(html).toContain(
      "Die Tageswerte beschreiben die typische Verteilung Ihrer Fahrten."
    );
    expect(html).not.toContain(
      "Die Jahresfahrleistung bestimmt den Energiebedarf."
    );
    expect(html).not.toContain("flex min-w-0 items-center gap-2");
    expect(html).not.toContain("Wie viele Kilometer fahren Sie ungefähr pro Jahr?");
    expect(html).not.toContain("Wie viele Kilometer fahren Sie an einem typischen Werktag?");
    expect(html).not.toContain(
      "Wie schnell kann Ihr Elektroauto bei Ihnen zu Hause maximal laden?"
    );
  });

  it("uses the shared PresetDropdown for Ladeleistung and keeps numeric kW values", () => {
    expect(EV_HOME_CHARGE_POWER_OPTIONS.map((opt) => opt.kw)).toEqual([
      2.3, 3.7, 7.4, 11, 22,
    ]);
    expect(EV_HOME_CHARGE_POWER_OPTIONS.find((opt) => opt.kw === 11)).toEqual({
      kw: 11,
      label: "11 kW",
      note: "typische Wallbox",
    });

    const empty = renderEv({ evEnabled: true });
    expect(empty).toContain('id="evMaxHomeChargePowerKw"');
    expect(empty).toContain('aria-haspopup="listbox"');
    expect(empty).toContain("Auswählen");
    expect(empty).not.toContain("<select");
    expect(empty).not.toContain('name="evMaxHomeChargePowerKw" type="radio"');
    expect(empty).not.toContain('type="radio" name="evMaxHomeChargePowerKw"');

    const selected = renderEv({
      evEnabled: true,
      evMaxHomeChargePowerKw: 11,
    });
    expect(selected).toContain("11 kW");
    expect(selected).not.toContain("11 kW – typische Wallbox");
    expect(selected).not.toContain("typische Wallbox");
  });

  it("keeps native 15-minute time inputs in a 3-column grid", () => {
    const html = renderEv({
      evEnabled: true,
      evHomeWindowWd: { start: "17:30", end: "07:00" },
    });
    expect(html).toContain('id="evHomeWindowWd-start"');
    expect(html).toContain('id="evHomeWindowWd-end"');
    expect(html).toContain('id="evHomeWindowSa-start"');
    expect(html).toContain('id="evHomeWindowSu-end"');
    expect(html).toContain('type="time"');
    expect(html).toContain("step=\"900\"");
    expect(html).toContain('aria-label="Montag–Freitag von"');
    expect(html).toContain('aria-label="Montag–Freitag bis"');
    expect(html).toContain(">Von<");
    expect(html).toContain(">Bis<");
    expect(html).toContain(
      "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]"
    );
    expect(html).toContain("overflow-hidden rounded-sm border border-field-border");
    expect(html).toContain("bg-field-subtle text-xs font-medium text-ink-muted");
    expect(html).toContain("bg-field-subtle text-sm text-ink");
    expect(html).toContain("border-l border-line border-b border-line min-w-0 bg-field text-sm text-ink");
    expect(html).toContain("sg-ev-time");
    expect(html).not.toContain("gap-x-2 gap-y-1.5");
    expect(html).toContain("Über Mitternacht möglich.");
    expect(html).toContain(
      "Zeitraum, in dem die Heimladung bei Bedarf beginnen darf."
    );
    expect(html).not.toContain(
      "Zeitfenster, in dem die Heimladung beginnen darf, wenn das Fahrzeug Energie benötigt."
    );
    expect(html).not.toContain("<table");
    expect(html).not.toContain("rounded-sm border border-line-soft bg-surface p-3");

    const heading = html.indexOf(">Zu Hause angeschlossen<");
    const tagHeader = html.indexOf(">Tag<");
    const overnight = html.indexOf("Über Mitternacht möglich.");
    const semantics = html.indexOf(
      "Zeitraum, in dem die Heimladung bei Bedarf beginnen darf."
    );
    expect(heading).toBeGreaterThan(-1);
    expect(tagHeader).toBeGreaterThan(heading);
    expect(overnight).toBeGreaterThan(tagHeader);
    expect(semantics).toBeGreaterThan(overnight);
  });

  it("hides workplace energy fields until workplace is explicitly Ja", () => {
    const nein = renderEv({ evEnabled: true, evWorkplaceEnabled: false });
    expect(nein).not.toContain('id="evWorkplaceKwhPerMonth"');
    expect(nein).not.toContain('id="evWorkplaceChargingDaysPerMonth"');

    const unset = renderEv({ evEnabled: true });
    expect(unset).not.toContain('id="evWorkplaceKwhPerMonth"');
    expect(unset).toContain('name="evWorkplaceEnabled"');

    const ja = renderEv({ evEnabled: true, evWorkplaceEnabled: true });
    expect(ja).toContain('id="evWorkplaceKwhPerMonth"');
    expect(ja).toContain('id="evWorkplaceChargingDaysPerMonth"');
    expect(ja).toContain("Monatliche Ladung");
    expect(ja).toContain("Ladetage");
    expect(ja).toContain("Monatlich am Arbeitsplatz geladene Energie.");
    expect(ja).toContain("Anzahl der Ladetage pro Monat.");
    expect(ja).not.toContain("Häufig in der Fahrzeug-App");
    expect(ja).not.toContain("nicht welche Wochentage");
    expect(ja).toContain('id="evWorkplaceKwhPerMonth-unit"');
    expect(ja).toContain('id="evWorkplaceChargingDaysPerMonth-unit"');
  });
});
