import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { PvSurfaceInput, SpeicherInput } from "../types/speicher";
import type { SpeicherFieldErrors } from "../utils/validateInput";
import {
  buildAzimuthDropdownOptions,
  buildTiltDropdownOptions,
  DEFAULT_SURFACE,
} from "./calculateFormModel";
import { quantityInputProps } from "./formStyles";
import {
  exactAnglesForcedOpen,
  FOCUS_FIELD_ORDER,
  SpeicherCalculateForm,
  type CalculateFormFieldRefs,
} from "./SpeicherCalculateForm";

function emptyRefs(): CalculateFormFieldRefs {
  return {
    postalCode: createRef<HTMLInputElement>(),
    city: createRef<HTMLInputElement>(),
    street: createRef<HTMLInputElement>(),
    houseNumber: createRef<HTMLInputElement>(),
    annualConsumptionKwh: createRef<HTMLInputElement>(),
  };
}

function renderForm({
  surfaces = [{ ...DEFAULT_SURFACE, systemSizeKwP: 10 }],
  locked = false,
  errors = [],
  fieldErrors = {},
  azimuthInputStrings,
  tiltInputStrings,
  formOverrides = {},
}: {
  surfaces?: PvSurfaceInput[];
  locked?: boolean;
  errors?: string[];
  fieldErrors?: SpeicherFieldErrors;
  azimuthInputStrings?: string[];
  tiltInputStrings?: string[];
  formOverrides?: Partial<SpeicherInput>;
} = {}) {
  const formData: Partial<SpeicherInput> = {
    pvSurfaces: surfaces,
    postalCode: "86154",
    city: "Augsburg",
    street: "Beispielstraße",
    houseNumber: "12",
    annualConsumptionKwh: 4500,
    ...formOverrides,
  };
  return renderToStaticMarkup(
    <SpeicherCalculateForm
      formData={formData}
      setFormData={() => {}}
      kwpInputStrings={surfaces.map((s) =>
        Number.isFinite(s.systemSizeKwP) ? String(s.systemSizeKwP) : ""
      )}
      setKwpInputStrings={() => {}}
      azimuthInputStrings={
        azimuthInputStrings ?? surfaces.map((s) => String(s.azimuthDeg))
      }
      setAzimuthInputStrings={() => {}}
      tiltInputStrings={
        tiltInputStrings ?? surfaces.map((s) => String(s.tiltDeg))
      }
      setTiltInputStrings={() => {}}
      errors={errors}
      fieldErrors={fieldErrors}
      clearFieldError={() => {}}
      locked={locked}
      submitLabel="Berechnung starten"
      showSubmit
      onSubmit={() => {}}
      errorBoxRef={createRef<HTMLDivElement>() as RefObject<HTMLDivElement | null>}
      fieldInputRefs={emptyRefs()}
    />
  );
}

describe("exactAnglesForcedOpen", () => {
  const preset: PvSurfaceInput = {
    systemSizeKwP: 10,
    tiltDeg: 30,
    azimuthDeg: 180,
  };
  const custom: PvSurfaceInput = {
    systemSizeKwP: 10,
    tiltDeg: 33,
    azimuthDeg: 203,
  };
  const invalid: PvSurfaceInput = {
    systemSizeKwP: 10,
    tiltDeg: 30,
    azimuthDeg: Number.NaN,
  };

  it("keeps valid custom angles collapsed until locked or submitted invalid", () => {
    expect(exactAnglesForcedOpen(custom, false, false)).toBe(false);
    expect(exactAnglesForcedOpen(preset, false, true)).toBe(false);
    expect(exactAnglesForcedOpen(invalid, false, false)).toBe(false);
  });

  it("opens the matching plane for an invalid exact angle after validation", () => {
    expect(exactAnglesForcedOpen(invalid, false, true)).toBe(true);
    expect(exactAnglesForcedOpen(preset, false, true)).toBe(false);
  });

  it("opens custom or invalid angles on a locked form so they stay visible", () => {
    expect(exactAnglesForcedOpen(custom, true, false)).toBe(true);
    expect(exactAnglesForcedOpen(invalid, true, false)).toBe(true);
    expect(exactAnglesForcedOpen(preset, true, false)).toBe(false);
  });
});

