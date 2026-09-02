import { describe, expect, it } from "vitest";
import {
  getMethodologySourceById,
  getPublicMethodologySections,
  METHODOLOGY_CHAPTERS,
} from "@pv-methodology/registry";
import {
  getReportDurationInclusions,
  getReportMethodologySources,
} from "./reportMethodologySources";

const THERMBUILD_CITATION = {
  methodologySourceId: "thermbuild-fordatis-486",
} as const;

describe("getReportMethodologySources", () => {
  it("cites WPuQ via the Scientific Data publication, not Zenodo", () => {
    const wpuq = getReportMethodologySources().find(
      (source) => source.id === "wpuq-scientific-data"
    );

    expect(wpuq).toMatchObject({
      title: "WPuQ Smart-Meter-Datensatz",
      organization: "Schlemminger et al., Scientific Data (2022)",
      linkLabel: "WPuQ Scientific Data",
      url: "https://www.nature.com/articles/s41597-022-01156-1",
    });
    expect(wpuq?.url).not.toMatch(/zenodo/i);
    expect(wpuq?.detail).toContain("NO_PV");
  });

  it("omits ThermBuild when no heat-pump profile was used", () => {
    const without = getReportMethodologySources();
    const absent = getReportMethodologySources(null);
    expect(without.map((source) => source.id)).not.toContain(
      "thermbuild-fordatis-486"
    );
    expect(absent.map((source) => source.id)).not.toContain(
      "thermbuild-fordatis-486"
    );
    expect(JSON.stringify(without)).not.toMatch(/ThermBuild/i);
    expect(JSON.stringify(without)).not.toMatch(/fordatis/i);
  });

  it("includes the registry ThermBuild source when that profile was used", () => {
    const registry = getMethodologySourceById("thermbuild-fordatis-486");
    expect(registry?.url).toBeTruthy();

    const sources = getReportMethodologySources(THERMBUILD_CITATION);
    const thermbuild = sources.find(
      (source) => source.id === "thermbuild-fordatis-486"
    );

    expect(thermbuild).toMatchObject({
      title: "ThermBuild Wärmepumpen-Messdaten",
      organization: "Fraunhofer / ThermBuild",
      linkLabel: "ThermBuild (Fordatis)",
    });
    expect(thermbuild?.url).toBe(registry?.url);
    expect(thermbuild?.url).toBeTruthy();
  });

  it("does not treat heatPumpEnabled-style flags as a ThermBuild citation", () => {
    const sources = getReportMethodologySources({
      methodologySourceId: null,
    });
    expect(sources.map((source) => source.id)).not.toContain(
      "thermbuild-fordatis-486"
    );
  });
});

describe("getReportDurationInclusions", () => {
  const base = [
    "PVGIS-Wetterdaten",
    "Batteriesimulation",
    "Validierung mit 27 Referenzhaushalten",
  ];

  it("keeps the duration list unchanged without a heat pump", () => {
    expect(
      getReportDurationInclusions({ heatPump: null, cohortSize: 27 })
    ).toEqual(base);
    expect(getReportDurationInclusions({ cohortSize: 27 })).toEqual(base);
  });

  it("adds gemessenes Wärmepumpenprofil for a ThermBuild Luft/Wasser run", () => {
    expect(
      getReportDurationInclusions({
        heatPump: THERMBUILD_CITATION,
        cohortSize: 27,
      })
    ).toEqual([
      "PVGIS-Wetterdaten",
      "Batteriesimulation",
      "gemessenes Wärmepumpenprofil",
      "Validierung mit 27 Referenzhaushalten",
    ]);
  });
});

describe("Methodik Wärmepumpe", () => {
  it("documents ThermBuild measured profiles instead of the synthetic seasonal model", () => {
    const chapter = METHODOLOGY_CHAPTERS.find(
      (entry) => entry.id === "waermepumpe"
    );
    expect(chapter).toBeDefined();
    const text = [
      ...(chapter?.paragraphs ?? []),
      ...(chapter?.bullets ?? []),
      ...(chapter?.notes ?? []),
    ].join(" ");
    expect(text).toMatch(/ThermBuild/);
    expect(text).toMatch(/Fraunhofer/);
    expect(text).toMatch(/15-Minuten/);
    expect(text).toMatch(/Referenzprofil/);
    expect(text).toMatch(/skaliert/);
    expect(text).not.toMatch(/saisonale Gewichtung/);
    expect(text).not.toMatch(/WPuQ-Projekt/);
    expect(text).not.toMatch(/https:\/\//);
  });

  it("lists the official ThermBuild source in Quellen", () => {
    const load = getPublicMethodologySections().find(
      (section) => section.id === "load_profiles"
    );
    const thermbuild = load?.entries.find(
      (entry) => entry.id === "public-thermbuild"
    );
    expect(thermbuild).toBeDefined();
    expect(thermbuild?.organization).toMatch(/Fraunhofer/);
    expect(thermbuild?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "thermbuild-fordatis-486",
          url: "https://fordatis.fraunhofer.de/handle/fordatis/486",
        }),
      ])
    );
  });

  it("registers WPuQ heat-pump production separately from household robustness", () => {
    const household = getMethodologySourceById("wpuq-scientific-data");
    const heatPump = getMethodologySourceById("wpuq-wasserwasser-heatpump");
    expect(household?.category).toBe("research");
    expect(heatPump?.category).toBe("load_profiles");
    expect(heatPump?.sourceType).toBe("dataset");
    expect(heatPump?.url).toBe(household?.url);
    expect(heatPump?.description).toMatch(/Wasser\/Wasser/);
    expect(heatPump?.description).toMatch(/HEATPUMP/);
    expect(JSON.stringify(getPublicMethodologySections())).not.toMatch(
      /wpuq-wasserwasser-heatpump/
    );
    expect(getReportMethodologySources().map((source) => source.id)).not.toContain(
      "wpuq-wasserwasser-heatpump"
    );
  });
});
