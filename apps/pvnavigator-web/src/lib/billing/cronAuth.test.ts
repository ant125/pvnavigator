import { describe, expect, it } from "vitest";

import { cronRequestAuthorized } from "./cronAuth";

describe("cronRequestAuthorized", () => {
  it("accepts only the configured bearer secret", () => {
    expect(cronRequestAuthorized("Bearer top-secret", "top-secret")).toBe(true);
    expect(cronRequestAuthorized("Bearer top-secret", " other")).toBe(false);
    expect(cronRequestAuthorized("Bearer wrong", "top-secret")).toBe(false);
    expect(cronRequestAuthorized(null, "top-secret")).toBe(false);
    expect(cronRequestAuthorized("Bearer top-secret", undefined)).toBe(false);
    expect(cronRequestAuthorized("Bearer top-secret", "   ")).toBe(false);
  });
});
