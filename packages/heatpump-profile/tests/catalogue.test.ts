import { describe, expect, it } from "vitest";
import {
  findDefaultHeatPumpProfile,
  getHeatPumpCatalogue,
  getHeatPumpCatalogueEntry,
  HEAT_PUMP_CATALOGUE,
} from "../src/catalogue";

describe("heat-pump catalogue", () => {
  it("lists exactly the two Luft/Wasser production prototypes", () => {
    const ids = HEAT_PUMP_CATALOGUE.map((e) => e.profileId);
    expect(ids).toEqual([
      "lw-heating-only-thermbuild-o5-v1",
      "lw-heating-dhw-thermbuild-n2-v1",
    ]);
  });

  it("exposes required metadata on every row", () => {
    for (const entry of getHeatPumpCatalogue()) {
      expect(entry.profileId).toMatch(/-v1$/);
      expect(entry.technology).toBe("luftwasser");
      expect(["space_heat_only", "space_heat_and_dhw"]).toContain(
        entry.dhwService
      );
      expect(entry.quality).toBe("lab-prototype");
      expect(entry.methodologySourceId).toBe("thermbuild-fordatis-486");
      expect(entry.license).toBe("CC-BY-SA-4.0");
      expect(entry.defaultFor).toEqual({
        technology: entry.technology,
        dhwService: entry.dhwService,
      });
    }
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
      findDefaultHeatPumpProfile("wasserwasser", "space_heat_and_dhw")
    ).toBeUndefined();
  });
});
