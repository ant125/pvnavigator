import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

type RpcAnswer = { data: unknown; error: { message: string; code?: string } | null };

const { session, getUser, rpc, createClient } = vi.hoisted(() => {
  const session = {
    configured: true,
    user: null as { id: string; email: string } | null,
    role: { data: false, error: null } as RpcAnswer,
    dashboard: { data: null, error: { message: "missing" } } as RpcAnswer,
    list: { data: null, error: { message: "missing" } } as RpcAnswer,
    card: { data: null, error: { message: "missing" } } as RpcAnswer,
  };
  const getUser = vi.fn(async () => ({ data: { user: session.user } }));
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "is_admin") return session.role;
    if (fn === "admin_dashboard") return session.dashboard;
    if (fn === "admin_list_users") return session.list;
    if (fn === "admin_user_card") return session.card;
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  const createClient = vi.fn(async () => ({ auth: { getUser }, rpc }));
  return { session, getUser, rpc, createClient };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => session.configured,
  createServerSupabaseClient: createClient,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin",
}));

import { getAdminUser, isAdminSession } from "@/lib/admin";

import AdminLayout, { generateMetadata } from "./layout";
import AdminPage from "./page";
import AdminUsersPage from "./nutzer/page";
import AdminUserPage from "./nutzer/[id]/page";

const ordinaryUser = { id: "user-1", email: "person@example.com" };
const adminUser = { id: "admin-1", email: "admin@example.com" };

beforeEach(() => {
  session.configured = true;
  session.user = null;
  session.role = { data: false, error: null };
  session.dashboard = { data: null, error: { message: "missing" } };
  session.list = { data: null, error: { message: "missing" } };
  session.card = { data: null, error: { message: "missing" } };
  getUser.mockClear();
  rpc.mockClear();
  createClient.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("administrator role check", () => {
  it("accepts only the database's explicit true", async () => {
    for (const data of [false, null, undefined, "true", 1, {}, [true]]) {
      session.role = { data, error: null };
      expect(await isAdminSession({ rpc })).toBe(false);
    }
    session.role = { data: true, error: null };
    expect(await isAdminSession({ rpc })).toBe(true);
    expect(rpc).toHaveBeenCalledWith("is_admin");
  });

  it("treats a failed check as no administrator", async () => {
    session.role = { data: true, error: { message: "PGRST202" } };
    expect(await isAdminSession({ rpc })).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("does not ask for a role without a signed-in user", async () => {
    session.role = { data: true, error: null };
    expect(await getAdminUser()).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not touch Supabase when it is not configured", async () => {
    session.configured = false;
    session.user = adminUser;
    session.role = { data: true, error: null };
    expect(await getAdminUser()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("/admin", () => {
  const layout = () => AdminLayout({ children: <p>inner</p> });

  it("answers 404 to a visitor", async () => {
    await expect(layout()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers 404 to a signed-in account without the role", async () => {
    session.user = ordinaryUser;
    await expect(layout()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(rpc).toHaveBeenCalledWith("is_admin");
  });

  it("answers 404 when the role cannot be checked", async () => {
    session.user = adminUser;
    session.role = { data: null, error: { message: "database unavailable" } };
    await expect(layout()).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("does not take the role from the account's e-mail address", async () => {
    session.user = { id: "user-2", email: adminUser.email };
    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("does not name the area in the 404 metadata", async () => {
    expect(await generateMetadata()).toEqual({});
    session.user = ordinaryUser;
    expect(await generateMetadata()).toEqual({});
  });

  it("opens for an administrator", async () => {
    session.user = adminUser;
    session.role = { data: true, error: null };
    expect(await generateMetadata()).toMatchObject({
      title: "Administration | PVNAVIGATOR_",
      robots: { index: false, follow: false },
    });
    expect(renderToStaticMarkup(await layout())).toContain("inner");
    session.dashboard = {
      data: {
        users: 4,
        unternehmen: 0,
        calculations: 42,
        today: 1,
        week: 3,
        month: 10,
        trustpilot_shown: 4,
        trustpilot_clicked: 1,
        series: Array.from({ length: 30 }, (_, index) => ({
          day: `2026-10-${String(index + 1).padStart(2, "0")}`,
          count: index === 4 ? 0 : 1,
        })),
      },
      error: null,
    };
    const html = renderToStaticMarkup(await AdminPage());
    expect(html.indexOf(">Nutzer<")).toBeGreaterThan(-1);
    expect(html.indexOf(">Nutzer<")).toBeLessThan(html.indexOf(">Unternehmen<"));
    expect(html.indexOf(">Unternehmen<")).toBeLessThan(html.indexOf(">Berechnungen<"));
    expect(html.indexOf(">Heute<")).toBeLessThan(html.indexOf(">Diese Woche<"));
    expect(html.indexOf(">Diese Woche<")).toBeLessThan(html.indexOf(">Dieser Monat<"));
    expect(html).toContain("Berechnungsaktivität");
    expect(html).toContain("Einladung angezeigt");
    expect(html).toContain("25 %");
    expect(html).not.toContain("Bewertung abgegeben");
    expect(html).toContain("PVNAVIGATOR_");
    expect(html).toContain('href="/konto"');
    expect(html).toContain("05.10.2026: 0");
    expect(rpc).toHaveBeenCalledWith("admin_dashboard");
  });
});

const userId = "00000000-0000-4000-8000-0000000000aa";

describe("administrator pages", () => {
  it("answers 404 to a visitor on the user list and the user card", async () => {
    await expect(AdminUsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(AdminUserPage({
      params: Promise.resolve({ id: userId }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(rpc).not.toHaveBeenCalledWith("admin_list_users", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("admin_user_card", expect.anything());
  });

  it("does not name a user in the metadata", async () => {
    expect(await (await import("./nutzer/page")).generateMetadata()).toEqual({});
    expect(await (await import("./nutzer/[id]/page")).generateMetadata()).toEqual({});
  });

  it("answers 404 for a malformed user id without asking the database", async () => {
    session.user = adminUser;
    session.role = { data: true, error: null };
    await expect(AdminUserPage({
      params: Promise.resolve({ id: "not-a-user" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(rpc).not.toHaveBeenCalledWith("admin_user_card", expect.anything());
  });

  it("shows one page of accounts and no report link", async () => {
    session.user = adminUser;
    session.role = { data: true, error: null };
    session.list = {
      data: {
        total: 1,
        page: 1,
        page_size: 20,
        users: [{
          id: userId,
          display_name: null,
          email: "person@example.com",
          account_kind: "nicht_angegeben",
          registered_at: "2026-05-15T10:00:00.000Z",
          calculation_count: 2,
          last_calculation_at: null,
        }],
      },
      error: null,
    };
    const html = renderToStaticMarkup(await AdminUsersPage({ searchParams: Promise.resolve({ art: "firma" }) }));
    expect(html).toContain("Nicht angegeben");
    expect(html).toContain("person@example.com");
    expect(html).toContain("Keine");
    expect(html).not.toContain("/result/");
    expect(html).not.toContain(".pdf");
  });
});
