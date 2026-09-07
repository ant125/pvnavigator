import { afterEach, describe, expect, it } from "vitest";

import {
  SHARED_AUTH_COOKIE_NAME,
  appendAuthCookiesFromSetAll,
  expireAuthCookiesForLogout,
  expireLegacyAuthCookies,
  getAuthCookieOptions,
  isLegacyAuthCookieName,
  isSharedAuthCookieName,
  isSupabaseAuthCookieName,
  redirectWithAuthCookies,
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

describe("SHARED_AUTH_COOKIE_NAME", () => {
  it("is the stable shared storage key, not the default project-ref cookie", () => {
    expect(SHARED_AUTH_COOKIE_NAME).toBe("sb-pvnav-auth");
    expect(SHARED_AUTH_COOKIE_NAME).not.toContain("auth-token");
  });
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
  it("uses the shared name, path /, sameSite lax, and no domain on localhost", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(getAuthCookieOptions("localhost")).toEqual({
      name: SHARED_AUTH_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 400 * 24 * 60 * 60,
    });
  });

  it("sets the production parent-domain session cookie", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(getAuthCookieOptions("speicher.pvnavigator.de")).toEqual({
      name: SHARED_AUTH_COOKIE_NAME,
      path: "/",
      sameSite: "lax",
      secure: true,
      domain: ".pvnavigator.de",
      maxAge: 400 * 24 * 60 * 60,
    });
    expect(getAuthCookieOptions("pvnavigator.de")).toEqual(
      getAuthCookieOptions("speicher.pvnavigator.de"),
    );
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

describe("auth cookie names", () => {
  it("matches the shared cookie and chunks", () => {
    expect(isSharedAuthCookieName(SHARED_AUTH_COOKIE_NAME)).toBe(true);
    expect(isSharedAuthCookieName(`${SHARED_AUTH_COOKIE_NAME}.0`)).toBe(true);
    expect(isSharedAuthCookieName(`${SHARED_AUTH_COOKIE_NAME}-code-verifier`)).toBe(
      true,
    );
    expect(isSupabaseAuthCookieName(SHARED_AUTH_COOKIE_NAME)).toBe(true);
  });

  it("matches legacy project-ref cookies without treating them as the shared name", () => {
    expect(isLegacyAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token")).toBe(
      true,
    );
    expect(isLegacyAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token.0")).toBe(
      true,
    );
    expect(isSharedAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token")).toBe(
      false,
    );
    expect(isSupabaseAuthCookieName("sb-ftxgcpebzrhvifjnjivm-auth-token")).toBe(
      true,
    );
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

describe("serializeAuthSetCookie", () => {
  it("writes the shared production cookie with Domain=.pvnavigator.de", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;

    const header = serializeAuthSetCookie(
      SHARED_AUTH_COOKIE_NAME,
      "base64-session",
      "pvnavigator.de",
    );

    expect(header.startsWith(`${SHARED_AUTH_COOKIE_NAME}=base64-session;`)).toBe(
      true,
    );
    expect(header).toContain("Domain=.pvnavigator.de");
    expect(header).toContain("Path=/");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
    expect(header).not.toContain("HttpOnly");
    expect(header).not.toContain("Max-Age=0");
  });

  it("omits Domain on localhost", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    expect(
      serializeAuthSetCookie(SHARED_AUTH_COOKIE_NAME, "v", "localhost"),
    ).not.toContain("Domain=");
  });

  it("encodes cookie values that would break Set-Cookie parsing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
    const header = serializeAuthSetCookie(
      SHARED_AUTH_COOKIE_NAME,
      '{"a":1,"b":2}',
      "pvnavigator.de",
    );
    expect(header).toContain(
      `${SHARED_AUTH_COOKIE_NAME}=%7B%22a%22%3A1%2C%22b%22%3A2%7D`,
    );
    expect(header).toContain("Domain=.pvnavigator.de");
  });
});

describe("appendAuthCookiesFromSetAll", () => {
  it("writes one Domain cookie per name and never a host-only twin", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_DOMAIN;
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;

    const headers: string[] = [];
    appendAuthCookiesFromSetAll(
      [{ name: SHARED_AUTH_COOKIE_NAME, value: "session" }],
      {
        appendHeader: (_name, value) => {
          headers.push(value);
        },
      },
      "pvnavigator.de",
    );

    expect(headers).toHaveLength(1);
    expect(headers[0]).toContain(`Domain=.pvnavigator.de`);
    expect(headers.filter((header) => !header.includes("Domain="))).toHaveLength(
      0,
    );
  });

  it("expires both Domain and host-only scopes when maxAge is 0", () => {
    process.env.NODE_ENV = "production";
    const headers: string[] = [];
    appendAuthCookiesFromSetAll(
      [{ name: SHARED_AUTH_COOKIE_NAME, value: "", options: { maxAge: 0 } }],
      {
        appendHeader: (_name, value) => {
          headers.push(value);
        },
      },
      "pvnavigator.de",
    );

    expect(headers).toHaveLength(2);
    expect(headers.some((header) => header.includes("Domain=.pvnavigator.de"))).toBe(
      true,
    );
    expect(headers.some((header) => !header.includes("Domain="))).toBe(true);
    expect(headers.every((header) => header.includes("Max-Age=0"))).toBe(true);
  });
});

describe("expireLegacyAuthCookies", () => {
  it("expires legacy project-ref cookies on both scopes", () => {
    process.env.NODE_ENV = "production";
    const headers: string[] = [];
    expireLegacyAuthCookies(
      [
        { name: "sb-ftxgcpebzrhvifjnjivm-auth-token" },
        { name: SHARED_AUTH_COOKIE_NAME },
        { name: "other" },
      ],
      {
        appendHeader: (_name, value) => {
          headers.push(value);
        },
      },
      "pvnavigator.de",
    );

    expect(headers.some((header) => header.includes(SHARED_AUTH_COOKIE_NAME))).toBe(
      false,
    );
    expect(
      headers.some((header) =>
        header.includes("sb-ftxgcpebzrhvifjnjivm-auth-token"),
      ),
    ).toBe(true);
    expect(headers.some((header) => header.includes("Domain=.pvnavigator.de"))).toBe(
      true,
    );
    expect(headers.some((header) => !header.includes("Domain="))).toBe(true);
  });
});

describe("expireAuthCookiesForLogout", () => {
  it("expires the shared cookie, chunks, and leftover legacy names", () => {
    process.env.NODE_ENV = "production";
    const headers: string[] = [];
    expireAuthCookiesForLogout(
      [{ name: "sb-ftxgcpebzrhvifjnjivm-auth-token.1" }],
      {
        appendHeader: (_name, value) => {
          headers.push(value);
        },
      },
      "pvnavigator.de",
    );

    const joined = headers.join("\n");
    expect(joined).toContain(`${SHARED_AUTH_COOKIE_NAME}=`);
    expect(joined).toContain(`${SHARED_AUTH_COOKIE_NAME}.0=`);
    expect(joined).toContain("sb-ftxgcpebzrhvifjnjivm-auth-token.1=");
    expect(headers.every((header) => header.includes("Max-Age=0"))).toBe(true);
  });
});

describe("redirectWithAuthCookies", () => {
  it("returns a 303 with raw Set-Cookie headers", async () => {
    process.env.NODE_ENV = "production";
    const cookie = serializeAuthSetCookie(
      SHARED_AUTH_COOKIE_NAME,
      "session",
      "pvnavigator.de",
    );
    const response = redirectWithAuthCookies(
      "https://speicher.pvnavigator.de/calculate",
      [cookie],
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://speicher.pvnavigator.de/calculate",
    );
    expect(response.headers.getSetCookie()).toEqual([cookie]);
  });
});
