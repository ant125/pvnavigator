import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import TarifeAbgebrochenPage from "./page";

describe("former checkout return page", () => {
  it("does not announce a tariff or a payment", () => {
    const html = renderToStaticMarkup(<TarifeAbgebrochenPage />);
    expect(html).toContain("PVNAVIGATOR_ ist kostenlos");
    expect(html).toContain("Ein Bezahlvorgang ist nicht erforderlich.");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("/tarife");
    expect(html).not.toContain("PRO ist aktiv");
    expect(html).not.toContain("Zahlung bestätigt");
    expect(html).not.toContain("Zu PRO wechseln");
    expect(html).not.toContain("€");
  });
});
