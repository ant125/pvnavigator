import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieWriter,
  getHubOrigin,
  getSpeicherGrenzeCalculateUrl,
  parseAuthNextParam,
  rehomeAuthCookiesToParentDomain,
  resolvePostLoginRedirect,
  resolveRequestHostname,
} from "@pv-auth/session";

function continueLocation(request: NextRequest): string {
  const hub = getHubOrigin();
  const next = parseAuthNextParam(request.nextUrl.searchParams.get("next"), "/");
  const dest = resolvePostLoginRedirect(next, "/");
  const location = dest.startsWith("http")
    ? dest
    : new URL(dest, `${hub}/`).toString();
  const allowed = location === getSpeicherGrenzeCalculateUrl() || location.startsWith(`${hub}/`);
  return allowed ? location : `${hub}/`;
}

export async function GET(request: NextRequest) {
  const hub = getHubOrigin();
  const location = continueLocation(request);
  const hostname = resolveRequestHostname(
    request.nextUrl.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("origin"),
  );

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weiterleitung | PVNavigator</title>
</head>
<body>
  <p>Weiterleitung …</p>
  <p><a href="${location.replace(/"/g, "")}">Weiter</a></p>
  <script>
  (function () {
    var dest = ${JSON.stringify(location)};
    var home = ${JSON.stringify(`${hub}/`)};
    try {
      var key = "pv-auth-continue-ts";
      var prev = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - prev < 8000) {
        location.replace(home);
        return;
      }
      sessionStorage.setItem(key, String(Date.now()));
    } catch (e) {}
    location.replace(dest);
  })();
  </script>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
  rehomeAuthCookiesToParentDomain(
    request.cookies.getAll(),
    authCookieWriter(response.headers),
    hostname,
  );
  return response;
}
