import { afterEach, describe, expect, it } from "vitest";

import { decodeAuthHandoff, encodeAuthCookieHandoff } from "./handoff";

const ORIGINAL_NOW = Date.now;

afterEach(() => {
  Date.now = ORIGINAL_NOW;
});

describe("auth cookie handoff", () => {
  it("round-trips supabase cookies and ignores other names", () => {
    const encoded = encodeAuthCookieHandoff([
      { name: "sb-ftxgcpebzrhvifjnjivm-auth-token.0", value: "chunk+plus/slash==" },
      { name: "other", value: "skip" },
    ]);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(decodeAuthHandoff(encoded)).toEqual({
      type: "cookies",
      cookies: [
        { name: "sb-ftxgcpebzrhvifjnjivm-auth-token.0", value: "chunk+plus/slash==" },
      ],
    });
  });

  it("rejects expired payloads", () => {
    const encoded = encodeAuthCookieHandoff([
      { name: "sb-ftxgcpebzrhvifjnjivm-auth-token", value: "session-value" },
    ]);
    Date.now = () => ORIGINAL_NOW() + 120_000;
    expect(decodeAuthHandoff(encoded)).toBeNull();
  });

  it("rejects empty or broken input", () => {
    expect(decodeAuthHandoff("")).toBeNull();
    expect(decodeAuthHandoff("%%%")).toBeNull();
  });
});
