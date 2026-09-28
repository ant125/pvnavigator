declare module "fontkit" {
  export interface Font {
    unitsPerEm: number;
    layout(text: string): { advanceWidth: number };
  }

  export function openSync(filename: string): Font;
}
