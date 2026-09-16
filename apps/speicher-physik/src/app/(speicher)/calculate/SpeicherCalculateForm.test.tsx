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

  it("shows Individuell values in the dropdowns for 203° / 33° while collapsed", () => {
    const html = renderForm({
      surfaces: [{ systemSizeKwP: 10, tiltDeg: 33, azimuthDeg: 203 }],
    });
    expect(html).toContain("Individuell (203°)");
    expect(html).toContain("Individuell (33°)");
    expect(html).toContain("Exakte Winkel anzeigen");
    expect(html).toMatch(/id="exact-angles-0"[^>]*hidden/);
    expect(html).toContain("value=\"203\"");
    expect(html).toContain("value=\"33\"");
    expect(buildAzimuthDropdownOptions(203)[0]).toEqual({
      value: 203,
      label: "Individuell (203°)",
    });
    expect(buildTiltDropdownOptions(33)[0]).toEqual({
      value: 33,
      label: "Individuell (33°)",
    });
  });

  it("opens exact fields when locked with custom angles", () => {
    const html = renderForm({
      surfaces: [{ systemSizeKwP: 10, tiltDeg: 33, azimuthDeg: 203 }],
      locked: true,
    });
    expect(html).toContain("Exakte Winkel ausblenden");
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

  it("places kWp inside the PV-Leistung field and keeps the accessible unit", () => {
    const html = renderForm();
    expect(html).toContain("PV-Leistung (kWp) *");
    expect(html).toContain("pr-14");
    expect(html).toContain("aria-hidden");
    expect(html).toContain(">kWp<");
    expect(html).toContain('id="pvLeistung-0"');
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

  it("keeps Hausverbrauch labeled, puts kWh/Jahr inside the field, and hides range in Hinweis", () => {
    const html = renderForm();
    expect(html).toContain("Hausverbrauch (ohne Wärmepumpe) *");
    expect(html).toContain("pr-[6.5rem]");
    expect(html).toContain('id="annualConsumptionKwh-unit"');
    expect(html).toContain("kWh/Jahr");
    expect(html).toContain('aria-describedby="annualConsumptionKwh-unit"');
    expect(html).toContain("<summary");
    expect(html).toContain("Hinweis");
    expect(html).toContain("Ganze kWh zwischen 500 und 50.000.");
    expect(html).not.toContain(
      "Bitte geben Sie hier nur den Haushaltsstromverbrauch ein"
    );
    expect(html).toContain("value=\"4500\"");
    expect(html).toContain(`min="${500}"`);
    expect(html).toContain(`max="${50000}"`);
  });

  it("shows Hausverbrauch errors inline instead of inside Hinweis", () => {
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
    const errorIndex = html.indexOf('id="annualConsumptionKwh-error"');
    const detailsIndex = html.indexOf("<details");
    expect(errorIndex).toBeGreaterThan(-1);
    expect(detailsIndex).toBeGreaterThan(-1);
    expect(html.slice(detailsIndex, html.indexOf("</details>")).includes(
      "annualConsumptionKwh-error"
    )).toBe(false);
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
    expect(html).toContain("px-3 py-3");
    expect(html).not.toContain("border-t border-line bg-surface-muted px-4 py-4");
    expect(html).toContain("bg-danger-soft p-4");
    expect(html).toContain("Testfehler");
    expect(html).toContain("Berechnung starten");
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
        "min-w-0 font-sans text-sm font-semibold uppercase tracking-normal text-ink"
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
    expect(hausverbrauchHead).toContain("Hinweis");
    expect(hausverbrauchHead).toContain("ml-auto min-w-0 shrink-0");
  });

  it("keeps Wärmepumpe, EV and Notstrom copy while locking the fieldset", () => {
    const html = renderForm({ locked: true });
    expect(html).toContain('disabled=""');
    expect(html).toContain("Wärmepumpe vorhanden?");
    expect(html).toContain("Elektroauto");
    expect(html).toContain("Notstromreserve");
    expect(html).toContain("value=\"86154\"");
    expect(html).toContain("value=\"4500\"");
  });
});
