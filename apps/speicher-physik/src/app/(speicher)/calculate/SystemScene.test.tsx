import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SystemScene } from "./SystemScene";

describe("SystemScene layers", () => {
  it("keeps the house and indoor battery in the base scene", () => {
    const html = renderToStaticMarkup(
      <SystemScene heatPump={false} heatPumpKind="generic" ev={false} backupReserve={false} />
    );
    expect(html).toContain("Speicher");
    expect(html).not.toContain("Wärmepumpe");
    expect(html).not.toContain("Elektroauto");
  });

  it("can show heat pump, EV, and backup independently", () => {
    const hp = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="luftwasser" ev={false} backupReserve={false} />
    );
    const ev = renderToStaticMarkup(
      <SystemScene heatPump={false} heatPumpKind="generic" ev backupReserve={false} />
    );
    const both = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="wasserwasser" ev backupReserve />
    );

    expect(hp).toContain("Wärmepumpe");
    expect(hp).not.toContain("Elektroauto");
    expect(ev).toContain("Elektroauto");
    expect(ev).not.toContain("Wärmepumpe");
    expect(both).toContain("Wärmepumpe");
    expect(both).toContain("Elektroauto");
    expect(both).toContain("heat-pump-wasserwasser");
  });

  it("does not use an outdoor fan for Wasser/Wasser", () => {
    const luft = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="luftwasser" ev={false} backupReserve={false} />
    );
    const wasser = renderToStaticMarkup(
      <SystemScene heatPump heatPumpKind="wasserwasser" ev={false} backupReserve={false} />
    );
    expect(luft).toContain("heat-pump-luftwasser");
    expect(wasser).toContain("heat-pump-wasserwasser");
    expect(wasser).not.toContain("heat-pump-luftwasser");
  });
});
