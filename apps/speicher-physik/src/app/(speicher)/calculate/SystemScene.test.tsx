import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SYSTEM_SCENE_BASE_SRC,
  SYSTEM_SCENE_EV_SRC,
  SYSTEM_SCENE_HP_LUFTWASSER_SRC,
  SYSTEM_SCENE_HP_NEUTRAL_SRC,
  SYSTEM_SCENE_HP_WASSERWASSER_SRC,
  SystemScene,
  systemSceneFromForm,
} from "./SystemScene";

describe("SystemScene layers", () => {
  it("keeps the house asset in the base scene without equipment", () => {
    const html = renderToStaticMarkup(
      <SystemScene heatPump={false} heatPumpKind="generic" ev={false} backupReserve={false} />
    );
    expect(html).toContain(SYSTEM_SCENE_BASE_SRC);
    expect(html).toContain("/system-scene/base-house-no-label.png");
    expect(html).not.toContain("./assets/");
    expect(html).toContain('data-heat-pump="false"');
    expect(html).toContain('data-ev="false"');
    expect(html).toContain('data-backup-reserve="false"');
    expect(html).not.toContain("Wärmepumpe");
    expect(html).not.toContain("Elektroauto");
    expect(html).not.toContain("Notstrom");
    expect(html).not.toContain("sg-scene-caption");
    expect(html).not.toContain(SYSTEM_SCENE_HP_LUFTWASSER_SRC);
    expect(html).not.toContain(SYSTEM_SCENE_EV_SRC);
    expect(html).not.toContain("sg-scene-pipes");
  });

  it("shows heat pump, EV, and backup independently in all 8 combinations", () => {
    const combos = [
      { heatPump: false, ev: false, backupReserve: false },
      { heatPump: true, ev: false, backupReserve: false },
      { heatPump: false, ev: true, backupReserve: false },
      { heatPump: false, ev: false, backupReserve: true },
      { heatPump: true, ev: true, backupReserve: false },
      { heatPump: true, ev: false, backupReserve: true },
      { heatPump: false, ev: true, backupReserve: true },
      { heatPump: true, ev: true, backupReserve: true },
    ] as const;

    for (const combo of combos) {
      const html = renderToStaticMarkup(
        <SystemScene
          heatPump={combo.heatPump}
          heatPumpKind="luftwasser"
          ev={combo.ev}
          backupReserve={combo.backupReserve}
        />
      );
      expect(html).toContain(SYSTEM_SCENE_BASE_SRC);
      expect(html.includes("Wärmepumpe")).toBe(combo.heatPump);
      expect(html.includes("Elektroauto")).toBe(combo.ev);
      expect(html.includes("Notstrom")).toBe(combo.backupReserve);
      expect(html.includes(SYSTEM_SCENE_HP_LUFTWASSER_SRC)).toBe(combo.heatPump);
      expect(html.includes(SYSTEM_SCENE_EV_SRC)).toBe(combo.ev);
      expect(html.includes("sg-scene-backup")).toBe(combo.backupReserve);
      expect(html.includes("sg-scene-pipes")).toBe(combo.heatPump);
    }
  });

  it("uses distinct pump assets and slots for Luft/Wasser, Wasser/Wasser, and generic", () => {
    const luft = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="luftwasser" ev={false} backupReserve={false} />
    );
    const wasser = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="wasserwasser" ev={false} backupReserve={false} />
    );
    const generic = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="generic" ev={false} backupReserve={false} />
    );
    expect(luft).toContain("heat-pump-luftwasser");
    expect(luft).toContain("sg-scene-hp-luftwasser");
    expect(luft).toContain(SYSTEM_SCENE_HP_LUFTWASSER_SRC);
    expect(luft).toContain("sg-scene-pipes");
    expect(wasser).toContain("heat-pump-wasserwasser");
    expect(wasser).toContain("sg-scene-hp-wasserwasser");
    expect(wasser).toContain(SYSTEM_SCENE_HP_WASSERWASSER_SRC);
    expect(wasser).not.toContain(SYSTEM_SCENE_HP_LUFTWASSER_SRC);
    expect(wasser).not.toContain(SYSTEM_SCENE_HP_NEUTRAL_SRC);
    expect(wasser).not.toContain("sg-scene-pipes");
    expect(generic).toContain("sg-scene-hp-generic");
    expect(generic).toContain(SYSTEM_SCENE_HP_NEUTRAL_SRC);
    expect(generic).not.toContain(SYSTEM_SCENE_HP_WASSERWASSER_SRC);
    expect(generic).not.toContain("sg-scene-pipes");
  });

  it("keeps Notstrom as a scene-level badge independent of pump kind", () => {
    const withLuft = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="luftwasser" ev={false} backupReserve />
    );
    const withWasser = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="wasserwasser" ev={false} backupReserve />
    );
    const withoutPump = renderToStaticMarkup(
      <SystemScene heatPump={false} heatPumpKind="generic" ev={false} backupReserve />
    );
    for (const html of [withLuft, withWasser, withoutPump]) {
      expect(html).toContain('data-testid="backup-badge"');
      expect(html).toContain("sg-scene-backup");
    }
  });

  it("maps form flags without inventing extra scene state", () => {
    expect(
      systemSceneFromForm({
        heatPumpEnabled: true,
        heatPumpTechnology: "luftwasser",
        evEnabled: true,
        backupReserveKwh: 2,
      })
    ).toEqual({
      heatPump: true,
      heatPumpKind: "luftwasser",
      ev: true,
      backupReserve: true,
    });
    expect(
      systemSceneFromForm({
        heatPumpEnabled: true,
        heatPumpTechnology: "wasserwasser",
        evEnabled: false,
        backupReserveKwh: 0,
      })
    ).toEqual({
      heatPump: true,
      heatPumpKind: "wasserwasser",
      ev: false,
      backupReserve: false,
    });
    expect(
      systemSceneFromForm({
        heatPumpEnabled: false,
        evEnabled: false,
        backupReserveKwh: 0,
      })
    ).toEqual({
      heatPump: false,
      heatPumpKind: "generic",
      ev: false,
      backupReserve: false,
    });
  });
});
