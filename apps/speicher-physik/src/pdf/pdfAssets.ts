import { existsSync } from "node:fs";
import path from "node:path";

/**
 * App root both in the monorepo checkout and in the deployed Next.js
 * function, where traced files stay next to process.cwd().
 */
export function speicherAppRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), "apps/speicher-physik"),
  ];
  for (const root of candidates) {
    if (existsSync(path.join(root, "src/pdf/assets/fonts/Inter-Regular.ttf"))) {
      return root;
    }
  }
  return candidates[0];
}

export function pdfAsset(...parts: string[]): string {
  return path.join(speicherAppRoot(), "src/pdf/assets", ...parts);
}

export function publicAsset(...parts: string[]): string {
  return path.join(speicherAppRoot(), "public", ...parts);
}

export const PDF_HOUSE_IMAGE = publicAsset(
  "system-scene",
  "base-house-no-label.png",
);
