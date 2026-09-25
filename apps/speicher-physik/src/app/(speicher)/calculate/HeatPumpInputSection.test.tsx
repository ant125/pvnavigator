import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { SpeicherInput } from "../types/speicher";
import { SPEICHER_FIELD_INLINE_MESSAGES } from "../utils/validateInput";
import {
  DISABLED_HEAT_PUMP_FORM_FIELDS,
  HEAT_PUMP_FORM_COPY,
  HEAT_PUMP_TECHNOLOGY_OPTIONS,
  HeatPumpEnableToggle,
  HeatPumpInputSection,
  heatPumpDhwOptions,
  parseHeatPumpConsumptionInput,
  patchForHeatPumpEnabled,
  patchHeatPumpTechnology,
} from "./HeatPumpInputSection";

function renderHp(formData: Partial<SpeicherInput> = {}) {
  return renderToStaticMarkup(
    <HeatPumpInputSection
      formData={formData}
      fieldErrors={{}}
      onChange={() => {}}
      clearFieldError={() => {}}
    />
  );
}

describe("patchForHeatPumpEnabled", () => {
  it("keeps Ja as a single-field patch and Nein as the existing HP reset", () => {
    expect(patchForHeatPumpEnabled(true)).toEqual({ heatPumpEnabled: true });
    expect(patchForHeatPumpEnabled(false)).toEqual({
      ...DISABLED_HEAT_PUMP_FORM_FIELDS,
    });
    expect(DISABLED_HEAT_PUMP_FORM_FIELDS).toEqual({
      heatPumpEnabled: false,
      heatPumpConsumptionKwh: undefined,
      heatPumpTechnology: undefined,
      heatPumpDhwService: undefined,
    });
  });
});

describe("heat pump type stored values", () => {
  it("keeps the previous radio values luftwasser and wasserwasser", () => {
    expect(HEAT_PUMP_TECHNOLOGY_OPTIONS.map((opt) => opt.value)).toEqual([
      "luftwasser",
      "wasserwasser",
    ]);
    expect(HEAT_PUMP_TECHNOLOGY_OPTIONS.map((opt) => opt.label)).toEqual([
      "Luft/Wasser",
      "Wasser/Wasser",
    ]);
  });

  it("preserves Wasser/Wasser clearing of Nur Heizung", () => {
    expect(
      patchHeatPumpTechnology(
        { heatPumpDhwService: "space_heat_only" },
        "wasserwasser"
      )
    ).toEqual({
      heatPumpTechnology: "wasserwasser",
      heatPumpDhwService: undefined,
    });
    expect(
      patchHeatPumpTechnology(
        { heatPumpDhwService: "space_heat_and_dhw" },
        "wasserwasser"
      )
    ).toEqual({
      heatPumpTechnology: "wasserwasser",
      heatPumpDhwService: "space_heat_and_dhw",
    });
    expect(
      patchHeatPumpTechnology(
        { heatPumpDhwService: "space_heat_only" },
        "luftwasser"
      )
    ).toEqual({ heatPumpTechnology: "luftwasser" });
  });
});

describe("heat pump Nutzung options", () => {
  it("keeps Luft/Wasser Nur Heizung plus Heizung und Warmwasser", () => {
    expect(heatPumpDhwOptions("luftwasser").map((opt) => opt.value)).toEqual([
      "space_heat_only",
      "space_heat_and_dhw",
    ]);
    expect(heatPumpDhwOptions("luftwasser").map((opt) => opt.label)).toEqual([
      "Nur Heizung",
      "Heizung und Warmwasser",
    ]);
  });

  it("keeps Wasser/Wasser limited to Heizung und Warmwasser", () => {
    expect(heatPumpDhwOptions("wasserwasser").map((opt) => opt.value)).toEqual([
      "space_heat_and_dhw",
    ]);
    expect(heatPumpDhwOptions("wasserwasser").map((opt) => opt.label)).toEqual([
      "Heizung und Warmwasser",
    ]);
  });
});

describe("parseHeatPumpConsumptionInput", () => {
  it("keeps the previous parseInt || undefined semantics", () => {
    expect(parseHeatPumpConsumptionInput("5000")).toBe(5000);
    expect(parseHeatPumpConsumptionInput("")).toBeUndefined();
    expect(parseHeatPumpConsumptionInput("0")).toBeUndefined();
    expect(parseHeatPumpConsumptionInput("abc")).toBeUndefined();
    expect(parseHeatPumpConsumptionInput("12.9")).toBe(12);
  });
});

describe("HeatPumpEnableToggle", () => {
  it("labels the radio group for screen readers and checks Nein by default", () => {
    const html = renderToStaticMarkup(
      <HeatPumpEnableToggle heatPumpEnabled={false} onChange={() => {}} />
    );
    expect(html).toContain(
      `<legend class="sr-only">${HEAT_PUMP_FORM_COPY.enableQuestion}</legend>`
    );
    expect(html).toContain('name="heatPumpEnabled"');
    expect(html).toMatch(/name="heatPumpEnabled"[^>]*checked=""/);
    expect(html).toContain("Nein");
    expect(html).toContain("Ja");
    expect(html).not.toContain("text-sm font-medium text-ink\">Wärmepumpe vorhanden?");
  });
});

