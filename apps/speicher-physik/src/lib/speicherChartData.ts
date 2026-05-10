/**
 * Pure helper that prepares chart-ready data for the
 * "Eigenverbrauch vs Speichergröße" chart.
 *
 * Combines two sources that currently live in separate parts of the
 * calculation result:
 *   - `selfConsumptionWithoutStorage` (size = 0 kWh)
 *   - `average` map produced by `simulateMultiYearSpeicherGrenz`
 *     (positive battery sizes only)
 *
 * No UI, no chart library, no I/O. Safe to use on server or client.
 */

export type SpeicherChartPoint = {
  /** Battery size in kWh. `0` means "no battery". */
  size: number;
  /** Annual self-consumption (Eigenverbrauch) in kWh for this size. */
  eigenverbrauch: number;
  /**
   * Difference of `eigenverbrauch` to the previous (smaller) point in kWh.
   * `0` for the very first point (size = 0).
   * Negative values indicate non-monotonic behaviour (also reported via
   * `nonMonotonicDrops` in the result).
   */
  deltaEigenverbrauch: number;
};

export type BuildSpeicherChartDataInput = {
  /** Eigenverbrauch without any battery (size = 0), in kWh. Must be finite. */
  selfConsumptionWithoutStorage: number;
  /**
   * Battery sizes from `simulateMultiYearSpeicherGrenz` — positive kWh values
   * (e.g. 5..30). Size 0 must NOT be in this list; it is added separately.
   */
  batterySizes: ReadonlyArray<number>;
  /** Map { size -> Eigenverbrauch } from `simulateMultiYearSpeicherGrenz`. */
  average: Readonly<Record<number, number>>;
};

export type BuildSpeicherChartDataResult = {
  /** Chart-ready array, sorted by `size` ASC. Always starts with `size: 0`. */
  data: SpeicherChartPoint[];
  /**
   * Diagnostic: points where `eigenverbrauch` decreased relative to the
   * previous (smaller) battery size. Empty array means strictly monotonic.
   */
  nonMonotonicDrops: Array<{
    size: number;
    prevSize: number;
    delta: number;
  }>;
};

export function buildSpeicherChartData(
  input: BuildSpeicherChartDataInput
): BuildSpeicherChartDataResult {
  const { selfConsumptionWithoutStorage, batterySizes, average } = input;

  if (
    typeof selfConsumptionWithoutStorage !== "number" ||
    !Number.isFinite(selfConsumptionWithoutStorage)
  ) {
    throw new Error(
      "buildSpeicherChartData: selfConsumptionWithoutStorage must be a finite number"
    );
  }

  type RawPoint = { size: number; eigenverbrauch: number };
  const points: RawPoint[] = [];
  const seen = new Set<number>();

  points.push({ size: 0, eigenverbrauch: selfConsumptionWithoutStorage });
  seen.add(0);

  for (const rawSize of batterySizes) {
    if (typeof rawSize !== "number" || !Number.isFinite(rawSize)) continue;
    if (rawSize <= 0) continue;
    if (seen.has(rawSize)) continue;

    const value = average[rawSize];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;

    points.push({ size: rawSize, eigenverbrauch: value });
    seen.add(rawSize);
  }

  points.sort((a, b) => a.size - b.size);

  const data: SpeicherChartPoint[] = [];
  const nonMonotonicDrops: BuildSpeicherChartDataResult["nonMonotonicDrops"] =
    [];

  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const prev = i > 0 ? points[i - 1] : null;
    const delta = prev ? cur.eigenverbrauch - prev.eigenverbrauch : 0;

    if (prev && delta < 0) {
      nonMonotonicDrops.push({
        size: cur.size,
        prevSize: prev.size,
        delta,
      });
    }

    data.push({
      size: cur.size,
      eigenverbrauch: cur.eigenverbrauch,
      deltaEigenverbrauch: delta,
    });
  }

  return { data, nonMonotonicDrops };
}
