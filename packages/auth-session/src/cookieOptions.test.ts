import { afterEach, describe, expect, it } from "vitest";

import {
  getAuthCookieOptions,
  isSupabaseAuthCookieName,
  rehomeAuthCookiesToParentDomain,
  resolveAuthCookieDomain,
  resolveRequestHostname,
} from "./cookieOptions";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.AUTH_COOKIE_DOMAIN;
  delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
  if (ORIGINAL_ENV.AUTH_COOKIE_DOMAIN) {
    process.env.AUTH_COOKIE_DOMAIN = ORIGINAL_ENV.AUTH_COOKIE_DOMAIN;
  }
  if (ORIGINAL_ENV.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN) {
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN =
      ORIGINAL_ENV.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
  }
  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
});

describe("resolveAuthCookieDomain", () => {
  it("uses AUTH_COOKIE_DOMAIN when set", () => {
    process.env.AUTH_COOKIE_DOMAIN = ".pvnavigator.de";
    expect(resolveAuthCookieDomain("localhost")).toBe(".pvnavigator.de");
  });

  it("prefers NEXT_PUBLIC_AUTH_COOKIE_DOMAIN", () => {
    process.env.AUTH_COOKIE_DOMAIN = ".other.test";
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = ".pvnavigator.de";
    expect(resolveAuthCookieDomain()).toBe(".pvnavigator.de");
  });

  it("infers the parent domain on pvnavigator hosts", () => {
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(resolveAuthCookieDomain("pvnavigator.de")).toBe(".pvnavigator.de");
    expect(resolveAuthCookieDomain("speicher.pvnavigator.de")).toBe(
      ".pvnavigator.de",
    );
    expect(resolveAuthCookieDomain("www.pvnavigator.de:443")).toBe(
      ".pvnavigator.de",
    );
  });

  it("omits domain on localhost and unrelated hosts", () => {
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(resolveAuthCookieDomain("localhost")).toBeUndefined();
    expect(resolveAuthCookieDomain("127.0.0.1")).toBeUndefined();
    expect(resolveAuthCookieDomain("speicher-physik.vercel.app")).toBeUndefined();
  });
});

describe("getAuthCookieOptions", () => {
  it("uses path /, sameSite lax, and no domain on localhost", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(getAuthCookieOptions("localhost")).toEqual({
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("sets secure parent-domain cookies on production hosts", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(getAuthCookieOptions("speicher.pvnavigator.de")).toEqual({
      path: "/",
      sameSite: "lax",
      secure: true,
      domain: ".pvnavigator.de",
    });
  });
});

describe("resolveRequestHostname", () => {
  it("prefers X-Forwarded-Host over Host and nextUrl hostname", () => {
    expect(
      resolveRequestHostname(
        "speicher-physik.vercel.app",
        "speicher-physik.vercel.app",
        "speicher.pvnavigator.de",
      ),
    ).toBe("speicher.pvnavigator.de");
  });

  it("uses Host when forwarded host is absent", () => {
    expect(
      resolveRequestHostname("ignored.vercel.app", "pvnavigator.de:443", null),
    ).toBe("pvnavigator.de");
  });
});

describe("isSupabaseAuthCookieName", () => {
  it("matches the project-ref token cookie and chunks", () => {
    expect(isSupabaseAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token")).toBe(
      true,
    );
    expect(
      isSupabaseAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token.0"),
    ).toBe(true);
    expect(isSupabaseAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token.1")).toBe(
      true,
    );
    expect(isSupabaseAuthCookieName("unrelated")).toBe(false);
  });
});

describe("rehomeAuthCookiesToParentDomain", () => {
  it("expires host-only copies and writes parent-domain cookies", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;

    const headers: string[] = [];
    const set: Array<{ name: string; value: string; domain?: string }> = [];

    rehomeAuthCookiesToParentDomain(
      [
        { name: "sb-ftxgcpebzrhvifjnjivm-auth-token", value: "session" },
        { name: "other", value: "skip" },
      ],
      {
        appendHeader: (_name, value) => {
          headers.push(value);
        },
        setCookie: (name, value, options) => {
          set.push({ name, value, domain: options.domain });
        },
      },
      "pvnavigator.de",
    );

    expect(headers).toHaveLength(1);
    expect(headers[0]).toContain("sb-ftxgcpebzrhvifjnjivm-auth-token=");
    expect(headers[0]).toContain("Max-Age=0");
    expect(headers[0]).not.toContain("Domain=");
    expect(set).toEqual([
      {
        name: "sb-ftxgcpebzrhvifjnjivm-auth-token",
        value: "session",
        domain: ".pvnavigator.de",
      },
    ]);
  });

  it("does nothing on localhost", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    const setCookie = () => {
      throw new Error("should not set");
    };
    rehomeAuthCookiesToParentDomain(
      [{ name: "sb-ftxgcpebzrhvifjnjivm-auth-token", value: "session" }],
      { appendHeader: setCookie, setCookie },
      "localhost",
    );
  });
});
