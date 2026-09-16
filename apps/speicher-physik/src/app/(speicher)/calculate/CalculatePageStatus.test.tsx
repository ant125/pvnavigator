import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CalculatePageStatus } from "./CalculatePageStatus";

describe("CalculatePageStatus", () => {
  it("shows the input state from the mockup, using the live status values", () => {
    const html = renderToStaticMarkup(<CalculatePageStatus status="input" />);

    expect(html).toContain("role=\"status\"");
    expect(html).toContain("Eingabe");
    expect(html).toContain("Bitte Daten eingeben");
    expect(html).not.toContain("Berechnet");
  });

  it("shows the completed calculation state with a check mark", () => {
    const html = renderToStaticMarkup(
      <CalculatePageStatus status="complete" />
    );

    expect(html).toContain("Berechnet");
    expect(html).toContain("Berechnung abgeschlossen");
    expect(html).toContain("✓");
  });

  it("keeps the real calculating, editing, and stale labels", () => {
    expect(
      renderToStaticMarkup(<CalculatePageStatus status="calculating" />)
    ).toContain("Eingabe gesperrt");
    expect(
      renderToStaticMarkup(<CalculatePageStatus status="editing" />)
    ).toContain("Eingaben aktiv");
    expect(
      renderToStaticMarkup(<CalculatePageStatus status="stale" />)
    ).toContain("Ergebnis nicht aktuell");
  });
});
