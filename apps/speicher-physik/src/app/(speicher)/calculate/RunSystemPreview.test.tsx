import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { RunSystemPreview } from "./RunSystemPreview";

const FULL_FORM = {
  pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
  heatPumpEnabled: true,
  heatPumpTechnology: "luftwasser" as const,
  evEnabled: true,
  backupReserveKwh: 2,
};

describe("RunSystemPreview", () => {
  it("shows chips and a collapsed scene toggle without the input sticky frame", () => {
    const html = renderToStaticMarkup(
      <RunSystemPreview
        formData={FULL_FORM}
        sceneOpen={false}
        onToggleScene={() => {}}
      />
    );

    expect(html).toContain("02 / Ihre Systemkonfiguration");
    expect(html).toContain("PV · 10 kWp");
    expect(html).toContain("Szene anzeigen");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Szene ausblenden");
    expect(html).not.toContain("sg-preview-pin");
    expect(html).not.toContain("sg-preview-scene");
    expect(html).not.toContain("sg-scene-frame");
    expect(html).not.toContain("Vorschau der ausgewählten Komponenten");
    expect(html).not.toContain("Ausrichtung / Neigung");
  });

  it("renders the house without calculation highlight when expanded", () => {
    const html = renderToStaticMarkup(
      <RunSystemPreview
        formData={FULL_FORM}
        sceneOpen
        onToggleScene={() => {}}
      />
    );

    expect(html).toContain("Szene ausblenden");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("sg-scene-frame");
    expect(html).toContain("/system-scene/base-house-no-label.png");
    expect(html).not.toContain("sg-scene-active");
    expect(html).not.toContain("sg-preview-pin");
  });
});
