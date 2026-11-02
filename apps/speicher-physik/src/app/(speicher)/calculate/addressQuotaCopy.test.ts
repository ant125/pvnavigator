import { describe, expect, it } from "vitest";

import { PAID_PLANS } from "@pv-access/core";

import { paidQuotaNotice } from "./addressQuotaCopy";

describe("paidQuotaNotice", () => {
  it("names STARTER and the two higher tariffs", () => {
    const copy = paidQuotaNotice(PAID_PLANS.starter.addressLimit);
    expect(copy.title).toBe("Ihr Adresskontingent ist ausgeschöpft");
    expect(copy.paragraphs[0]).toBe("Sie haben alle 10 Adressen Ihres STARTER-Tarifs genutzt.");
    expect(copy.paragraphs[1]).toContain("anderen Einstellungen neu berechnen");
    expect(copy.paragraphs[2]).toBe("Für weitere Adressen können Sie zu ABO oder PRO wechseln.");
    expect(copy.paragraphs.join(" ")).not.toMatch(/kostenlos/i);
  });

  it("names ABO and only PRO as the next tariff", () => {
    const copy = paidQuotaNotice(PAID_PLANS.abo.addressLimit);
    expect(copy.paragraphs[0]).toBe("Sie haben alle 50 Adressen Ihres ABO-Tarifs genutzt.");
    expect(copy.paragraphs[2]).toBe("Für weitere Adressen können Sie zu PRO wechseln.");
  });

  it("names PRO without offering a higher tariff", () => {
    const copy = paidQuotaNotice(PAID_PLANS.pro.addressLimit);
    expect(copy.paragraphs[0]).toBe("Sie haben alle 200 Adressen Ihres PRO-Tarifs genutzt.");
    expect(copy.paragraphs[2]).toBe(
      "Neue Adressen sind erst im nächsten Abrechnungszeitraum wieder verfügbar.",
    );
    expect(copy.paragraphs.join(" ")).not.toContain("wechseln");
  });

  it("stays generic when the limit is not a catalog tariff", () => {
    const copy = paidQuotaNotice(7);
    expect(copy.paragraphs[0]).toBe("Sie haben alle 7 Adressen Ihres Tarifs genutzt.");
    expect(copy.paragraphs.join(" ")).not.toContain("STARTER");
  });
});