describe("SpeicherCalculateForm C1+C2", () => {
  it("renders Standort before PV-Anlage", () => {
    const html = renderForm();
    expect(html.indexOf("Standort")).toBeGreaterThan(-1);
    expect(html.indexOf("Standort")).toBeLessThan(html.indexOf("PV-Anlage"));
    expect(html.indexOf("PV-Anlage")).toBeLessThan(html.indexOf("Hausverbrauch"));
  });

  it("keeps the existing address focus order", () => {
    expect([...FOCUS_FIELD_ORDER]).toEqual([
      "postalCode",
      "city",
      "street",
      "houseNumber",
      "annualConsumptionKwh",
    ]);
  });

  it("hides exact angle fields behind a per-plane toggle", () => {
    const html = renderForm();
    expect(html).toContain("Exakte Winkel anzeigen");
    expect(html).not.toContain("Exakte Winkel ausblenden");
    expect(html).toContain('aria-controls="exact-angles-0"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('id="exact-angles-0"');
    expect(html).toMatch(/id="exact-angles-0"[^>]*hidden/);
    expect(html).toContain("value=\"180\"");
    expect(html).toContain("value=\"30\"");
  });

  it("shows bare degree values in the dropdowns for 203° / 33° while collapsed", () => {
    const html = renderForm({
      surfaces: [{ systemSizeKwP: 10, tiltDeg: 33, azimuthDeg: 203 }],
    });
    expect(html).toContain("203°");
    expect(html).toContain("33°");
    expect(html).not.toContain("Individuell");
    expect(html).not.toContain("0° = Nord");
    expect(html).not.toContain("0° = flach");
    expect(html).toContain("Exakte Winkel anzeigen");
    expect(html).toMatch(/id="exact-angles-0"[^>]*hidden/);
    expect(html).toContain("value=\"203\"");
    expect(html).toContain("value=\"33\"");
    expect(buildAzimuthDropdownOptions(203)[0]).toEqual({
      value: 203,
      label: "203°",
    });
    expect(buildTiltDropdownOptions(33)[0]).toEqual({
      value: 33,
      label: "33°",
    });
    expect(buildAzimuthDropdownOptions(180).map((option) => option.label)).toContain(
      "Süd (180°)",
    );
    expect(buildTiltDropdownOptions(30).map((option) => option.label)).toContain(
      "30°",
    );
  });

  it("opens exact fields when locked with custom angles", () => {
    const html = renderForm({
      surfaces: [{ systemSizeKwP: 10, tiltDeg: 33, azimuthDeg: 203 }],
      locked: true,
    });
    expect(html).toContain("Exakte Winkel ausblenden");
    expect(html).toContain("203°");
    expect(html).toContain("33°");
    expect(html).not.toContain("Individuell");
    expect(html).not.toContain("0° = Nord");
    expect(html).not.toContain("0° = flach");
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toMatch(/id="exact-angles-0"[^>]*hidden/);
    expect(html).toContain('disabled=""');
  });

  it("opens only the plane whose exact angle failed validation", () => {
    const html = renderForm({
      surfaces: [
        { systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 },
        { systemSizeKwP: 4, tiltDeg: 30, azimuthDeg: Number.NaN },
      ],
      errors: ["surface-angle-invalid"],
    });
    expect(html).toContain('aria-controls="exact-angles-0"');
    expect(html).toContain('aria-controls="exact-angles-1"');
    expect(html).toMatch(
      /aria-expanded="false"[^>]*aria-controls="exact-angles-0"/
    );
    expect(html).toMatch(
      /aria-expanded="true"[^>]*aria-controls="exact-angles-1"/
    );
  });

  it("uses compact Dachfläche actions as buttons", () => {
    const html = renderForm({
      surfaces: [
        { systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 },
        { systemSizeKwP: 4, tiltDeg: 15, azimuthDeg: 90 },
        { systemSizeKwP: 3, tiltDeg: 40, azimuthDeg: 270 },
      ],
    });
    expect(html).toContain("Dachfläche 1");
    expect(html).toContain("Dachfläche 2");
    expect(html).toContain("Dachfläche 3");
    expect(html).toContain("+ Dachfläche");
    expect(html).toContain("Entfernen");
    expect(html).not.toContain("Diese Fläche entfernen");
    expect(html).not.toContain("Weitere Dachfläche hinzufügen");
    expect(html).toContain('type="button"');
  });

  it("renders PV-Leistung as a compact kWp unit field", () => {
    const html = renderForm();
    expect(html).toContain("PV-Leistung (kWp) *");
    expect(html).toContain('id="pvLeistung-0"');
    expect(html).toContain('id="pvLeistung-0-unit"');
    expect(html).toContain(">kWp<");
    expect(html).toContain('placeholder="z.B. 10"');
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('aria-describedby="pvLeistung-0-unit"');
    expect(html).toContain(
      "whitespace-nowrap border-l border-line bg-field-subtle"
    );
    expect(html).toContain("focus-within:border-accent");
    expect(html).not.toContain("pr-14");
    expect(html).toContain(
      "Die Größe Ihrer bestehenden oder geplanten PV-Anlage auf dieser Dachfläche."
    );
  });

  it("lays out Ausrichtung and Neigung as a wrapping two-column grid", () => {
    const html = renderForm();
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("Dachausrichtung (°)");
    expect(html).toContain("Dachneigung (°)");
    expect(html).not.toContain("xl:grid-cols-2");
  });
});

describe("SpeicherCalculateForm C3+C4", () => {
  it("pairs PLZ/Ort and Straße/Hausnummer without the always-visible address sentence", () => {
    const html = renderForm();
    expect(html).toContain('autoComplete="postal-code"');
    expect(html).toContain('autoComplete="address-level2"');
    expect(html).toContain('autoComplete="street-address"');
    expect(html).toContain("placeholder=\"z.B. 12a\"");
    expect(html).toContain("@min-[16rem]:grid-cols-2");
    expect(html).toContain(
      "@min-[16rem]:grid-cols-[minmax(0,1fr)_5rem]"
    );
    expect(html).toContain("PLZ *");
    expect(html).toContain("Ort *");
    expect(html).toContain("Straße *");
    expect(html).toContain("Nr. *");
    expect(html).toContain("sr-only");
    expect(html).toContain("Hausnummer");
    expect(html).not.toContain(">Hausnummer *</label>");
    expect(html).toContain("value=\"Beispielstraße\"");
    expect(html).toContain("value=\"12\"");
    expect(html).not.toContain(
      "Bitte geben Sie die vollständige Adresse des Gebäudes ein."
    );
  });

  it("keeps Hausverbrauch labeled with a compact kWh/Jahr unit field and no range Hinweis", () => {
    const html = renderForm();
    expect(html).toContain("Hausverbrauch (ohne Wärmepumpe) *");
    expect(html).toContain('id="annualConsumptionKwh-unit"');
    expect(html).toContain("kWh/Jahr");
    expect(html).toContain('aria-describedby="annualConsumptionKwh-unit"');
    expect(html).toContain(
      "whitespace-nowrap border-l border-line bg-field-subtle"
    );
    expect(html).toContain("focus-within:border-accent");
    expect(html).not.toContain("pr-[6.5rem]");
    expect(html).not.toContain("<summary");
    expect(html).not.toContain("Hinweis");
    expect(html).not.toContain("Ganze kWh zwischen 500 und 50.000.");
    expect(html).not.toContain(
      "Bitte geben Sie hier nur den Haushaltsstromverbrauch ein"
    );
    expect(html).toContain("value=\"4500\"");
    expect(html).toContain(`min="${500}"`);
    expect(html).toContain(`max="${50000}"`);
    expect(html).toContain('id="annualConsumptionKwh"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain("sg-number-no-spin");
  });

  it("shows Hausverbrauch errors inline only when the field is invalid", () => {
    const html = renderForm({
      fieldErrors: {
        annualConsumptionKwh:
          "Der Jahresstromverbrauch muss zwischen 500 und 50.000 kWh liegen.",
      },
    });
    expect(html).toContain('id="annualConsumptionKwh-error"');
    expect(html).toContain(
      "Der Jahresstromverbrauch muss zwischen 500 und 50.000 kWh liegen."
    );
    expect(html).toContain(
      'aria-describedby="annualConsumptionKwh-unit annualConsumptionKwh-error"'
    );
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Hinweis");
    expect(html).not.toContain("Ganze kWh zwischen 500 und 50.000.");
    const errorIndex = html.indexOf('id="annualConsumptionKwh-error"');
    const fieldIndex = html.indexOf('id="annualConsumptionKwh"');
    expect(errorIndex).toBeGreaterThan(fieldIndex);
  });

  it("uses compact form spacing without shrinking submit or error chrome", () => {
    const html = renderForm({ errors: ["Testfehler"] });
    expect(html).toContain("space-y-panel-gap");
    expect(html).toContain("space-y-field-group-gap");
    expect(html).toContain("space-y-field-gap");
    expect(html).toContain("overflow-visible rounded-none border border-line-soft");
    expect(html).toContain("bg-surface-muted/30 px-panel-padding-x py-1.5");
    expect(html).toContain("text-ink");
    expect(html).toContain("min-h-11");
    expect(html).toContain("lg:min-h-9");
    expect(html).not.toContain("border-t border-line bg-surface-muted px-3 py-3");
    expect(html).not.toContain("border-t border-line bg-surface-muted px-4 py-4");
    expect(html).toContain("bg-danger-soft p-4");
    expect(html).toContain("Testfehler");
    expect(html).toContain("Berechnung starten");
    expect(html).toContain("Dauer ca. 40 Sekunden.");
    expect(html).not.toContain("Pflichtfelder sind mit");
    expect(html).not.toContain("Methodik und Quellen");
  });

  it("applies the inset-panel chrome to every form section heading", () => {
    const html = renderForm({ formOverrides: { evEnabled: true } });
    const headings = [
      "Standort",
      "PV-Anlage",
      "Hausverbrauch",
      "Wärmepumpe",
      "Elektroauto",
      "Notstromreserve",
    ].map((title) =>
      html.slice(
        html.lastIndexOf("<h2", html.indexOf(`>${title}<`)),
        html.indexOf("</h2>", html.indexOf(`>${title}<`)) + 5
      )
    );
    expect(html).toContain("overflow-visible rounded-none border border-line-soft");
    expect(html).toContain("border-b border-line-soft bg-surface-muted/30");
    for (const heading of headings) {
      expect(heading).toContain(
        "min-w-0 font-sans text-sm font-bold uppercase tracking-normal text-ink"
      );
      expect(heading).not.toContain("tracking-[0.14em]");
      expect(heading).not.toContain("font-mono");
    }
    expect(html).toContain(
      "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text"
    );
    const hausverbrauchHead = html.slice(
      html.lastIndexOf("<div", html.indexOf(">Hausverbrauch<")),
      html.indexOf("</div>", html.indexOf(">Hausverbrauch<"))
    );
    expect(hausverbrauchHead).not.toContain("Hinweis");
    expect(hausverbrauchHead).not.toContain("Ganze kWh zwischen");
  });

  it("keeps Wärmepumpe, EV and Notstrom copy while locking the fieldset", () => {
    const html = renderForm({ locked: true });
    expect(html).toContain('disabled=""');
    expect(html).toContain("sg-calculate-form");
    expect(html).toContain("disabled:bg-field");
    expect(html).toContain("disabled:text-ink/70");
    expect(html).toContain("disabled:opacity-100");
    expect(html).not.toContain("disabled:bg-surface-muted");
    expect(html).not.toContain("has-[:disabled]:bg-surface-muted");
    expect(html).toContain(
      '<legend class="sr-only">Wärmepumpe vorhanden?</legend>'
    );
    expect(html).toContain("Elektroauto");
    expect(html).toContain("Notstromreserve");
    expect(html).toContain("value=\"86154\"");
    expect(html).toContain("value=\"4500\"");
  });

  it("puts Wärmepumpe Nein/Ja in the section heading and hides the HP body by default", () => {
    const html = renderForm();
    const hpStart = html.lastIndexOf("<section", html.indexOf(">Wärmepumpe<"));
    const ev = html.indexOf(">Elektroauto<");
    const hpChunk = html.slice(hpStart, ev);
    expect(hpChunk).toContain(
      '<legend class="sr-only">Wärmepumpe vorhanden?</legend>'
    );
    expect(hpChunk).toContain('name="heatPumpEnabled"');
    expect(hpChunk).toContain("Nein");
    expect(hpChunk).toContain("Ja");
    expect(hpChunk).not.toContain('id="heatPumpTechnology"');
    expect(hpChunk).not.toContain('id="heatPumpConsumptionKwh"');
    expect(hpChunk).not.toContain(">Typ<");
    expect(hpChunk).not.toContain(">Stromverbrauch<");
    expect(hpChunk).not.toContain(
      "space-y-field-group-gap px-panel-padding-x py-panel-padding-y"
    );
    expect(hpChunk).not.toContain(
      "Viele Haushalte haben mit Wärmepumpe einen deutlich höheren"
    );
  });

  it("shows the compact Wärmepumpe body only when Wärmepumpe is Ja", () => {
    const html = renderForm({
      formOverrides: {
        heatPumpEnabled: true,
        heatPumpTechnology: "luftwasser",
        heatPumpDhwService: "space_heat_and_dhw",
        heatPumpConsumptionKwh: 5000,
      },
    });
    const hpStart = html.lastIndexOf("<section", html.indexOf(">Wärmepumpe<"));
    const ev = html.indexOf(">Elektroauto<");
    const hpChunk = html.slice(hpStart, ev);
    expect(hpChunk).toContain('id="heatPumpTechnology"');
    expect(hpChunk).toContain(">Typ<");
    expect(hpChunk).toContain("Luft/Wasser");
    expect(hpChunk).toContain(">Nutzung<");
    expect(hpChunk).toContain("Heizung und Warmwasser");
    expect(hpChunk).toContain('id="heatPumpConsumptionKwh"');
    expect(hpChunk).toContain('aria-haspopup="listbox"');
    expect(hpChunk).not.toContain("<select");
    expect(hpChunk).not.toContain('name="heatPumpTechnology"');
    expect(hpChunk).not.toContain("Typ der Wärmepumpe");
    expect(hpChunk).not.toContain("Wofür wird die Wärmepumpe verwendet?");
    expect(hpChunk).not.toContain("Häufigste Bauart in Deutschland.");
  });

  it("puts Elektroauto Nein/Ja in the section heading and hides the EV body by default", () => {
    const html = renderForm();
    const evStart = html.lastIndexOf("<section", html.indexOf(">Elektroauto<"));
    const notstrom = html.indexOf(">Notstromreserve<");
    const evChunk = html.slice(evStart, notstrom);
    expect(evChunk).toContain(
      '<legend class="sr-only">Elektroauto vorhanden?</legend>'
    );
    expect(evChunk).toContain('name="evEnabled"');
    expect(evChunk).toContain("Nein");
    expect(evChunk).toContain("Ja");
    expect(evChunk).not.toContain('id="evAnnualKm"');
    expect(evChunk).not.toContain("Jahresfahrleistung");
    expect(evChunk).not.toContain("space-y-field-group-gap px-panel-padding-x py-panel-padding-y");
  });

  it("shows the compact EV body only when Elektroauto is Ja", () => {
    const html = renderForm({ formOverrides: { evEnabled: true } });
    const evStart = html.lastIndexOf("<section", html.indexOf(">Elektroauto<"));
    const notstrom = html.indexOf(">Notstromreserve<");
    const evChunk = html.slice(evStart, notstrom);
    expect(evChunk).toContain('id="evAnnualKm"');
    expect(evChunk).toContain("Jahresfahrleistung");
    expect(evChunk).toContain("Max. Ladeleistung");
    expect(evChunk).toContain('aria-haspopup="listbox"');
    expect(evChunk).toContain("Auswählen");
    expect(evChunk).not.toContain("<select");
    expect(evChunk).toContain("Laden am Arbeitsplatz");
    expect(evChunk).not.toContain("Für eine realistische Berücksichtigung Ihres Elektroautos");
  });
});

function inputTags(html: string): string[] {
  return html.match(/<input\b[^>]*>/g) ?? [];
}

function inputAttr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

describe("quantity fields ignore wheel and trackpad scroll", () => {
  /*
    A focused input type="number" steps its value on wheel and trackpad
    scroll in Chromium, Firefox, and WebKit. jsdom does not implement that
    user-agent behavior, so a synthetic wheel event cannot catch a
    regression. The guard is the rendered control.
  */
  it("renders every free-entry quantity as text with a mobile keyboard mode", () => {
    expect(quantityInputProps("numeric")).toEqual({
      type: "text",
      inputMode: "numeric",
      autoComplete: "off",
    });
    expect(quantityInputProps("decimal").type).toBe("text");
    expect(quantityInputProps("decimal").inputMode).toBe("decimal");

    const html = renderForm({
      surfaces: [{ systemSizeKwP: 10.5, tiltDeg: 33, azimuthDeg: 203 }],
      formOverrides: {
        heatPumpEnabled: true,
        heatPumpConsumptionKwh: 5000,
        evEnabled: true,
        evWorkplaceEnabled: true,
        backupReserveKwh: 2,
      },
    });
    const inputs = inputTags(html);
    expect(inputs.some((tag) => inputAttr(tag, "type") === "number")).toBe(
      false
    );
    expect(html).not.toContain("sg-number-no-spin");

    const quantityFields: Array<{ id: string; inputMode: "numeric" | "decimal" }> =
      [
        { id: "pvLeistung-0", inputMode: "decimal" },
        { id: "exact-azimut-0", inputMode: "numeric" },
        { id: "exact-neigung-0", inputMode: "numeric" },
        { id: "annualConsumptionKwh", inputMode: "numeric" },
        { id: "heatPumpConsumptionKwh", inputMode: "numeric" },
        { id: "evAnnualKm", inputMode: "numeric" },
        { id: "evConsumptionKwhPer100Km", inputMode: "decimal" },
        { id: "evUsableBatteryCapacityKwh", inputMode: "decimal" },
        { id: "evTypicalDailyKmWd", inputMode: "numeric" },
        { id: "evTypicalDailyKmSa", inputMode: "numeric" },
        { id: "evTypicalDailyKmSu", inputMode: "numeric" },
        { id: "evWorkplaceKwhPerMonth", inputMode: "decimal" },
        { id: "evWorkplaceChargingDaysPerMonth", inputMode: "numeric" },
      ];

    for (const field of quantityFields) {
      const tag = inputs.find((candidate) => inputAttr(candidate, "id") === field.id);
      expect(tag, field.id).toBeDefined();
      expect(inputAttr(tag ?? "", "type"), field.id).toBe("text");
      expect(inputAttr(tag ?? "", "inputMode"), field.id).toBe(field.inputMode);
    }

    const reserve = inputs.filter(
      (tag) => inputAttr(tag, "name") === "backupReserveKwhOption"
    );
    expect(reserve.length).toBeGreaterThan(0);
    expect(reserve.every((tag) => inputAttr(tag, "type") === "radio")).toBe(
      true
    );
  });
});
