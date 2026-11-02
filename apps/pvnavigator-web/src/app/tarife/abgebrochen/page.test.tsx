import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import TarifeAbgebrochenPage from "./page";

describe("aborted checkout", () => {
  it("does not announce a successful tariff change", () => {
    const html = renderToStaticMarkup(<TarifeAbgebrochenPage />);
    expect(html).toContain("Zahlung abgebrochen");
    expect(html).toContain("Ihr bisheriger Tarif bleibt unverändert.");
    expect(html).toContain("nicht freigeschaltet");
    expect(html).not.toContain("PRO ist aktiv");
    expect(html).not.toContain("Zahlung bestätigt");
    expect(html).not.toContain("Zu PRO wechseln");
  });
});