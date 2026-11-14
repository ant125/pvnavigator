import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CalculationsEmptyState, CalculationsHistory } from "@/components/account/CalculationsHistory";
import {
  groupCalculations, heatPumpSummary, evSummary,
  calculationDisplayName,
  calculationResultHref,
  productLabel,
  type CalculationListRow,
} from "./calculationsList";

const speicherRow: CalculationListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  product_key: "speicher_grenze",
  name: "SpeicherGrenze",
  summary_address: "Musterstraße 1, 80331 München",
  summary_pv_kwp: 10,
  summary_consumption_kwh: 4000,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-08T10:00:00.000Z",
};

const secondRow: CalculationListRow = {
  id: "b",
  product_key: "pvshadow",
  name: "Dach A",
  summary_address: null,
  summary_pv_kwp: null,
  summary_consumption_kwh: null,
  created_at: "2026-08-01T10:00:00.000Z",
  updated_at: "2026-08-02T10:00:00.000Z",
};

describe("product_key labels", () => {
  it("maps known products without importing physics packages", () => {
    expect(productLabel("speicher_grenze")).toBe("SPEICHERGRENZE");
    expect(productLabel("wirtschaftlichkeit")).toBe("RENDITEGUIDE");
    expect(productLabel("pvshadow")).toBe("PVShadow");
    expect(productLabel("future_tool")).toBe("future_tool");
  });
});

describe("calculationResultHref", () => {
  it("links SpeicherGrenze rows to /result/[id] and leaves others unlinked", () => {
    expect(calculationResultHref(speicherRow)).toContain(
      "/result/11111111-1111-4111-8111-111111111111",
    );
    expect(calculationResultHref(secondRow)).toBeNull();
  });
});

describe("calculationDisplayName", () => {
  it("prefers the stored address, then name", () => {
    expect(calculationDisplayName(speicherRow)).toBe(
      "Musterstraße 1, 80331 München",
    );
    expect(calculationDisplayName(secondRow)).toBe("Dach A");
  });
});

describe("CalculationsHistory", () => {
  it("keeps the empty state when there are no rows", () => {
    const html = renderToStaticMarkup(
      <CalculationsEmptyState calculateUrl="https://speicher.pvnavigator.de/calculate" />,
    );
    expect(html).toContain("Noch keine Berechnungen vorhanden.");
    expect(html).toContain("Erste Berechnung starten");
    expect(html).not.toContain(">Abgeschlossen</span>");
  });
  it("renders one SpeicherGrenze row as completed history", () => {
    const html = renderToStaticMarkup(
      <CalculationsHistory rows={[speicherRow]} />,
    );
    expect(html).toContain("SPEICHERGRENZE");
    expect(html).toContain("Musterstraße 1, 80331 München");
    expect(html).toContain("kWp");
    expect(html).toContain("kWh/a");
    expect(html).toContain("Abgeschlossen");
    expect(html).toContain(
      `/result/11111111-1111-4111-8111-111111111111`,
    );
    expect(html).toContain("Bericht ansehen");
    expect(html).not.toContain("Noch keine Berechnungen vorhanden.");
  });

  it("renders multiple rows", () => {
    const html = renderToStaticMarkup(
      <CalculationsHistory rows={[speicherRow, secondRow]} />,
    );
    expect(html).toContain("SPEICHERGRENZE");
    expect(html).toContain("PVShadow");
    expect(html).toContain("Dach A");
    expect(html).not.toContain("/result/b");
    expect(html).not.toMatch(/href="[^"]*pvshadow/);
  });
});

describe("object and variant grouping", () => {
  it("groups variants by stable address key and keeps services separate", () => {
    const rows = [speicherRow, {...speicherRow,id:"variant",heat_pump_enabled:true}, {...speicherRow,id:"other-service",product_key:"wirtschaftlichkeit"}];
    const groups = groupCalculations(rows);
    expect(groups).toHaveLength(2);
    expect(groups.find(g=>g.productKey==="speicher_grenze")?.addresses[0].rows).toHaveLength(2);
    expect(groupCalculations([{...speicherRow,address_key:"one"},{...speicherRow,id:"different-label",summary_address:"Musterstr. 1",address_key:"one"}])[0].addresses).toHaveLength(1);
  });
  it("joins legacy reports to an unambiguous saved address", () => {
    expect(groupCalculations([speicherRow,{...speicherRow,id:"new",address_key:"known"}])[0].addresses).toHaveLength(1);
  });
  it("does not merge unknown objects or different explicit address keys", () => {
    expect(groupCalculations([secondRow,{...secondRow,id:"c"}])[0].addresses).toHaveLength(2);
    expect(groupCalculations([{...speicherRow,address_key:"one"},{...speicherRow,id:"two",address_key:"two"}])[0].addresses).toHaveLength(2);
  });
  it("searches case-insensitively with multiple terms and preserves variants", () => {
    const groups = groupCalculations([speicherRow,{...speicherRow,id:"variant"},secondRow],"  MÜNCHEN 80331 ");
    expect(groups).toHaveLength(1);
    expect(groups[0].addresses[0].rows).toHaveLength(2);
    expect(groupCalculations([speicherRow],"Berlin")).toEqual([]);
  });
  it("distinguishes missing equipment data from disabled equipment and keeps zero values", () => {
    expect(heatPumpSummary(speicherRow)).toBe("Nicht gespeichert");
    expect(heatPumpSummary({...speicherRow,heat_pump_enabled:false})).toBe("Ohne Wärmepumpe");
    expect(heatPumpSummary({...speicherRow,heat_pump_enabled:true,heat_pump_consumption_kwh:0})).toBe("Mit · 0 kWh/a");
    expect(evSummary({...speicherRow,ev_enabled:false})).toBe("Ohne Elektroauto");
    expect(evSummary({...speicherRow,ev_enabled:true,ev_annual_km:15000,ev_consumption_per_100km:18})).toContain("18 kWh/100 km");
  });
});