describe("HeatPumpInputSection compact layout", () => {
  it("renders Typ and Stromverbrauch without vertical type radios", () => {
    const html = renderHp({ heatPumpEnabled: true });
    expect(html).toContain(">Typ<");
    expect(html).toContain('id="heatPumpTechnology"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain("Auswählen");
    expect(html).toContain(">Stromverbrauch<");
    expect(html).toContain('id="heatPumpConsumptionKwh"');
    expect(html).toContain('type="number"');
    expect(html).toContain("sg-number-no-spin");
    expect(html).toContain('name="heatPumpConsumptionKwh"');
    expect(html).toContain('min="1"');
    expect(html).toContain('id="heatPumpConsumptionKwh-unit"');
    expect(html).toContain("kWh/Jahr");
    expect(html).toContain("Separater Jahresstromverbrauch der Wärmepumpe.");
    expect(html).toContain(
      "whitespace-nowrap border-l border-line bg-field-subtle"
    );
    expect(html).not.toContain("<select");
    expect(html).not.toContain('name="heatPumpTechnology"');
    expect(html).not.toContain("Typ der Wärmepumpe");
    expect(html).not.toContain("Häufigste Bauart in Deutschland.");
    expect(html).not.toContain("Nutzt die Außenluft als Wärmequelle.");
    expect(html).not.toContain(
      "Nutzt Grundwasser bzw. ein kaltes Nahwärmenetz als Wärmequelle."
    );
    expect(html).not.toContain("Stromverbrauch Wärmepumpe (kWh/Jahr)");
    expect(html).not.toContain(
      "Falls vorhanden: separater Stromverbrauch Ihrer Wärmepumpe."
    );
    expect(html).not.toContain(
      "Viele Haushalte haben mit Wärmepumpe einen deutlich höheren"
    );
  });

  it("shows one type helper and Nutzung only after a type is chosen", () => {
    const empty = renderHp({ heatPumpEnabled: true });
    expect(empty).not.toContain("Außenluft als Wärmequelle.");
    expect(empty).not.toContain(
      "Grundwasser oder kaltes Nahwärmenetz als Wärmequelle."
    );
    expect(empty).not.toContain('id="heatPumpDhwService"');
    expect(empty).not.toContain("Wofür wird die Wärmepumpe verwendet?");

    const luft = renderHp({
      heatPumpEnabled: true,
      heatPumpTechnology: "luftwasser",
    });
    expect(luft).toContain("Luft/Wasser");
    expect(luft).toContain("Außenluft als Wärmequelle.");
    expect(luft).not.toContain(
      "Grundwasser oder kaltes Nahwärmenetz als Wärmequelle."
    );
    expect(luft).toContain("Gemessenes ThermBuild-Referenzprofil");
    expect(luft).toContain(">Nutzung<");
    expect(luft).toContain('id="heatPumpDhwService"');

    const wasser = renderHp({
      heatPumpEnabled: true,
      heatPumpTechnology: "wasserwasser",
    });
    expect(wasser).toContain("Wasser/Wasser");
    expect(wasser).toContain(
      "Grundwasser oder kaltes Nahwärmenetz als Wärmequelle."
    );
    expect(wasser).not.toContain("Außenluft als Wärmequelle.");
    expect(wasser).not.toContain("Gemessenes ThermBuild-Referenzprofil");
    expect(wasser).toContain(">Nutzung<");
    expect(wasser).toContain("Auswählen");
  });

  it("keeps selected Nutzung labels without inventing extra DHW values", () => {
    const html = renderHp({
      heatPumpEnabled: true,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_only",
      heatPumpConsumptionKwh: 5000,
    });
    expect(html).toContain("Nur Heizung");
    expect(html).toContain('value="5000"');
    expect(html).toContain("placeholder=\"z. B. 5000\"");
  });
});

describe("HeatPumpInputSection errors", () => {
  it("surfaces existing field errors next to the compact controls", () => {
    const html = renderToStaticMarkup(
      <HeatPumpInputSection
        formData={{
          heatPumpEnabled: true,
          heatPumpTechnology: "luftwasser",
        }}
        fieldErrors={{
          heatPumpTechnology: SPEICHER_FIELD_INLINE_MESSAGES.heatPumpTechnology,
          heatPumpDhwService: SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService,
          heatPumpConsumptionKwh:
            SPEICHER_FIELD_INLINE_MESSAGES.heatPumpConsumptionKwh,
        }}
        onChange={() => {}}
        clearFieldError={() => {}}
      />
    );
    expect(html).toContain('id="heatPumpTechnology-error"');
    expect(html).toContain(SPEICHER_FIELD_INLINE_MESSAGES.heatPumpTechnology);
    expect(html).toContain('id="heatPumpDhwService-error"');
    expect(html).toContain(SPEICHER_FIELD_INLINE_MESSAGES.heatPumpDhwService);
    expect(html).toContain('id="heatPumpConsumptionKwh-error"');
    expect(html).toContain(
      SPEICHER_FIELD_INLINE_MESSAGES.heatPumpConsumptionKwh
    );
  });
});
