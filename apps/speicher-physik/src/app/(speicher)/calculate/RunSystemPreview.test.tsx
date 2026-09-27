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
  it("summarises the selected components under the column header", () => {
    const html = renderToStaticMarkup(<RunSystemPreview formData={FULL_FORM} />);

    expect(html).toContain("02");
    expect(html).toContain("Ihre Systemkonfiguration");
    expect(html).not.toContain("02 /");
    expect(html).toContain("bg-accent");
    expect(html).toContain("rounded-none border border-line");
    expect(html).toContain("PV · 10 kWp");
    expect(html).toContain("Wärmepumpe · Luft/Wasser");
    expect(html).toContain("Elektroauto");
    expect(html).toContain("Notstrom · 2 kWh");
    expect(html).not.toContain("sg-preview-pin");
  });

  it("drops the scene, its toggle and the scene note while the calculation runs", () => {
    const html = renderToStaticMarkup(<RunSystemPreview formData={FULL_FORM} />);

    expect(html).not.toContain("Szene anzeigen");
    expect(html).not.toContain("Szene ausblenden");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("sg-scene-frame");
    expect(html).not.toContain("/system-scene/");
    expect(html).not.toContain("Schematische Darstellung");
    expect(html).not.toContain("hidden=");
  });

  it("omits components that are not part of the input", () => {
    const html = renderToStaticMarkup(
      <RunSystemPreview
        formData={{
          pvSurfaces: [{ systemSizeKwP: 10, tiltDeg: 30, azimuthDeg: 180 }],
          heatPumpEnabled: true,
        }}
      />
    );

    expect(html).toContain("PV · 10 kWp");
    expect(html).not.toContain("Wärmepumpe");
    expect(html).not.toContain("Elektroauto");
    expect(html).not.toContain("Notstrom");
  });
});
