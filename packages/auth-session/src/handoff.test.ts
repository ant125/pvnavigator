import { afterEach, describe, expect, it } from "vitest";

import {
  decodeSessionHandoffPayload,
  encodeSessionHandoffPayload,
} from "./handoff";

const ORIGINAL_NOW = Date.now;

afterEach(() => {
  Date.now = ORIGINAL_NOW;
});

describe("session handoff payload", () => {
  it("round-trips tokens that contain + and /", () => {
    const access = "header.payload+plus/slash==";
    const refresh = "refresh+token/with=chars";
    const encoded = encodeSessionHandoffPayload(access, refresh);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(decodeSessionHandoffPayload(encoded)).toEqual({
      accessToken: access,
      refreshToken: refresh,
    });
  });

  it("rejects expired payloads", () => {
    const encoded = encodeSessionHandoffPayload("access-token-value", "refresh-token-value");
    Date.now = () => ORIGINAL_NOW() + 120_000;
    expect(decodeSessionHandoffPayload(encoded)).toBeNull();
  });

  it("rejects empty or broken input", () => {
    expect(decodeSessionHandoffPayload("")).toBeNull();
    expect(decodeSessionHandoffPayload("%%%")).toBeNull();
  });
});
