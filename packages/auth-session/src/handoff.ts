const HANDOFF_TTL_MS = 60_000;

function toBase64Url(text: string): string {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(text, "utf8").toString("base64")
      : btoa(text);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(raw: string): string {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  const base64 = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return typeof Buffer !== "undefined"
    ? Buffer.from(base64, "base64").toString("utf8")
    : atob(base64);
}

export function encodeSessionHandoffPayload(
  accessToken: string,
  refreshToken: string,
): string {
  return toBase64Url(
    JSON.stringify({
      at: accessToken,
      rt: refreshToken,
      exp: Date.now() + HANDOFF_TTL_MS,
    }),
  );
}

export function decodeSessionHandoffPayload(
  raw: string,
): { accessToken: string; refreshToken: string } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(fromBase64Url(raw)) as {
      at?: unknown;
      rt?: unknown;
      exp?: unknown;
    };
    if (typeof data.exp === "number" && data.exp < Date.now()) return null;
    if (typeof data.at !== "string" || typeof data.rt !== "string") return null;
    if (!data.at || !data.rt) return null;
    return { accessToken: data.at, refreshToken: data.rt };
  } catch {
    return null;
  }
}
