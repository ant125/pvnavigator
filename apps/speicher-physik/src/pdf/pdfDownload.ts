import { reportAttributionFromStoredInput } from "@/lib/reportAttribution";

const INVALID_FILENAME_CHAR = /[<>:"/\\|?*\u0000-\u001F\u007F]/g;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Drops characters that cannot appear in a file name and keeps German letters. */
export function sanitizeFilenamePart(value: string): string {
  return value
    .replace(INVALID_FILENAME_CHAR, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

function streetAndHouse(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "";
  const record = input as Record<string, unknown>;
  const fromFields = [asText(record.street), asText(record.houseNumber)]
    .filter(Boolean)
    .join(" ");
  if (fromFields) return fromFields;
  const display = asText(record.displayAddress);
  return display.split(",")[0]?.trim() ?? "";
}

/**
 * File name for a saved SPEICHERGRENZE report.
 * A stored client name wins. Every other report, including older rows,
 * uses the street and house number kept with that calculation.
 */
export function pdfDownloadFilename(input: unknown): string {
  const attribution = reportAttributionFromStoredInput(input);
  const raw = attribution
    ? `${attribution.clientGivenName} ${attribution.clientFamilyName}`
    : streetAndHouse(input);
  const label = sanitizeFilenamePart(raw);
  if (!label) return "SPEICHERGRENZE.pdf";
  return `SPEICHERGRENZE - ${label}.pdf`;
}

function asciiFilename(filename: string): string {
  const mapped = filename
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim();
  return mapped || "SPEICHERGRENZE.pdf";
}

export function pdfContentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFilename(filename)}"; filename*=UTF-8''${encoded}`;
}

export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* The plain filename parameter remains usable. */
    }
  }
  const quoted = /filename="([^"]*)"/.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/.exec(header);
  return plain?.[1]?.trim() ?? null;
}
