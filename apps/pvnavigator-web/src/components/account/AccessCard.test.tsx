import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AccessCard } from "./AccessCard";

describe("AccessCard", () => {
  it("shows unlimited free access without tariffs, prices or checkout", () => {
    const html = renderToStaticMarkup(<AccessCard />);
    expect(html).toContain("Kostenloser Zugang");
    expect(html).toContain("Kostenlos");
    expect(html).toContain("Beliebig viele unterschiedliche Adressen.");
    expect(html).toContain("PDF-Berichte sind enthalten.");
    expect(html).toContain("Auch die gewerbliche Nutzung ist kostenlos.");
    expect(html).toContain("Gespeicherte Berechnungen und Berichte bleiben in Ihrem Konto.");
    expect(html).not.toContain("/tarife");
    expect(html).not.toContain("Tarife");
    expect(html).not.toContain("STARTER");
    expect(html).not.toContain("ABO");
    expect(html).not.toContain("PRO");
    expect(html).not.toContain("€");
    expect(html).not.toContain("/api/billing");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<button");
    expect(html).not.toMatch(/Upgrade|Checkout|Abo verwalten/i);
  });
});
