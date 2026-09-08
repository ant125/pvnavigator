import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CalculationsEmptyState, CalculationsHistory } from "@/components/account/CalculationsHistory";
import {
  calculationDisplayName,
  productLabel,
  type CalculationListRow,
} from "./calculationsList";

const speicherRow: CalculationListRow = {
  id: "a",
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
    expect(productLabel("speicher_grenze")).toBe("SpeicherGrenze");
    expect(productLabel("wirtschaftlichkeit")).toBe("Wirtschaftlichkeitsanalyse");
    expect(productLabel("pvshadow")).toBe("PVShadow");
    expect(productLabel("future_tool")).toBe("future_tool");
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
    expect(html).toContain("Neue Berechnung");
    expect(html).not.toContain("Abgeschlossen");
  });
  it("renders one SpeicherGrenze row as completed history", () => {
    const html = renderToStaticMarkup(
      <CalculationsHistory rows={[speicherRow]} />,
    );
    expect(html).toContain("SpeicherGrenze");
    expect(html).toContain("Musterstraße 1, 80331 München");
    expect(html).toContain("kWp");
    expect(html).toContain("kWh/a");
    expect(html).toContain("Abgeschlossen");
    expect(html).not.toContain("Öffnen");
    expect(html).not.toContain("Noch keine Berechnungen vorhanden.");
  });

  it("renders multiple rows", () => {
    const html = renderToStaticMarkup(
      <CalculationsHistory rows={[speicherRow, secondRow]} />,
    );
    expect(html).toContain("SpeicherGrenze");
    expect(html).toContain("PVShadow");
    expect(html).toContain("Dach A");
  });
});
