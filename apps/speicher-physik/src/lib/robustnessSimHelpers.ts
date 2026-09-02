import type { PhysicalKernelResult } from "../../../../packages/pv-core";
import { buildSpeicherChartData } from "@/lib/speicherChartData";
import { deriveRecommendedTechnicalSize } from "@/lib/speicherRecommendation";

/**
 * Shared helpers for household and Wasser/Wasser robustness runners.
 * The two analyses stay independent; only KPI extraction and concurrency
 * pooling are shared.
 */

export type RobustnessMetricKpis = {
  technicalSpeichergrenzeKwh: number;
  eigenverbrauchKwh: number;
  eigenverbrauchsquotePct: number;
  autarkiePct: number;
  netzbezugKwh: number;
  einspeisungKwh: number;
};

export function technicalSizeFromKernel(kernel: PhysicalKernelResult): number {
  const chart = buildSpeicherChartData({
    selfConsumptionWithoutStorage: kernel.averageSelfConsumptionWithoutStorageKwh,
    batterySizes: kernel.batterySizes,
    average: kernel.average,
  });
  return deriveRecommendedTechnicalSize({ data: chart.data });
}

export function kpisAtTechnicalSize(
  kernel: PhysicalKernelResult
): RobustnessMetricKpis {
  const size = technicalSizeFromKernel(kernel);
  const load = kernel.averageLoadKwhAnnual;
  const pv = kernel.averagePvYieldKwhAnnual;
  const ev0 = kernel.averageSelfConsumptionWithoutStorageKwh;

  const ev = size === 0 ? ev0 : kernel.average[size];
  const netzbezug =
    size === 0 ? load - ev : kernel.averageGridToHouseholdKwh[size];
  const einspeisung =
    size === 0 ? pv - ev : kernel.averageGridExportKwh[size];

  return {
    technicalSpeichergrenzeKwh: size,
    eigenverbrauchKwh: ev,
    eigenverbrauchsquotePct: pv > 0 ? (ev / pv) * 100 : 0,
    autarkiePct: load > 0 ? (ev / load) * 100 : 0,
    netzbezugKwh: netzbezug,
    einspeisungKwh: einspeisung,
  };
}

export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
