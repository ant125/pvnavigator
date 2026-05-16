/**
 * Maps UI rooftop azimuth (clockwise from North: N=0°, E=90°, S=180°, W=270°)
 * to PVGIS `aspect`: 0° = south, +90° = west, −90° = east, ±180° = north.
 *
 * PVGIS aspect = UI azimuth − 180°, after normalizing UI to [0°, 360°).
 * Yields aspects in (−180°, 180]; Nord (UI 0°) becomes −180° (equivalent to +180° for north).
 */
export function toPVGISAspect(azimuthDeg: number): number {
  const a = ((azimuthDeg % 360) + 360) % 360;
  return a - 180;
}
