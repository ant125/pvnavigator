export const FORM_LABEL = "block text-sm font-medium text-ink";

export const FORM_HELP = "text-xs leading-relaxed text-ink-muted";

/** Label → control. 8px. */
export const FORM_FIELD = "space-y-field-gap";

/** Stacked fields inside a section. 12px. */
export const FORM_STACK = "space-y-field-group-gap";

/** Form sections. 8px between inset panels. */
export const FORM_SECTIONS = "space-y-panel-gap";

export const FORM_COLUMN_BAR =
  "flex items-center justify-between gap-2 bg-accent px-3.5 py-2 font-mono text-lg font-semibold uppercase tracking-[0.08em] text-white";

export const FORM_COLUMN_BAR_LABEL = "flex min-w-0 items-center gap-2";

export const FORM_COLUMN_BAR_TOGGLE =
  "lg:hidden -mr-1 inline-flex min-h-9 shrink-0 items-center px-2 font-mono text-lg font-semibold uppercase tracking-[0.08em] text-white/90 hover:text-white";

export const FORM_SECTION_HEADING =
  "min-w-0 font-sans text-sm font-semibold uppercase tracking-normal text-ink";

export const FORM_PANEL =
  "overflow-visible rounded-none border border-line-soft bg-surface";

export const FORM_PANEL_HEAD =
  "flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line-soft bg-surface-muted/30 px-panel-padding-x py-1.5";

export const FORM_PANEL_BODY =
  "space-y-field-group-gap px-panel-padding-x py-panel-padding-y";

export const FORM_OPTIONAL_BLOCK = "space-y-field-group-gap";

export const FORM_SUBMIT_ZONE =
  "border-t border-line bg-surface-muted px-3 py-3";

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
  return `w-full min-h-11 rounded-sm border bg-field px-3 py-1.5 text-ink placeholder-ink-muted transition-colors lg:min-h-9 disabled:cursor-not-allowed disabled:bg-surface-muted ${
    hasError ? "border-danger" : "border-field-border focus:border-accent"
  }`;
}
