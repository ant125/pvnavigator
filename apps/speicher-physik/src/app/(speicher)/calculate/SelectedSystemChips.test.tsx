import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { InputSystemPreview } from "./InputSystemPreview";
import {
  buildSelectedSystemChips,
  SelectedSystemChips,
} from "./SelectedSystemChips";
import {
  SYSTEM_SCENE_HP_LUFTWASSER_SRC,
  SYSTEM_SCENE_HP_NEUTRAL_SRC,
  SYSTEM_SCENE_HP_WASSERWASSER_SRC,
} from "./SystemScene";

describe("buildSelectedSystemChips", () => {
  it("omits empty and unset equipment, including missing PV power", () => {
    expect(
      buildSelectedSystemChips({
        heatPumpEnabled: false,
        evEnabled: false,
        backupReserveKwh: 0,
      })
    ).toEqual([]);
  });

  it("shows entered PV power and optional extras without form field echoes", () => {
    const chips = buildSelectedSystemChips({
      pvSurfaces: [
        { systemSizeKwP: 6, tiltDeg: 30, azimuthDeg: 180 },
        { systemSizeKwP: 4, tiltDeg: 15, azimuthDeg: 90 },
      ],
      annualConsumptionKwh: 4200,
      heatPumpEnabled: true,
      heatPumpTechnology: "luftwasser",
      heatPumpDhwService: "space_heat_and_dhw",
      heatPumpConsumptionKwh: 3800,
      evEnabled: true,
      evAnnualKm: 12000,
      backupReserveKwh: 2,
    });

    expect(chips.map((chip) => chip.label)).toEqual([
      "PV · 10 kWp · 2 Flächen",
      "Wärmepumpe · Luft/Wasser",
      "Elektroauto",
      "Notstrom · 2 kWh",
    ]);
    expect(chips.map((chip) => chip.label).join(" ")).not.toMatch(
      /4200|3800|12000|Süd|30°|Speicher/
    );
  });

  it("formats PV power in German and keeps whole numbers plain", () => {
    expect(
      buildSelectedSystemChips({
        pvSurfaces: [{ systemSizeKwP: 9.5, tiltDeg: 30, azimuthDeg: 180 }],
      }).map((chip) => chip.label)
    ).toEqual(["PV · 9,5 kWp"]);
    expect(
      buildSelectedSystemChips({
        pvSurfaces: [{ systemSizeKwP: 21, tiltDeg: 30, azimuthDeg: 180 }],
      }).map((chip) => chip.label)
    ).toEqual(["PV · 21 kWp"]);
    expect(
      buildSelectedSystemChips({
        pvSurfaces: [
          { systemSizeKwP: 6.25, tiltDeg: 30, azimuthDeg: 180 },
          { systemSizeKwP: 4.25, tiltDeg: 15, azimuthDeg: 90 },
        ],
      }).map((chip) => chip.label)
    ).toEqual(["PV · 10,5 kWp · 2 Flächen"]);
  });

  it("omits the heat pump chip until a technology is chosen", () => {
    expect(
      buildSelectedSystemChips({
        heatPumpEnabled: true,
      })
    ).toEqual([]);
    expect(
      buildSelectedSystemChips({
        heatPumpEnabled: false,
      })
    ).toEqual([]);
    expect(
      buildSelectedSystemChips({
        heatPumpEnabled: true,
        heatPumpTechnology: "luftwasser",
      })
    ).toEqual([{ key: "heatPump", label: "Wärmepumpe · Luft/Wasser" }]);
    expect(
      buildSelectedSystemChips({
        heatPumpEnabled: true,
        heatPumpTechnology: "wasserwasser",
      })
    ).toEqual([{ key: "heatPump", label: "Wärmepumpe · Wasser/Wasser" }]);
  });
});

describe("SelectedSystemChips", () => {
  it("renders informational labels, not controls", () => {
    const html = renderToStaticMarkup(
      <SelectedSystemChips
        formData={{
          pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
          heatPumpEnabled: true,
          heatPumpTechnology: "wasserwasser",
          evEnabled: true,
          backupReserveKwh: 1.5,
        }}
      />
    );

    expect(html).toContain("Ausgewählte Komponenten");
    expect(html).toContain("PV · 10 kWp");
    expect(html).toContain("Wärmepumpe · Wasser/Wasser");
    expect(html).toContain("Elektroauto");
    expect(html).toContain("Notstrom · 1,5 kWh");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("cursor-pointer");
    expect(html).not.toContain("href=");
  });
});

describe("InputSystemPreview", () => {
  it("pins a compact input card and keeps the detailed summary out", () => {
    const html = renderToStaticMarkup(
      <InputSystemPreview
        formData={{
          pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
          heatPumpEnabled: true,
          heatPumpTechnology: "luftwasser",
          evEnabled: true,
          backupReserveKwh: 2,
        }}
      />
    );

    expect(html).toContain("sg-preview-pin");
    expect(html).toContain("sg-preview-scene");
    expect(html).toContain("02");
    expect(html).toContain("Ihre Systemkonfiguration");
    expect(html).not.toContain("02 /");
    expect(html).toContain("bg-accent");
    expect(html).toContain("PV · 10 kWp");
    expect(html).not.toContain("Vorschau der ausgewählten Komponenten");
    expect(html).not.toContain("Ausrichtung / Neigung");
    expect(html).not.toContain("Haushalt");
  });

  it("keeps the scene and chips without a heat pump until a type is chosen", () => {
    const html = renderToStaticMarkup(
      <InputSystemPreview
        formData={{
          pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
          heatPumpEnabled: true,
        }}
      />
    );

    expect(html).toContain("sg-preview-scene");
    expect(html).toContain("PV · 10 kWp");
    expect(html).toContain('data-heat-pump="true"');
    expect(html).toContain('data-heat-pump-kind="generic"');
    expect(html).not.toContain("Wärmepumpe");
    expect(html).not.toContain("sg-scene-hp");
    expect(html).not.toContain(SYSTEM_SCENE_HP_NEUTRAL_SRC);
    expect(html).not.toContain(SYSTEM_SCENE_HP_LUFTWASSER_SRC);
    expect(html).not.toContain(SYSTEM_SCENE_HP_WASSERWASSER_SRC);
  });
});
