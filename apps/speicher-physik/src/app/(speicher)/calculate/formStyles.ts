export const FORM_LABEL = "block text-sm font-medium text-ink";

export const FORM_HELP = "text-xs leading-relaxed text-ink-muted";

export const FORM_SECTION_BAR =
  "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-white bg-accent px-3 py-2";

export const FORM_OPTIONAL_BLOCK = "space-y-3 rounded-sm bg-accent-soft/50 p-3";

export const FORM_SUBMIT_ZONE = "border-t border-line bg-surface-muted px-4 py-4";

export const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-sm border border-line bg-surface px-5 py-2.5 font-medium text-ink transition-colors hover:bg-surface-muted";

export const FORM_RADIO_LABEL =
  "flex items-center gap-2 cursor-pointer text-sm text-ink";

export const FORM_RADIO_OPTION =
  "flex items-start gap-2 cursor-pointer text-sm text-ink";

export const FORM_RADIO_HINT = "mt-0.5 block text-xs leading-relaxed text-ink-muted";

export const FORM_GROUP_HEADING =
  "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text";

export const METRIC_VALUE = "font-mono tabular-nums text-ink";

export function fieldInputClassName(hasError: boolean): string {
  return `w-full rounded-sm border bg-field px-3 py-2 text-ink placeholder-ink-muted transition-colors disabled:cursor-not-allowed disabled:bg-surface-muted ${
    hasError ? "border-danger" : "border-field-border focus:border-accent"
  }`;
}
