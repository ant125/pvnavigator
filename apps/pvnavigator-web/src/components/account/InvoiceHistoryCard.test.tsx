import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { InvoiceHistoryCard } from "./InvoiceHistoryCard";

describe("InvoiceHistoryCard", () => {
  it("posts to the invoice portal without a customer id or subscription action", () => {
    const html = renderToStaticMarkup(<InvoiceHistoryCard />);
    expect(html).toContain("Rechnungen");
    expect(html).toContain("Rechnungen ansehen");
    expect(html).toContain('action="/api/billing/invoices"');
    expect(html).toContain("nach Kündigung oder Ablauf");
    expect(html).not.toContain("/api/billing/portal");
    expect(html).not.toContain("/api/billing/checkout");
    expect(html).not.toContain("Abo verwalten");
    expect(html).not.toContain("name=\"customer\"");
    expect(html).not.toContain("stripe_customer");
  });
});
