import { afterEach, describe, expect, it } from "vitest";

import {
  AUTH_NEXT_SPEICHER_CALCULATE,
  getHubLoginUrlForSpeicherCalculate,
  getHubSignOutUrl,
  getSpeicherGrenzeCalculateUrl,
  isAllowedHubFormOrigin,
  isAllowedHubSignOutOrigin,
  isHubAuthMutationPath,
  parseAuthNextParam,
  resolvePostLoginLocation,
  resolvePostLoginRedirect,
  sanitizeNextPath,
} from "./redirects";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sanitizeNextPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(sanitizeNextPath("/konto")).toBe("/konto");
    expect(sanitizeNextPath("/")).toBe("/");
  });

  it("rejects open redirects", () => {
    expect(sanitizeNextPath("https://evil.example", "/konto")).toBe("/konto");
    expect(sanitizeNextPath("//evil.example", "/konto")).toBe("/konto");
    expect(sanitizeNextPath("/\\evil.example", "/konto")).toBe("/konto");
    expect(sanitizeNextPath("speicher-calculate", "/konto")).toBe("/konto");
  });
});

describe("resolvePostLoginRedirect", () => {
  it("maps the speicher-calculate alias directly to the calculator URL", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SPEICHER_GRENZE_URL;
    expect(resolvePostLoginRedirect(AUTH_NEXT_SPEICHER_CALCULATE)).toBe(
      "https://speicher.pvnavigator.de/calculate",
    );
    expect(resolvePostLoginRedirect(AUTH_NEXT_SPEICHER_CALCULATE)).not.toContain(
      "/auth/continue",
    );
  });

  it("does not accept user-controlled calculator URLs", () => {
    expect(
      resolvePostLoginRedirect("https://speicher.pvnavigator.de.evil/calculate"),
    ).toBe("/");
    expect(resolvePostLoginRedirect("https://evil.example")).toBe("/");
  });

  it("keeps hub relative paths", () => {
    expect(resolvePostLoginRedirect("/konto", "/")).toBe("/konto");
  });
});

describe("resolvePostLoginLocation", () => {
  it("sends speicher-calculate to SpeicherGrenze without /auth/continue", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_HUB_URL;
    delete process.env.NEXT_PUBLIC_SPEICHER_GRENZE_URL;
    expect(resolvePostLoginLocation(AUTH_NEXT_SPEICHER_CALCULATE)).toBe(
      "https://speicher.pvnavigator.de/calculate",
    );
  });

  it("expands hub paths against the hub origin", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_HUB_URL;
    expect(resolvePostLoginLocation("/konto")).toBe("https://pvnavigator.de/konto");
  });
});

describe("parseAuthNextParam", () => {
  it("preserves the approved alias and sanitizes everything else", () => {
    expect(parseAuthNextParam("speicher-calculate")).toBe("speicher-calculate");
    expect(parseAuthNextParam("/konto")).toBe("/konto");
    expect(parseAuthNextParam("https://evil.example")).toBe("/");
  });
});

describe("getHubLoginUrlForSpeicherCalculate", () => {
  it("points at the hub login with the symbolic next target", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_HUB_URL;
    expect(getHubLoginUrlForSpeicherCalculate()).toBe(
      "https://pvnavigator.de/anmelden?next=speicher-calculate",
    );
  });

  it("does not treat SpeicherGrenze SITE_URL as the hub", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_HUB_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://speicher.pvnavigator.de";
    expect(getHubLoginUrlForSpeicherCalculate()).toBe(
      "https://pvnavigator.de/anmelden?next=speicher-calculate",
    );
  });
});

describe("getSpeicherGrenzeCalculateUrl", () => {
  it("uses the local origin outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.NEXT_PUBLIC_SPEICHER_GRENZE_URL;
    expect(getSpeicherGrenzeCalculateUrl()).toBe(
      "http://localhost:3001/calculate",
    );
  });
});

describe("isHubAuthMutationPath", () => {
  it("matches sign-in, sign-up, sign-out, and callback", () => {
    expect(isHubAuthMutationPath("/auth/sign-in")).toBe(true);
    expect(isHubAuthMutationPath("/auth/sign-up")).toBe(true);
    expect(isHubAuthMutationPath("/auth/sign-out")).toBe(true);
    expect(isHubAuthMutationPath("/auth/callback")).toBe(true);
    expect(isHubAuthMutationPath("/auth/continue")).toBe(false);
    expect(isHubAuthMutationPath("/anmelden")).toBe(false);
  });
});

describe("isAllowedHubFormOrigin", () => {
  it("matches Origin to the public host, including Vercel forwarded hosts", () => {
    expect(isAllowedHubFormOrigin("https://pvnavigator.de", "pvnavigator.de")).toBe(
      true,
    );
    expect(
      isAllowedHubFormOrigin(
        "https://pvnavigator.de",
        "pvnavigator-web.vercel.app",
        "pvnavigator.de",
      ),
    ).toBe(true);
    expect(isAllowedHubFormOrigin("https://evil.example", "pvnavigator.de")).toBe(
      false,
    );
    expect(isAllowedHubFormOrigin(null, "pvnavigator.de")).toBe(false);
  });

  it("does not treat product subdomains as the Hub host", () => {
    expect(
      isAllowedHubFormOrigin(
        "https://speicher.pvnavigator.de",
        "pvnavigator.de",
      ),
    ).toBe(false);
  });
});

describe("getHubSignOutUrl", () => {
  it("points at Hub POST /auth/sign-out", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_HUB_URL;
    expect(getHubSignOutUrl()).toBe("https://pvnavigator.de/auth/sign-out");
  });
});

describe("isAllowedHubSignOutOrigin", () => {
  it("allows the Hub origin", () => {
    expect(
      isAllowedHubSignOutOrigin("https://pvnavigator.de", "pvnavigator.de"),
    ).toBe(true);
  });

  it("allows speicher.pvnavigator.de posting to Hub", () => {
    expect(
      isAllowedHubSignOutOrigin(
        "https://speicher.pvnavigator.de",
        "pvnavigator.de",
      ),
    ).toBe(true);
  });

  it("allows another *.pvnavigator.de sibling", () => {
    expect(
      isAllowedHubSignOutOrigin(
        "https://wirtschaft.pvnavigator.de",
        "pvnavigator.de",
      ),
    ).toBe(true);
  });

  it("rejects an external origin", () => {
    expect(
      isAllowedHubSignOutOrigin("https://evil.example", "pvnavigator.de"),
    ).toBe(false);
    expect(isAllowedHubSignOutOrigin(null, "pvnavigator.de")).toBe(false);
  });
});
