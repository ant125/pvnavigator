import {
  formatQuantityDe,
  formatQuantityWithUnit,
} from "@/lib/formatQuantityDe";

/**
 * Display copy for the Eigenverbrauch chart. Reads points the simulation
 * already produced. Does not interpolate, extrapolate, or resimulate.
 */

const SIZE_MATCH_KWH = 1e-6;

/**
 * Inter at this chart's sizes is about 0.52em per character. 0.54 leaves a
 * small margin so a centred caption flips to the inner side before it clips.
 */
const LABEL_WIDTH_EM = 0.54;

export type AfterBoundaryEigenverbrauch = {
  boundaryKwh: number;
  lastSizeKwh: number;
  /** Unrounded difference of the two stored Eigenverbrauch values, in kWh. */
  additionalEigenverbrauchKwh: number;
};

export type BoundaryLabelAnchor = "start" | "middle" | "end";

export function estimateBoundaryLabelWidth(
  text: string,
  fontSizePx: number,
): number {
  return text.length * fontSizePx * LABEL_WIDTH_EM;
}

/**
 * Keeps a single-line caption inside the plot. Centred on the marker when it
 * fits; otherwise it hangs on the side that stays inside the bounds.
 */
export function placeBoundaryLabel(input: {
  markerX: number;
  labelWidth: number;
  boundsLeft: number;
  boundsRight: number;
  gap?: number;
}): { x: number; textAnchor: BoundaryLabelAnchor } {
  const gap = input.gap ?? 6;
  const { markerX, labelWidth, boundsLeft, boundsRight } = input;
  const span = boundsRight - boundsLeft;

  if (!(labelWidth > 0) || !(span > 0) || !Number.isFinite(markerX)) {
    return { x: boundsLeft, textAnchor: "start" };
  }

  if (labelWidth >= span) {
    return { x: boundsLeft, textAnchor: "start" };
  }

  const half = labelWidth / 2;
  if (markerX - half >= boundsLeft && markerX + half <= boundsRight) {
    return { x: markerX, textAnchor: "middle" };
  }

  if (markerX - half < boundsLeft) {
    const x = Math.min(
      Math.max(markerX + gap, boundsLeft),
      boundsRight - labelWidth,
    );
    return { x, textAnchor: "start" };
  }

  const right = Math.max(
    Math.min(markerX - gap, boundsRight),
    boundsLeft + labelWidth,
  );
  return { x: right, textAnchor: "end" };
}

export function boundaryLabelLeft(
  placement: { x: number; textAnchor: BoundaryLabelAnchor },
  labelWidth: number,
): number {
  if (placement.textAnchor === "end") return placement.x - labelWidth;
  if (placement.textAnchor === "middle") return placement.x - labelWidth / 2;
  return placement.x;
}

export function formatTechnicalBoundaryLabel(sizeKwh: number): string {
  return `Technische Speichergrenze · ${formatQuantityWithUnit(sizeKwh, "kWh")}`;
}

/**
 * Eigenverbrauch at the technical boundary versus the last simulated capacity
 * strictly to the right of it. Missing either point means there is nothing
 * to quote — the caller hides the sentence.
 */
export function afterBoundaryEigenverbrauch(
  points: ReadonlyArray<{ size: number; eigenverbrauch: number }>,
  boundaryKwh: number,
): AfterBoundaryEigenverbrauch | null {
  if (!Number.isFinite(boundaryKwh) || boundaryKwh <= 0) return null;

  const finite = points.filter(
    (point) =>
      point.size > 0 &&
      Number.isFinite(point.size) &&
      Number.isFinite(point.eigenverbrauch),
  );
  const boundary = finite.find(
    (point) => Math.abs(point.size - boundaryKwh) <= SIZE_MATCH_KWH,
  );
  if (!boundary) return null;

  let last: (typeof finite)[number] | null = null;
  for (const point of finite) {
    if (point.size <= boundary.size + SIZE_MATCH_KWH) continue;
    if (!last || point.size > last.size) last = point;
  }
  if (!last) return null;

  const additionalEigenverbrauchKwh = last.eigenverbrauch - boundary.eigenverbrauch;
  if (!Number.isFinite(additionalEigenverbrauchKwh)) return null;

  return {
    boundaryKwh: boundary.size,
    lastSizeKwh: last.size,
    additionalEigenverbrauchKwh,
  };
}

/** Rounds only the displayed difference. Sizes stay as simulated. */
export function formatAfterBoundaryEigenverbrauch(
  gain: AfterBoundaryEigenverbrauch,
): string {
  const boundary = formatQuantityDe(gain.boundaryKwh);
  const last = formatQuantityWithUnit(gain.lastSizeKwh, "kWh");
  const additional = formatQuantityWithUnit(
    Math.round(gain.additionalEigenverbrauchKwh),
    "kWh",
  );
  return `Von ${boundary} auf ${last}: zusätzlich ${additional} Solarstrom pro Jahr selbst genutzt.`;
}
