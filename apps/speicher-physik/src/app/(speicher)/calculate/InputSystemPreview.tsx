"use client";

import type { SpeicherInput } from "../types/speicher";
import { FORM_COLUMN_BAR, FORM_COLUMN_BAR_LABEL } from "./formStyles";
import { SelectedSystemChips } from "./SelectedSystemChips";
import { SystemScene, systemSceneFromForm } from "./SystemScene";

export function InputSystemPreview({
  formData,
}: {
  formData: Partial<SpeicherInput>;
}) {
  const sceneSelection = systemSceneFromForm(formData);

  return (
    <div className="sg-preview-pin overflow-visible rounded-none border border-line bg-surface">
      <header className={FORM_COLUMN_BAR}>
        <p className={FORM_COLUMN_BAR_LABEL}>
          <span>02</span>
          <span>Ihre Systemkonfiguration</span>
        </p>
      </header>
      <div className="px-panel-padding-x py-panel-padding-y">
        <SystemScene
          heatPump={sceneSelection.heatPump}
          heatPumpKind={sceneSelection.heatPumpKind}
          ev={sceneSelection.ev}
          backupReserve={sceneSelection.backupReserve}
          className="sg-preview-scene"
        />
        <SelectedSystemChips formData={formData} />
      </div>
    </div>
  );
}
