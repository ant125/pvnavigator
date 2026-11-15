import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

import { AdminFeedbackThreadView } from "@/components/admin/AdminFeedbackViews";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackList } from "@/components/feedback/FeedbackList";
import type { AdminFeedbackThread, FeedbackThreadSummary } from "@/lib/feedback";

const calculationId = "00000000-0000-4000-8000-000000000001";
const threadId = "00000000-0000-4000-8000-000000000010";
const userId = "00000000-0000-4000-8000-0000000000aa";

const summary: FeedbackThreadSummary = {
  id: threadId,
  productKey: "speicher_grenze",
  category: "verbesserung",
  subject: "Vergleich klarer machen",
  status: "beantwortet",
  calculationId,
  createdAt: "2026-11-14T18:00:00.000Z",
  updatedAt: "2026-11-14T19:00:00.000Z",
  unread: true,
};

describe("feedback form", () => {
  it("offers the two current products and asks for a calculation only for SPEICHERGRENZE", () => {
    const empty = renderToStaticMarkup(<FeedbackForm calculations={[]} />);
    expect(empty).toContain("SPEICHERGRENZE");
    expect(empty).toContain("PVNAVIGATOR_ / Allgemeine Idee");
    expect(empty).toContain("Fehler melden");
    expect(empty).toContain("Verbesserung vorschlagen");
    expect(empty).toContain("Anfrage senden");
    expect(empty).not.toContain("RENDITEGUIDE");
    expect(empty).not.toContain("wirtschaftlichkeit");
    expect(empty).not.toContain("Berechnung auswählen");

    const withCalculation = renderToStaticMarkup(
      <FeedbackForm calculations={[{ id: calculationId, label: "Musterstraße 1" }]} initialProduct="speicher_grenze" />,
    );
    expect(withCalculation).toContain("Berechnung auswählen");
    expect(withCalculation).toContain("Musterstraße 1");
    expect(withCalculation).toContain("Keine Berechnung");
  });
});

describe("feedback list", () => {
  it("links an unread request and states an empty history", () => {
    const empty = renderToStaticMarkup(<FeedbackList threads={[]} />);
    expect(empty).toContain("Sie haben noch keine Anfragen.");
    const html = renderToStaticMarkup(<FeedbackList threads={[summary]} />);
    expect(html).toContain(`href="/feedback/${threadId}"`);
    expect(html).toContain("Neue Antwort");
    expect(html).toContain("SPEICHERGRENZE");
  });
});

describe("administrator feedback", () => {
  const thread: AdminFeedbackThread = {
    ...summary,
    userId,
    email: "person@example.com",
    displayName: "Ada Lovelace",
    accountKind: "privat",
    batteryModelVersion: "1.1.0",
    inputSchemaVersion: "1",
    resultSchemaVersion: "1",
    messages: [{
      id: "00000000-0000-4000-8000-000000000021",
      body: "Die Anzeige springt.",
      authorRole: "user",
      createdAt: "2026-11-14T18:30:00.000Z",
    }, {
      id: "00000000-0000-4000-8000-000000000020",
      body: "Wir prüfen das.",
      authorRole: "admin",
      createdAt: "2026-11-14T19:00:00.000Z",
    }],
  };

  it("shows the calculation id and the profile without a report", () => {
    const html = renderToStaticMarkup(
      <AdminFeedbackThreadView thread={thread} wasUnread={false} />,
    );
    expect(html).toContain(calculationId);
    expect(html).toContain("person@example.com");
    expect(html).toContain(`href="/admin/nutzer/${userId}"`);
    expect(html).toContain("Profil öffnen");
    expect(html).toContain("Status speichern");
    expect(html).toContain("Erledigt");
    expect(html).toContain("Details anzeigen");
    expect(html).toContain("Rechenkern 1.1.0");
    expect(html.indexOf("is-user")).toBeLessThan(html.indexOf("is-support"));
    expect(html).toContain("Nutzer");
    expect(html).toContain("Support");
    expect(html).toContain("Senden");
    expect(html).toContain('rows="3"');
    expect(html).not.toContain("/result/");
    expect(html).not.toContain(".pdf");
    expect(html).not.toContain("result_snapshot");
  });
});
