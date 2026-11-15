import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/actions/trustpilot", () => ({
  recordTrustpilotClick: vi.fn(async () => "saved"),
  recordTrustpilotShown: vi.fn(async () => {}),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/konto",
  useRouter: () => ({ replace: () => undefined, refresh: () => undefined }),
}));

import { AccountCalculations } from "./AccountCalculations";
import { AccountOverview } from "./AccountOverview";
import { AccountShell } from "./AccountShell";
import { ProfilePanel } from "./ProfilePanel";

const calculateUrl = "https://speicher.pvnavigator.de/calculate";
const savedCalculation = {
  id: "00000000-0000-4000-8000-000000000001",
  product_key: "speicher_grenze",
  name: "Beispiel",
  summary_address: null,
  summary_pv_kwp: 8,
  summary_consumption_kwh: 4000,
  created_at: "2026-11-01",
  updated_at: "2026-11-01",
};
const props = {
  calculations: [],
  hasInvoices: false,
  calculateUrl,
};

describe("account overview", () => {
  it("summarises an empty account without the full lists", () => {
    const html = renderToStaticMarkup(<AccountShell title="Übersicht" unread={0}><AccountOverview {...props} /></AccountShell>);
    expect(html).toContain("Übersicht");
    expect(html).toContain("Meine Berechnungen");
    expect(html).toContain("Feedback &amp; Support");
    expect(html).toContain("Persönliche Daten");
    expect(html).toContain("Neue Anfrage");
    expect(html).toContain(calculateUrl);
    expect(html).toContain('href="/konto/berechnungen"');
    expect(html).toContain('href="/feedback"');
    expect(html).toContain("Kostenloser Zugang");
    expect(html).not.toContain("Noch keine Berechnungen");
    expect(html).not.toContain("Sie haben noch keine Anfragen.");
    expect(html).not.toContain("Vorname");
    expect(html).not.toContain("/api/billing/invoices");
  });

  it("distinguishes a failed request from an empty account", () => {
    const html = renderToStaticMarkup(<AccountOverview {...props} loadError feedbackError />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Die Berechnungen konnten nicht geladen werden");
    expect(html).toContain("Nicht geladen");
    expect(html).not.toContain("Noch keine Berechnungen");
  });

  it("links recent reports and keeps invoice access", () => {
    const html = renderToStaticMarkup(<AccountOverview {...props} hasInvoices calculations={[savedCalculation]} feedbackUnread={2} feedbackThreads={[{
      id: "00000000-0000-4000-8000-000000000010",
      productKey: "speicher_grenze",
      category: "fehler",
      subject: "Anzeige prüfen",
      status: "neu",
      calculationId: null,
      createdAt: "2026-11-14T18:00:00.000Z",
      updatedAt: "2026-11-14T18:00:00.000Z",
      unread: true,
    }]} />);
    expect(html).toContain("00000000-0000-4000-8000-000000000001");
    expect(html).toContain("Beispiel");
    expect(html).toContain("Anzeige prüfen");
    expect(html).toContain("2");
    expect(html).toContain("/api/billing/invoices");
    expect(html).not.toContain("Ihre Meinung ist uns wichtig!");
    expect(html).not.toContain("Profil speichern");
  });

  it("shows the Administration entry only to an administrator", () => {
    for (const html of [renderToStaticMarkup(<AccountOverview {...props} />), renderToStaticMarkup(<AccountOverview {...props} isAdmin={false} />)]) {
      expect(html).not.toContain("Administration");
      expect(html).not.toContain('href="/admin"');
    }
    const html = renderToStaticMarkup(<AccountOverview {...props} isAdmin />);
    expect(html).toContain("Administration");
    expect(html).toContain('href="/admin"');
    expect(html).toContain(calculateUrl);
  });
});

describe("saved calculations", () => {
  it("keeps the report list, the empty state and the Trustpilot invitation", () => {
    const empty = renderToStaticMarkup(<AccountCalculations calculations={[]} calculateUrl={calculateUrl} />);
    expect(empty).toContain("Noch keine Berechnungen");
    expect(empty).toContain(calculateUrl);
    expect(empty).not.toContain("Ihre Meinung ist uns wichtig!");

    const html = renderToStaticMarkup(
      <AccountCalculations calculations={[savedCalculation]} calculateUrl={calculateUrl} trustpilotShow trustpilotRecordShown />,
    );
    expect(html.indexOf("Meine Berechnungen")).toBeLessThan(html.indexOf("Ihre Meinung ist uns wichtig!"));
    expect(html).toContain("Hat Ihnen SPEICHERGRENZE bei Ihrer Planung geholfen?");
    expect(html).toContain('href="https://www.trustpilot.com/review/pvnavigator.de"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Auf Trustpilot bewerten");
    expect(html).toContain("00000000-0000-4000-8000-000000000001");
    expect(html).not.toContain("widget.trustpilot.com");

    const failed = renderToStaticMarkup(<AccountCalculations calculations={[]} calculateUrl={calculateUrl} loadError trustpilotShow />);
    expect(failed).toContain('role="alert"');
    expect(failed).not.toContain("Noch keine Berechnungen");
    expect(failed).not.toContain("Ihre Meinung ist uns wichtig!");
  });
});

describe("profile panel", () => {
  it("asks for the missing profile instead of treating an empty row as complete", () => {
    const html = renderToStaticMarkup(<ProfilePanel email="demo@example.de" profile={{ accountKind: null, givenName: "", familyName: "", companyName: "" }} />);
    expect(html).toContain("Bitte ergänzen Sie Ihr Profil");
    expect(html).toContain('action="/konto/profil/speichern"');
    expect(html).toContain("Privatperson");
    expect(html).toContain("Unternehmen");
    expect(html).toContain("demo@example.de");
    expect(html).not.toContain("Profil bearbeiten");
  });

  it("shows a saved profile and returns to that card after saving", () => {
    const html = renderToStaticMarkup(<ProfilePanel email="demo@example.de" profile={{ accountKind: "unternehmen", givenName: "Grace", familyName: "Hopper", companyName: "Analytical Engines GmbH" }} status="saved" />);
    expect(html).toContain("Grace Hopper");
    expect(html).toContain("Analytical Engines GmbH");
    expect(html).toContain("Unternehmen");
    expect(html).toContain("demo@example.de");
    expect(html).toContain("Profil gespeichert.");
    expect(html).toContain("Profil bearbeiten");
    expect(html).not.toContain("Bitte ergänzen Sie Ihr Profil");
    expect(html).not.toContain("Profil speichern");
  });

  it("keeps the saved values available when a save is rejected", () => {
    const html = renderToStaticMarkup(<ProfilePanel email="demo@example.de" profile={{ accountKind: "privat", givenName: "Ada", familyName: "Lovelace", companyName: "" }} status="invalid" />);
    expect(html).toContain("Bitte füllen Sie alle Pflichtfelder aus.");
    expect(html).toContain('value="Ada"');
    expect(html).toContain('value="Lovelace"');
    expect(html).toContain("checked");
  });
});
