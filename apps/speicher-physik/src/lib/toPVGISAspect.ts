/**
 * Map UI azimuth (0° = Nord … 359°) to PVGIS `aspect` (valid range −180…180).
 */
export function toPVGISAspect(azimuthDeg: number): number {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}
