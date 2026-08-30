export type WpuqHouseKpis = {
  houseId: string;
  technicalSpeichergrenzeKwh: number;
  eigenverbrauchKwh: number;
  eigenverbrauchsquotePct: number;
  autarkiePct: number;
  netzbezugKwh: number;
  einspeisungKwh: number;
};

export type MetricRange = {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
};

export type SizeFrequencyRow = {
  sizeKwh: number;
  householdCount: number;
};

export type WpuqRobustnessPayload = {
  cohortSize: number;
  householdAnnualKwh: number;
  bdewTechnicalSizeKwh: number;
  sizeUnchangedCount: number;
  sizeFrequency: SizeFrequencyRow[];
  ranges: {
    eigenverbrauchKwh: MetricRange;
    eigenverbrauchsquotePct: MetricRange;
    autarkiePct: MetricRange;
    netzbezugKwh: MetricRange;
    einspeisungKwh: MetricRange;
    technicalSpeichergrenzeKwh: MetricRange;
  };
  conclusionParagraphs: string[];
  houses: WpuqHouseKpis[];
};

/** Linear interpolation, same convention as the WPuQ research benchmark. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

export function metricRange(values: readonly number[]): MetricRange {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (arr.length === 0) {
    throw new Error("metricRange: no finite values");
  }
  return {
    min: arr[0],
    p25: percentile(arr, 25),
    median: percentile(arr, 50),
    p75: percentile(arr, 75),
    max: arr[arr.length - 1],
  };
}

export function sizeFrequency(
  sizes: readonly number[]
): SizeFrequencyRow[] {
  const counts = new Map<number, number>();
  for (const size of sizes) {
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([sizeKwh, householdCount]) => ({ sizeKwh, householdCount }))
    .sort((a, b) => {
      if (b.householdCount !== a.householdCount) {
        return b.householdCount - a.householdCount;
      }
      return a.sizeKwh - b.sizeKwh;
    });
}

export function buildEngineeringConclusion(params: {
  cohortSize: number;
  sizeUnchangedCount: number;
}): string[] {
  const { cohortSize, sizeUnchangedCount } = params;
  const paragraphs: string[] = [];

  if (sizeUnchangedCount === cohortSize) {
    paragraphs.push(
      `Die technische Speichergröße blieb bei allen ${cohortSize} realen Haushaltsprofilen unverändert.`
    );
  } else {
    paragraphs.push(
      `Die technische Speichergröße blieb bei ${sizeUnchangedCount} von ${cohortSize} realen Haushaltsprofilen unverändert.`
    );
  }

  paragraphs.push(
    "Eigenverbrauch und Autarkie variierten aufgrund unterschiedlicher Nutzungsgewohnheiten."
  );

  if (sizeUnchangedCount * 2 > cohortSize) {
    paragraphs.push(
      "Diese Empfehlung kann daher als robust gegenüber unterschiedlichen Verbrauchsprofilen angesehen werden."
    );
  } else {
    paragraphs.push(
      `Die empfohlene Speichergröße hängt in diesem Fall stärker vom Lastgang ab. Die BDEW-H25-Empfehlung bleibt die Referenz; die Spannweite der ${cohortSize} Profile ist unten aufgeführt.`
    );
  }

  return paragraphs;
}

export function buildWpuqRobustnessPayload(params: {
  houses: readonly WpuqHouseKpis[];
  householdAnnualKwh: number;
  bdewTechnicalSizeKwh: number;
}): WpuqRobustnessPayload {
  const { houses, householdAnnualKwh, bdewTechnicalSizeKwh } = params;
  if (houses.length === 0) {
    throw new Error("buildWpuqRobustnessPayload: expected household results");
  }

  const sizeUnchangedCount = houses.filter(
    (h) => h.technicalSpeichergrenzeKwh === bdewTechnicalSizeKwh
  ).length;

  return {
    cohortSize: houses.length,
    householdAnnualKwh,
    bdewTechnicalSizeKwh,
    sizeUnchangedCount,
    sizeFrequency: sizeFrequency(houses.map((h) => h.technicalSpeichergrenzeKwh)),
    ranges: {
      eigenverbrauchKwh: metricRange(houses.map((h) => h.eigenverbrauchKwh)),
      eigenverbrauchsquotePct: metricRange(
        houses.map((h) => h.eigenverbrauchsquotePct)
      ),
      autarkiePct: metricRange(houses.map((h) => h.autarkiePct)),
      netzbezugKwh: metricRange(houses.map((h) => h.netzbezugKwh)),
      einspeisungKwh: metricRange(houses.map((h) => h.einspeisungKwh)),
      technicalSpeichergrenzeKwh: metricRange(
        houses.map((h) => h.technicalSpeichergrenzeKwh)
      ),
    },
    conclusionParagraphs: buildEngineeringConclusion({
      cohortSize: houses.length,
      sizeUnchangedCount,
    }),
    houses: houses.slice(),
  };
}
