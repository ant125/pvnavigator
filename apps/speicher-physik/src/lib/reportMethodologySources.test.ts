import { describe, expect, it } from "vitest";
import { getReportMethodologySources } from "./reportMethodologySources";

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
});
