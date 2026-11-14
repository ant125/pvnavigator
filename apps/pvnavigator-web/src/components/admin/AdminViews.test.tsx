import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminDashboardView, AdminUserCardView, AdminUserListView } from "./AdminViews";
import type { AdminDashboard, AdminUserCard, AdminUserList, UserListQuery } from "@/lib/adminOverview";

const series = Array.from({ length: 30 }, (_, index) => ({
  day: `2026-10-${String(index + 1).padStart(2, "0")}`,
  count: 0,
}));

const dashboard: AdminDashboard = {
  users: 4,
  unternehmen: 0,
  calculations: 12,
  today: 0,
  week: 1,
  month: 2,
  series,
};

const query: UserListQuery = { q: "", art: "alle", sort: "registrierung", richtung: "ab", seite: 1 };

const list: AdminUserList = {
  total: 0,
  page: 1,
  pageSize: 20,
  users: [],
};

const card: AdminUserCard = {
  user: {
    id: "00000000-0000-4000-8000-0000000000aa",
    displayName: null,
    email: "person@example.com",
    accountKind: "nicht_angegeben",
    registeredAt: "2026-05-15T08:00:00.000Z",
    calculationCount: 1,
    lastCalculationAt: "2026-11-01T10:00:00.000Z",
  },
  page: 1,
  pageSize: 10,
  calculations: [{
    createdAt: "2026-11-01T10:00:00.000Z",
    address: null,
    pvKwp: null,
    consumptionKwh: 4000,
    pvYieldKwh: null,
    speichergrenzeKwh: null,
  }],
};

describe("administrator views", () => {
  it("shows the totals in the required order and keeps empty days", () => {
    const html = renderToStaticMarkup(<AdminDashboardView data={dashboard} />);
    const labels = ["Nutzer", "Unternehmen", "Berechnungen", "Heute", "Diese Woche", "Dieser Monat"];
    let position = -1;
    for (const label of labels) {
      const next = html.indexOf(`>${label}<`);
      expect(next).toBeGreaterThan(position);
      position = next;
    }
    expect(html).toContain("01.10.2026: 0");
    expect(html).toContain("30.10.2026: 0");
  });

  it("shows an empty selection without inventing users", () => {
    const html = renderToStaticMarkup(<AdminUserListView query={{ ...query, art: "unternehmen" }} data={list} />);
    expect(html).toContain("Keine Nutzer für diese Auswahl.");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Unternehmen");
  });

  it("shows a calculation without a report or PDF link", () => {
    const html = renderToStaticMarkup(<AdminUserCardView data={card} />);
    expect(html).toContain("Nicht angegeben");
    expect(html).toContain("Nicht gespeichert");
    expect(html).toContain("4.000 kWh/a");
    expect(html).toContain("Technische Speichergrenze");
    expect(html).not.toContain("/result/");
    expect(html).not.toContain(".pdf");
  });
});