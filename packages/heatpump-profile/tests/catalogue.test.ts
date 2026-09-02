import { describe, expect, it } from "vitest";
import {
  findDefaultHeatPumpProfile,
  getHeatPumpCatalogue,
  getHeatPumpCatalogueEntry,
  HEAT_PUMP_CATALOGUE,
} from "../src/catalogue";

describe("heat-pump catalogue", () => {
  it("lists the production Luft/Wasser prototypes and one Wasser/Wasser default", () => {
    const ids = HEAT_PUMP_CATALOGUE.map((e) => e.profileId);
    expect(ids).toEqual([
      "lw-heating-only-thermbuild-o5-v1",
      "lw-heating-dhw-thermbuild-n2-v1",
      "ww-heating-dhw-wpuq-2019-sfh38-v1",
    ]);
  });

  it("exposes required metadata on every row", () => {
    for (const entry of getHeatPumpCatalogue()) {
      expect(entry.profileId).toMatch(/-v1$/);
      expect(["luftwasser", "wasserwasser"]).toContain(entry.technology);
      expect(["space_heat_only", "space_heat_and_dhw"]).toContain(
        entry.dhwService
      );
      expect(["lab-prototype", "field-cohort-representative"]).toContain(
        entry.quality
      );
      expect(entry.methodologySourceId.length).toBeGreaterThan(0);
      expect(entry.license.length).toBeGreaterThan(0);
      expect(entry.defaultFor).toEqual({
        technology: entry.technology,
        dhwService: entry.dhwService,
      });
    }
  });

  it("catalogues Wasser/Wasser heating+DHW as the WPuQ field representative", () => {
    const entry = getHeatPumpCatalogueEntry("ww-heating-dhw-wpuq-2019-sfh38-v1");
    expect(entry).toEqual({
      profileId: "ww-heating-dhw-wpuq-2019-sfh38-v1",
      technology: "wasserwasser",
      dhwService: "space_heat_and_dhw",
      quality: "field-cohort-representative",
      methodologySourceId: "wpuq-wasserwasser-heatpump",
      license: "CC-BY-4.0",
      defaultFor: {
        technology: "wasserwasser",
        dhwService: "space_heat_and_dhw",
      },
    });
  });

  it("has unique profileIds", () => {
    const ids = HEAT_PUMP_CATALOGUE.map((e) => e.profileId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has at most one default per (technology, dhwService)", () => {
    const keys = HEAT_PUMP_CATALOGUE.filter((e) => e.defaultFor).map(
      (e) => `${e.defaultFor!.technology}:${e.defaultFor!.dhwService}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("looks up rows by profileId", () => {
    const heatingOnly = getHeatPumpCatalogueEntry(
      "lw-heating-only-thermbuild-o5-v1"
    );
    expect(heatingOnly?.dhwService).toBe("space_heat_only");
    expect(getHeatPumpCatalogueEntry("does-not-exist")).toBeUndefined();
  });

  it("selects defaults from the catalogue, not from dataset names", () => {
    expect(
      findDefaultHeatPumpProfile("luftwasser", "space_heat_only")?.profileId
    ).toBe("lw-heating-only-thermbuild-o5-v1");
    expect(
      findDefaultHeatPumpProfile("luftwasser", "space_heat_and_dhw")?.profileId
    ).toBe("lw-heating-dhw-thermbuild-n2-v1");
    expect(
      findDefaultHeatPumpProfile("wasserwasser", "space_heat_and_dhw")?.profileId
    ).toBe("ww-heating-dhw-wpuq-2019-sfh38-v1");
    expect(
      findDefaultHeatPumpProfile("wasserwasser", "space_heat_only")
    ).toBeUndefined();
  });

  it("does not catalogue WPuQ robustness houses", () => {
    const ids = HEAT_PUMP_CATALOGUE.map((e) => e.profileId);
    expect(ids.filter((id) => id.includes("wpuq"))).toEqual([
      "ww-heating-dhw-wpuq-2019-sfh38-v1",
    ]);
    expect(ids.some((id) => id.startsWith("ww-wpuq-"))).toBe(false);
  });
});
