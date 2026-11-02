declare module "fontkit" {
  export interface Path {
    translate(x: number, y: number): Path;
    scale(x: number, y?: number): Path;
    toSVG(): string;
  }

  export interface Glyph {
    path: Path;
    advanceWidth: number;
  }

  export interface GlyphPosition {
    xAdvance: number;
    yAdvance: number;
    xOffset: number;
    yOffset: number;
  }

  export interface GlyphRun {
    advanceWidth: number;
    glyphs: Glyph[];
    positions: GlyphPosition[];
  }

  export interface Font {
    unitsPerEm: number;
    capHeight: number;
    ascent: number;
    descent: number;
    layout(text: string): GlyphRun;
  }

  export function openSync(filename: string): Font;
}
