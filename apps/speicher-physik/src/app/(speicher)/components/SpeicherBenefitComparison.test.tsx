import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { formatQuantityWithUnit } from "@/lib/formatQuantityDe";
import { SpeicherBenefitComparison } from "./SpeicherBenefitComparison";

const NNBSP = "\u202F";
const NBSP = "\u00A0";

function render(
  props: Parameters<typeof SpeicherBenefitComparison>[0]
): string {
  return renderToStaticMarkup(<SpeicherBenefitComparison {...props} />);
}

describe("SpeicherBenefitComparison", () => {
  it("renders both columns, the shared scale, and the storage-only legend", () => {
    const html = render({
      eigenverbrauchOhneKwh: 3109.4,
      eigenverbrauchMitKwh: 6508.6,
      autarkieOhneUnroundedPct: 31.4,
      autarkieMitUnroundedPct: 64.6,
    });

    expect(html).toContain("Was bringt Ihnen der Speicher?");
    expect(html).toContain("Mehr Solarstrom selbst nutzen");
    expect(html).toContain(
      "Eigenverbrauch: Solarstrom, den Ihr Haushalt direkt oder über den Speicher nutzt."
    );
    expect(html).toContain("Weniger Strom aus dem Netz");
    expect(html).toContain(
      "Autarkie: Anteil Ihres Strombedarfs, den Ihre PV-Anlage deckt."
    );
    expect(html).toContain(formatQuantityWithUnit(3109.4, "kWh", 0));
    expect(html).toContain(formatQuantityWithUnit(6508.6, "kWh", 0));
    expect(html).toContain(formatQuantityWithUnit(31, "%"));
    expect(html).toContain(formatQuantityWithUnit(65, "%"));
    expect(html).toContain(formatQuantityWithUnit(7000, "kWh/Jahr"));
    expect(html).toContain(
      `Rund ${formatQuantityWithUnit(3399, "kWh")} mehr selbst genutzt / Jahr`
    );
    expect(html).toContain(
      `Rund ${formatQuantityWithUnit(35, "%")} kommen noch aus dem Netz`
    );
    expect(html).toContain("Eigener Solarstrom");
    expect(html).toContain("Netzstrom");
    expect(html.match(/Eigener Solarstrom/g)).toHaveLength(1);
    expect(html.match(/Netzstrom/g)).toHaveLength(1);
    expect(html.indexOf("Mehr Solarstrom selbst nutzen")).toBeLessThan(
      html.indexOf("Eigener Solarstrom")
    );
    expect(html).toContain('data-fill="44.42');
    expect(html).toContain('data-solar="64.6"');
    expect(html).not.toContain("Eigenverbrauchsquote");
    expect(html).not.toContain("opacity");
    expect(html).not.toContain("animate-");
    expect(html).toContain("sg-speicher-nutzen-grid");
    expect(html).toContain("text-xl font-semibold");
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain("grid-cols-1");
    expect(html).toContain('class="sg-speicher-bar mt-2 h-2.5 w-full overflow-hidden rounded-[2px] bg-transparent"');
    expect(html).toContain("bg-chart-grid");
    expect(html.match(/bg-chart-grid/g)).toHaveLength(3);
  });

  it("shows Autarkie of 0 % and 100 % as full grid or full solar bars", () => {
    const html = render({
      eigenverbrauchOhneKwh: 0,
      eigenverbrauchMitKwh: 8400,
      autarkieOhneUnroundedPct: 0,
      autarkieMitUnroundedPct: 100,
    });

    expect(html).toContain('data-solar="0"');
    expect(html).toContain('data-solar="100"');
    expect(html).toContain(formatQuantityWithUnit(0, "%"));
    expect(html).toContain(formatQuantityWithUnit(100, "%"));
    expect(html).toContain(
      `Rund ${formatQuantityWithUnit(0, "%")} kommen noch aus dem Netz`
    );
    expect(html).toContain('style="width:100%"');
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("keeps long quantities on one line and sizes the bar from the raw value", () => {
    const html = render({
      eigenverbrauchOhneKwh: 9876543.2,
      eigenverbrauchMitKwh: 12345678.6,
      autarkieOhneUnroundedPct: 12.2,
      autarkieMitUnroundedPct: 88.8,
    });

    expect(html).toContain(
      `9${NNBSP}876${NNBSP}543${NBSP}kWh`
    );
    expect(html).toContain(
      `12${NNBSP}345${NNBSP}679${NBSP}kWh`
    );
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain(
      `Rund ${formatQuantityWithUnit(2469135, "kWh")} mehr selbst genutzt / Jahr`
    );
    expect(html).toContain(
      `data-fill="${(9876543.2 / 15_000_000) * 100}"`
    );
    expect(html).toContain(formatQuantityWithUnit(15000000, "kWh/Jahr"));
  });

  it("renders an em dash for missing data and does not draw a zero bar", () => {
    const html = render({
      eigenverbrauchOhneKwh: null,
      eigenverbrauchMitKwh: undefined,
      autarkieOhneUnroundedPct: null,
      autarkieMitUnroundedPct: undefined,
    });

    expect(html).toContain("Rund — kWh mehr selbst genutzt / Jahr");
    expect(html).toContain("Rund — % kommen noch aus dem Netz");
    expect(html).not.toContain("data-fill");
    expect(html).not.toContain("data-solar");
    expect(html).not.toContain("0 kWh");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("still shows a real zero Eigenverbrauch", () => {
    const html = render({
      eigenverbrauchOhneKwh: 0,
      eigenverbrauchMitKwh: 0,
      autarkieOhneUnroundedPct: 0,
      autarkieMitUnroundedPct: 0,
    });

    expect(html).toContain(formatQuantityWithUnit(0, "kWh", 0));
    expect(html).toContain('data-fill="0"');
    expect(html).toContain(
      `Rund ${formatQuantityWithUnit(0, "kWh")} mehr selbst genutzt / Jahr`
    );
    expect(html).toContain(
      `Rund ${formatQuantityWithUnit(100, "%")} kommen noch aus dem Netz`
    );
    expect(html).not.toContain("Infinity");
  });
});
