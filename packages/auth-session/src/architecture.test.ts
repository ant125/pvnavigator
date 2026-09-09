import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("shared session architecture", () => {
  it("does not keep the cookie/hash handoff bridge", () => {
    const index = read("packages/auth-session/src/index.ts");
    expect(index).not.toContain("handoff");
    expect(index).not.toContain("AUTH_CONTINUE_PATH");
    expect(index).not.toContain("AUTH_CATCH_PATH");
    expect(index).not.toContain("AUTH_ACCEPT_PATH");
    expect(index).not.toContain("rehomeAuthCookiesToParentDomain");
    expect(index).not.toContain("rehomeReadableAuthCookiesInBrowser");
  });

  it("sends authenticated speicher-calculate users directly to the calculator", () => {
    const auth = read("apps/pvnavigator-web/src/lib/auth.ts");
    const middleware = read("apps/pvnavigator-web/src/middleware.ts");
    const anmelden = read("apps/pvnavigator-web/src/app/anmelden/page.tsx");
    expect(auth).not.toContain("getHubAuthContinueUrl");
    expect(middleware).not.toContain("getHubAuthContinueUrl");
    expect(anmelden).not.toContain("getHubAuthContinueUrl");
    expect(auth).toContain("resolvePostLoginRedirect");
  });

  it("uses the same cookie options helper in Hub and SpeicherGrenze clients", () => {
    const files = [
      "apps/pvnavigator-web/src/middleware.ts",
      "apps/pvnavigator-web/src/lib/supabase/server.ts",
      "apps/pvnavigator-web/src/lib/supabase/routeHandler.ts",
      "apps/pvnavigator-web/src/lib/supabase/client.ts",
      "apps/speicher-physik/src/middleware.ts",
      "apps/speicher-physik/src/lib/supabase/server.ts",
      "apps/speicher-physik/src/lib/supabase/routeHandler.ts",
    ];
    for (const file of files) {
      expect(read(file)).toContain("getAuthCookieOptions");
    }
  });

  it("writes login cookies through the raw Set-Cookie redirect helper", () => {
    const signIn = read("apps/pvnavigator-web/src/app/auth/sign-in/route.ts");
    const routeHandler = read(
      "apps/pvnavigator-web/src/lib/supabase/routeHandler.ts",
    );
    expect(signIn).toContain("expireLegacyCookiesOn");
    expect(signIn).toContain("redirectWithSetCookies");
    expect(routeHandler).toContain("redirectWithAuthCookies");
    expect(routeHandler).not.toContain("NextResponse.redirect");
  });

  it("writes signup sessions through the same Route Handler cookie pipeline", () => {
    const signUp = read("apps/pvnavigator-web/src/app/auth/sign-up/route.ts");
    const hubServer = read("apps/pvnavigator-web/src/lib/supabase/server.ts");
    const speicherServer = read(
      "apps/speicher-physik/src/lib/supabase/server.ts",
    );
    expect(signUp).toContain("createRouteHandlerSupabase");
    expect(signUp).toContain("expireLegacyCookiesOn");
    expect(signUp).toContain("redirectWithSetCookies");
    expect(signUp).toContain("data.session");
    expect(signUp).not.toContain("persistCookies");
    expect(signUp).not.toContain("cookies().set");
    expect(hubServer).not.toContain("persistCookies");
    expect(speicherServer).not.toContain("persistCookies");
  });

  it("returns SpeicherGrenze users to the product origin after Hub logout", () => {
    const layout = read("apps/speicher-physik/src/app/layout.tsx");
    expect(layout).toContain("AUTH_RETURN_SPEICHER");
    expect(layout).toContain("getHubSignOutUrl({ returnTo: AUTH_RETURN_SPEICHER })");
  });

  it("clears shared and legacy cookies on logout", () => {
    const signOut = read("apps/pvnavigator-web/src/app/auth/sign-out/route.ts");
    expect(signOut).toContain("expireAuthCookiesForLogout");
    expect(signOut).toContain("isAllowedHubSignOutOrigin");
    expect(signOut).toContain("resolvePostLogoutLocation");
    expect(signOut).not.toContain("isAllowedHubFormOrigin");
  });
});
