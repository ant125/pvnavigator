import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

type RoleAnswer = { data: unknown; error: { message: string } | null };

const { session, getUser, rpc, createClient } = vi.hoisted(() => {
  const session = {
    configured: true,
    user: null as { id: string; email: string } | null,
    role: { data: false, error: null } as RoleAnswer,
  };
  const getUser = vi.fn(async () => ({ data: { user: session.user } }));
  const rpc = vi.fn(async () => session.role);
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
}));

import { getAdminUser, isAdminSession } from "@/lib/admin";

import AdminLayout, { generateMetadata } from "./layout";
import AdminPage from "./page";

const ordinaryUser = { id: "user-1", email: "person@example.com" };
const adminUser = { id: "admin-1", email: "admin@example.com" };

beforeEach(() => {
  session.configured = true;
  session.user = null;
  session.role = { data: false, error: null };
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
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).toContain("Administration");
    expect(html).toContain("PVNAVIGATOR_");
    expect(html).toContain(adminUser.email);
    expect(html).toContain('href="/konto"');
  });
});
