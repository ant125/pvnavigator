/**
 * "Nur zur privaten Nutzung" marking for free reports.
 *
 * One diagonal mark per page, drawn as glyph outlines (vector paths), not as
 * text: it sits beneath the content, cannot be selected or copied along with
 * the report text, and does not show up in search. The compact footer caption
 * stays real text so it reads at any zoom.
 */
import * as fontkit from "fontkit";
import { PRIVATE_USE_LABEL } from "@pv-access/core";

import { pdfAsset } from "./pdfAssets";

export { PRIVATE_USE_LABEL };

const MM = 72 / 25.4;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

/** Visual tuning of the single in-page marking. */
export const PRIVATE_USE_MARK = {
  fontSize: 28,
  rotateDeg: -30,
  /** Pale enough to leave text, numbers and charts in the foreground. */
  fillOpacity: 0.06,
  color: "#2f4a3c",
} as const;

export type PrivateUseTile = {
  /** Centre of the rotated label on the page (pt, PDF page coordinates, y down). */
  x: number;
  y: number;
};

export type PrivateUseOutline = {
  /** One SVG path (y down) of the whole label at 1 pt per font unit × `scale`. */
  d: string;
  /** Multiplies font units to points for the chosen size. */
  scale: number;
  /** Advance width of the label in points. */
  width: number;
  /** Cap height in points (for vertical centring). */
  capHeight: number;
};

let cachedOutline: PrivateUseOutline | null = null;

/** Glyph outlines of the label (Inter SemiBold), cached per process. */
export function privateUseOutline(): PrivateUseOutline {
  if (cachedOutline) return cachedOutline;
  const font = fontkit.openSync(pdfAsset("fonts", "Inter-SemiBold.ttf")) as fontkit.Font;
  const run = font.layout(PRIVATE_USE_LABEL);
  const parts: string[] = [];
  let x = 0;
  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index];
    // Font space is y-up; SVG is y-down.
    const path = glyph.path
      .translate(x + position.xOffset, position.yOffset)
      .scale(1, -1);
    const d = path.toSVG();
    if (d) parts.push(d);
    x += position.xAdvance;
  });
  const scale = PRIVATE_USE_MARK.fontSize / font.unitsPerEm;
  cachedOutline = {
    d: parts.join(" "),
    scale,
    width: x * scale,
    capHeight: font.capHeight * scale,
  };
  return cachedOutline;
}

/**
 * One centred mark, kept inside the content area so neither the header rule
 * nor the footer line is touched.
 */
export function privateUseTiles(): PrivateUseTile[] {
  return [{ x: PAGE_W / 2, y: PAGE_H / 2 }];
}

/** SVG transform that puts the label's centre at (x, y), rotated. */
export function privateUseTileTransform(tile: PrivateUseTile): string {
  const outline = privateUseOutline();
  return (
    `translate(${tile.x.toFixed(2)} ${tile.y.toFixed(2)}) ` +
    `rotate(${PRIVATE_USE_MARK.rotateDeg}) ` +
    `translate(${(-outline.width / 2).toFixed(2)} ${(outline.capHeight / 2).toFixed(2)}) ` +
    `scale(${outline.scale.toFixed(6)})`
  );
}
