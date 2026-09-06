import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  METHODIK_ARTICLES,
  formatMethodikMonthYear,
  getMethodikArticle,
  getMethodikArticlesByGroup,
} from "./catalog";
import {
  EV_HOME_CHARGING_EXAMPLE_FILENAME,
  loadEvHomeChargingExample,
  parseHomeChargingCsv,
} from "./exampleCsv";
import { collectMethodikHeadings, slugifyHeading } from "./headings";

function HeadingSection({
  title,
  children,
}: {
  id?: string;
  title: string;
  children?: ReactNode;
}) {
  return createElement("section", null, title, children);
}
HeadingSection.methodikLevel = 2 as const;

function HeadingSubSection({
  title,
}: {
  id?: string;
  title: string;
  children?: ReactNode;
}) {
  return createElement("section", null, title);
}
HeadingSubSection.methodikLevel = 3 as const;

describe("methodik catalog", () => {
  it("exposes the EV article as the only published page", () => {
    expect(METHODIK_ARTICLES).toHaveLength(1);
    expect(getMethodikArticle("elektroauto-ladeprofil")?.title).toBe(
      "Elektroauto-Ladeprofil (EV v1)"
    );
    expect(getMethodikArticlesByGroup()).toEqual([
      expect.objectContaining({
        group: expect.objectContaining({ id: "load" }),
      }),
    ]);
    expect(formatMethodikMonthYear("2026-09-01")).toBe("September 2026");
  });
});

describe("methodik headings", () => {
  it("slugifies German headings and collects nested sections", () => {
    expect(slugifyHeading("Zweck dieser Methodik")).toBe(
      "zweck-dieser-methodik"
    );
    expect(slugifyHeading("Warum wird das Elektroauto separat modelliert?")).toBe(
      "warum-wird-das-elektroauto-separat-modelliert"
    );
    expect(slugifyHeading("Berechnetes Ladeprofil (CSV)")).toBe(
      "berechnetes-ladeprofil-csv"
    );

    const tree = createElement(
      HeadingSection,
      { title: "Rechenbeispiel" },
      createElement(HeadingSubSection, { title: "Eingabedaten" }),
      createElement(HeadingSubSection, {
        title: "Berechnetes Ladeprofil (CSV)",
      }),
      createElement(HeadingSubSection, { title: "Visualisierung" }),
      createElement(HeadingSubSection, { title: "Interpretation" })
    );

    expect(collectMethodikHeadings(tree)).toEqual([
      { id: "rechenbeispiel", title: "Rechenbeispiel", level: 2 },
      { id: "eingabedaten", title: "Eingabedaten", level: 3 },
      {
        id: "berechnetes-ladeprofil-csv",
        title: "Berechnetes Ladeprofil (CSV)",
        level: 3,
      },
      { id: "visualisierung", title: "Visualisierung", level: 3 },
      { id: "interpretation", title: "Interpretation", level: 3 },
    ]);
  });
});

describe("EV methodik example CSV", () => {
  it("parses the production reference profile without inventing rows", () => {
    const example = loadEvHomeChargingExample();
    expect(example.filename).toBe(EV_HOME_CHARGING_EXAMPLE_FILENAME);
    expect(example.headers).toEqual(["Date", "Time", "HomeCharging_kWh"]);
    expect(example.rowCount).toBe(35040);
    expect(example.daily).toHaveLength(365);
    expect(example.yearEnergyKwh).toBeCloseTo(2618.795911849218, 8);
    expect(example.previewGroups).toHaveLength(3);
    expect(example.previewGroups[0][0]).toEqual({
      date: "2025-01-10",
      time: "17:30",
      kwh: 2.75,
    });
    expect(example.previewGroups[1].map((row) => row.time)).toEqual([
      "09:45",
      "10:00",
      "10:15",
      "10:30",
    ]);
    expect(example.previewGroups[1][0]?.kwh).toBe(0);
    expect(example.previewGroups[1][1]?.kwh).toBe(2.75);
    expect(example.previewGroups[1][2]?.kwh).not.toBe(2.75);
    expect(example.previewGroups[2][0]).toEqual({
      date: "2025-01-12",
      time: "10:00",
      kwh: 0,
    });
    expect(example.week.startDate).toBe("2025-01-10");
    expect(example.week.endDate).toBe("2025-01-12");
    expect(example.week.startTime).toBe("00:00");
    expect(example.week.endTime).toBe("23:45");
    expect(example.week.points).toHaveLength(3 * 96);
    expect(example.week.points[0]).toEqual({
      x: "2025-01-10T00:00",
      y: 0,
    });
    expect(example.week.points.at(-1)).toEqual({
      x: "2025-01-12T23:45",
      y: 0,
    });
    expect(
      example.week.points.find((point) => point.x === "2025-01-10T17:30")?.y
    ).toBe(2.75);
    expect(
      example.week.points.find((point) => point.x === "2025-01-11T00:00")?.y
    ).toBe(0);
    expect(
      example.week.points.find((point) => point.x === "2025-01-11T10:00")?.y
    ).toBe(2.75);
    expect(
      example.week.points
        .filter((point) => point.x.startsWith("2025-01-12"))
        .every((point) => point.y === 0)
    ).toBe(true);
    expect(example.week.points.every((point) => Number.isFinite(point.y))).toBe(
      true
    );
    const reconstructed = example.daily.reduce((sum, point) => sum + point.y, 0);
    expect(reconstructed).toBeCloseTo(example.yearEnergyKwh, 8);
  });

  it("rejects a malformed CSV", () => {
    expect(() => parseHomeChargingCsv("Date,Time\n", "bad.csv")).toThrow(
      /empty/
    );
  });
});
