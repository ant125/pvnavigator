import { afterEach, describe, expect, it } from "vitest";

import {
  authCookiesFromDocumentCookie,
  expireHostOnlyAuthCookies,
  getAuthCookieOptions,
  isSupabaseAuthCookieName,
  rehomeAuthCookiesToParentDomain,
  rehomeReadableAuthCookiesInBrowser,
  resolveAuthCookieDomain,
  resolveRequestHostname,
  serializeAuthSetCookie,
  supabaseProjectRefFromUrl,
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

  it("normalizes URL-shaped AUTH_COOKIE_DOMAIN values", () => {
    process.env.AUTH_COOKIE_DOMAIN = "https://pvnavigator.de";
    expect(resolveAuthCookieDomain("localhost")).toBe(".pvnavigator.de");
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

  it("prefers Origin pvnavigator.de over Vercel internal Host", () => {
    expect(
      resolveRequestHostname(
        "pvnavigator-web.vercel.app",
        "pvnavigator-web.vercel.app",
        "pvnavigator-web.vercel.app",
        "https://pvnavigator.de",
      ),
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
    expect(
      isSupabaseAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token.1"),
    ).toBe(true);
    expect(isSupabaseAuthCookieName("unrelated")).toBe(false);
  });
});

describe("supabaseProjectRefFromUrl", () => {
  it("reads the project ref from the Supabase hostname", () => {
    expect(
      supabaseProjectRefFromUrl("https://ftxgcpebzrhvifjnjivm.supabase.co"),
    ).toBe("ftxgcpebzrhvifjnjivm");
  });
});

describe("rehomeAuthCookiesToParentDomain", () => {
  it("writes parent-domain cookies without a host-only expire", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;

    const headers: string[] = [];

    rehomeAuthCookiesToParentDomain(
      [
        { name: "sb-ftxgcpebzrhvifjnjivm-auth-token", value: "session" },
        { name: "other", value: "skip" },
      ],
      {
        appendHeader: (_name, value) => {
          headers.push(value);
        },
      },
      "pvnavigator.de",
    );

    expect(headers).toHaveLength(1);
    expect(headers[0]).toContain("sb-ftxgcpebzrhvifjnjivm-auth-token=session");
    expect(headers[0]).toContain("Domain=.pvnavigator.de");
    expect(headers[0]).not.toContain("Max-Age=0");
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
      { appendHeader: setCookie },
      "localhost",
    );
  });
});

describe("serializeAuthSetCookie", () => {
  it("sets Domain=.pvnavigator.de on production hosts", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;

    const header = serializeAuthSetCookie(
      "sb-ftxgcpebzrhvifjnjivm-auth-token",
      "base64-session",
      "pvnavigator.de",
    );

    expect(header.startsWith("sb-ftxgcpebzrhvifjnjivm-auth-token=base64-session;")).toBe(
      true,
    );
    expect(header).toContain("Domain=.pvnavigator.de");
    expect(header).toContain("Path=/");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
    expect(header).not.toContain("Max-Age=0");
  });

  it("omits Domain on localhost", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(serializeAuthSetCookie("sb-x-auth-token", "v", "localhost")).not.toContain(
      "Domain=",
    );
  });

  it("encodes cookie values that would break Set-Cookie parsing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    const header = serializeAuthSetCookie(
      "sb-x-auth-token",
      '{"a":1,"b":2}',
      "pvnavigator.de",
    );
    expect(header).toContain("sb-x-auth-token=%7B%22a%22%3A1%2C%22b%22%3A2%7D");
    expect(header).toContain("Domain=.pvnavigator.de");
  });

  it("can omit Domain for a host-only copy on the current origin", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    const header = serializeAuthSetCookie(
      "sb-x-auth-token",
      "session",
      "speicher.pvnavigator.de",
      { hostOnly: true },
    );
    expect(header).not.toContain("Domain=");
    expect(header).toContain("Path=/");
  });
});

describe("authCookiesFromDocumentCookie", () => {
  it("keeps supabase auth cookies and values that contain =", () => {
    expect(
      authCookiesFromDocumentCookie(
        "sb-ftxgcpebzrhvifjnjivm-auth-token=base64-abc=; other=1; sb-ftxgcpebzrhvifjnjivm-auth-token.0=chunk",
      ),
    ).toEqual([
      { name: "sb-ftxgcpebzrhvifjnjivm-auth-token", value: "base64-abc=" },
      { name: "sb-ftxgcpebzrhvifjnjivm-auth-token.0", value: "chunk" },
    ]);
  });

  it("ignores empty input", () => {
    expect(authCookiesFromDocumentCookie("")).toEqual([]);
  });
});

describe("rehomeReadableAuthCookiesInBrowser", () => {
  it("is a no-op without a document", async () => {
    expect(await rehomeReadableAuthCookiesInBrowser()).toBe(0);
  });
});

describe("expireHostOnlyAuthCookies", () => {
  it("expires only supabase auth cookies without Domain", () => {
    process.env.NODE_ENV = "production";
    const headers: string[] = [];
    expireHostOnlyAuthCookies(
      [
        { name: "sb-ftxgcpebzrhvifjnjivm-auth-token" },
        { name: "other" },
      ],
      {
        appendHeader: (_name, value) => {
          headers.push(value);
        },
      },
      "pvnavigator.de",
    );
    expect(headers).toHaveLength(1);
    expect(headers[0]).toContain("Max-Age=0");
    expect(headers[0]).not.toContain("Domain=");
  });
});
