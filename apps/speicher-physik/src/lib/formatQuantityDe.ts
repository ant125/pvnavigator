/**
 * Display-only German quantities.
 *
 * Grouping uses U+202F once the integer part has four or more digits.
 * The decimal separator is a comma. Callers that already rounded keep that
 * value: omit `fractionDigits` and an integer is grouped without `toFixed`.
 * Pass `fractionDigits` only to replace an existing `toFixed(digits)` display.
 */

const NARROW_NO_BREAK_SPACE = "\u202F";
const NO_BREAK_SPACE = "\u00A0";

function groupIntegerDigits(intRaw: string): string {
  if (intRaw.length < 4) return intRaw;
  return intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NO_BREAK_SPACE);
}

function formatUnsigned(unsigned: string): string {
  const [intRaw, frac] = unsigned.split(".");
  const grouped = groupIntegerDigits(intRaw);
  return frac !== undefined && frac.length > 0 ? `${grouped},${frac}` : grouped;
}

export function formatQuantityDe(value: number, fractionDigits?: number): string {
  if (!Number.isFinite(value)) return "";

  if (fractionDigits === undefined) {
    if (Number.isInteger(value)) {
      const negative = value < 0;
      const grouped = groupIntegerDigits(String(Math.abs(value)));
      return negative ? `-${grouped}` : grouped;
    }
    const raw = String(value);
    const negative = raw.startsWith("-");
    return negative ? `-${formatUnsigned(raw.slice(1))}` : formatUnsigned(raw);
  }

  const digits = Math.max(0, fractionDigits);
  const fixed = value.toFixed(digits);
  const negative = fixed.startsWith("-");
  return negative
    ? `-${formatUnsigned(fixed.slice(1))}`
    : formatUnsigned(fixed);
}

/** Number and unit stay on one line. Does not round beyond `fractionDigits`. */
export function formatQuantityWithUnit(
  value: number,
  unit: string,
  fractionDigits?: number
): string {
  return `${formatQuantityDe(value, fractionDigits)}${NO_BREAK_SPACE}${unit}`;
}
