"use client";

import type { SpeicherInput } from "../types/speicher";
import { FORM_COLUMN_BAR, FORM_COLUMN_BAR_LABEL } from "./formStyles";
import { SelectedSystemChips } from "./SelectedSystemChips";

/**
 * Running calculation: the scene was on screen right before the start, so this
 * step only restates which components are being calculated and hands the space
 * to the progress list below.
 */
export function RunSystemPreview({
  formData,
}: {
  formData: Partial<SpeicherInput>;
}) {
  return (
    <div className="overflow-visible rounded-none border border-line bg-surface">
      <header className={FORM_COLUMN_BAR}>
        <p className={FORM_COLUMN_BAR_LABEL}>
          <span>02</span>
          <span>Ihre Systemkonfiguration</span>
        </p>
      </header>
      <div className="px-panel-padding-x py-panel-padding-y">
        <SelectedSystemChips
          formData={formData}
          showNote={false}
          className="min-w-0"
        />
      </div>
    </div>
  );
}
