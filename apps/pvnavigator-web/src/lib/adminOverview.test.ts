import { describe, expect, it } from "vitest";

import {
  formatAdminDateTime,
  formatAdminDay,
  formatAdminRate,
  parseAdminDashboard,
  parseAdminUserCard,
  parseUserListQuery,
  userListHref,
} from "./adminOverview";

const series = Array.from({ length: 30 }, (_, index) => ({
  day: `2026-10-${String(index + 1).padStart(2, "0")}`,
  count: index === 0 ? 0 : 1,
}));

describe("administrator overview", () => {
  it("keeps search, filters and pages inside the admin list", () => {
    const query = parseUserListQuery({
      q: "  Muster GmbH  ",
      art: "privat",
      sort: "aktivitaet",
      richtung: "auf",
      seite: "3",
    });
    expect(query).toEqual({
      q: "Muster GmbH",
      art: "privat",
      sort: "aktivitaet",
      richtung: "auf",
      seite: 3,
    });
    expect(userListHref(query, { art: "unternehmen", seite: 1 })).toBe(
      "/admin/nutzer?q=Muster+GmbH&art=unternehmen&sort=aktivitaet&richtung=auf",
    );
    expect(parseUserListQuery({ art: "firma", seite: "0" })).toMatchObject({ art: "alle", seite: 1 });
  });

  it("rejects a dashboard that drops an empty day", () => {
    expect(parseAdminDashboard({
      users: 1, unternehmen: 0, calculations: 1, today: 0, week: 0, month: 0,
      trustpilot_shown: 0, trustpilot_clicked: 0, series: series.slice(1),
    })).toBeNull();
    expect(parseAdminDashboard({
      users: 1, unternehmen: 0, calculations: 1, today: 0, week: 0, month: 0, series,
    })).toBeNull();
    const dashboard = parseAdminDashboard({
      users: 1, unternehmen: 0, calculations: 1, today: 0, week: 0, month: 0,
      trustpilot_shown: 4, trustpilot_clicked: 1, series,
    });
    expect(dashboard?.series[0]).toEqual({ day: "2026-10-01", count: 0 });
    expect(dashboard?.trustpilotShown).toBe(4);
    expect(dashboard?.trustpilotClicked).toBe(1);
    expect(formatAdminRate(0, 0)).toBe("—");
    expect(formatAdminRate(4, 1)).toBe("25 %");
    expect(formatAdminRate(3, 1)).toBe("33,3 %");
  });

  it("keeps only the calculation fields the card shows", () => {
    const card = parseAdminUserCard({
      user: {
        id: "00000000-0000-4000-8000-0000000000aa",
        display_name: "  ",
        email: "person@example.com",
        account_kind: "nicht_angegeben",
        registered_at: "2026-11-14T23:30:00.000Z",
        calculation_count: 1,
        last_calculation_at: null,
        encrypted_password: "secret",
      },
      page: 1,
      page_size: 10,
      calculations: [{
        created_at: "2026-11-14T23:30:00.000Z",
        address: "Bühne 1",
        pv_kwp: 9.5,
        consumption_kwh: 4200,
        pv_yield_kwh: null,
        speichergrenze_kwh: 7.5,
        result_snapshot: { kernel: "secret" },
      }],
    });
    expect(card?.user.displayName).toBeNull();
    const withoutActivity = parseAdminUserCard({
      user: {
        id: "00000000-0000-4000-8000-0000000000aa",
        display_name: null,
        email: "person@example.com",
        account_kind: "nicht_angegeben",
        registered_at: "2026-11-14T23:30:00.000Z",
        calculation_count: 0,
      },
      page: 1,
      page_size: 10,
      calculations: [],
    });
    expect(withoutActivity?.user.lastCalculationAt).toBeNull();
    expect(card?.calculations[0]).toEqual({
      createdAt: "2026-11-14T23:30:00.000Z",
      address: "Bühne 1",
      pvKwp: 9.5,
      consumptionKwh: 4200,
      pvYieldKwh: null,
      speichergrenzeKwh: 7.5,
    });
    expect(JSON.stringify(card)).not.toContain("secret");
  });

  it("formats instants in Europe/Berlin", () => {
    expect(formatAdminDay("2026-11-15")).toBe("15.11.2026");
    const formatted = formatAdminDateTime("2026-11-14T23:30:00.000Z");
    expect(formatted).toContain("15.11.2026");
    expect(formatted).toContain("00:30");
    expect(formatted).not.toContain("14.11.2026");
  });
});
