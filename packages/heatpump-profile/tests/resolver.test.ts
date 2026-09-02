import { describe, expect, it } from "vitest";
import { resolveHeatPumpProfile } from "../src/resolver";

describe("resolveHeatPumpProfile", () => {
  it("selects heating-only Luft/Wasser by default", () => {
    const resolved = resolveHeatPumpProfile({
      technology: "luftwasser",
      dhwService: "space_heat_only",
    });
    expect(resolved.entry.profileId).toBe(
      "lw-heating-only-thermbuild-o5-v1"
    );
    expect(resolved.fallback).toBe(false);
    expect(resolved.resolvedTechnology).toBe("luftwasser");
    expect(resolved.requestedTechnology).toBe("luftwasser");
  });

  it("selects heating+DHW Luft/Wasser by default", () => {
    const resolved = resolveHeatPumpProfile({
      technology: "luftwasser",
      dhwService: "space_heat_and_dhw",
    });
    expect(resolved.entry.profileId).toBe("lw-heating-dhw-thermbuild-n2-v1");
    expect(resolved.entry.dhwService).toBe("space_heat_and_dhw");
    expect(resolved.fallback).toBe(false);
  });

  it("maps unknown technology to Luft/Wasser and records fallback", () => {
    const resolved = resolveHeatPumpProfile({
      technology: "unknown",
      dhwService: "space_heat_and_dhw",
    });
    expect(resolved.resolvedTechnology).toBe("luftwasser");
    expect(resolved.entry.profileId).toBe("lw-heating-dhw-thermbuild-n2-v1");
    expect(resolved.fallback).toBe("unknown-uses-luftwasser");
  });

  it("honours an explicit catalogue profileId", () => {
    const resolved = resolveHeatPumpProfile({
      technology: "luftwasser",
      dhwService: "space_heat_only",
      profileId: "lw-heating-only-thermbuild-o5-v1",
    });
    expect(resolved.entry.profileId).toBe(
      "lw-heating-only-thermbuild-o5-v1"
    );
    expect(resolved.fallback).toBe(false);
  });

  it("rejects an unknown profileId", () => {
    expect(() =>
      resolveHeatPumpProfile({
        technology: "luftwasser",
        dhwService: "space_heat_only",
        profileId: "not-a-profile",
      })
    ).toThrow(/Unknown heat-pump profileId/);
  });

  it("rejects a profileId that does not match dhwService", () => {
    expect(() =>
      resolveHeatPumpProfile({
        technology: "luftwasser",
        dhwService: "space_heat_only",
        profileId: "lw-heating-dhw-thermbuild-n2-v1",
      })
    ).toThrow(/space_heat_and_dhw/);
  });

  it("rejects a profileId that does not match technology", () => {
    expect(() =>
      resolveHeatPumpProfile({
        technology: "wasserwasser",
        dhwService: "space_heat_and_dhw",
        profileId: "lw-heating-dhw-thermbuild-n2-v1",
      })
    ).toThrow(/luftwasser, not wasserwasser/);
  });

  it("selects the WPuQ Wasser/Wasser heating+DHW production default", () => {
    const resolved = resolveHeatPumpProfile({
      technology: "wasserwasser",
      dhwService: "space_heat_and_dhw",
    });
    expect(resolved.entry.profileId).toBe(
      "ww-heating-dhw-wpuq-2019-sfh38-v1"
    );
    expect(resolved.entry.technology).toBe("wasserwasser");
    expect(resolved.fallback).toBe(false);
    expect(resolved.resolvedTechnology).toBe("wasserwasser");
    expect(resolved.requestedTechnology).toBe("wasserwasser");
  });

  it("throws when Wasser/Wasser heating-only is requested", () => {
    expect(() =>
      resolveHeatPumpProfile({
        technology: "wasserwasser",
        dhwService: "space_heat_only",
      })
    ).toThrow(/No heat-pump catalogue default/);
  });

  it("rejects unsupported technology values", () => {
    expect(() =>
      resolveHeatPumpProfile({
        technology: "solewasser" as never,
        dhwService: "space_heat_only",
      })
    ).toThrow(/Unsupported heat-pump technology/);
  });
});
