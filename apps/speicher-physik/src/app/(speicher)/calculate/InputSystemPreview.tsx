"use client";

import type { SpeicherInput } from "../types/speicher";
import { SelectedSystemChips } from "./SelectedSystemChips";
import { SystemScene, systemSceneFromForm } from "./SystemScene";

export function InputSystemPreview({
  formData,
}: {
  formData: Partial<SpeicherInput>;
}) {
  const sceneSelection = systemSceneFromForm(formData);

  return (
    <div className="sg-preview-pin rounded-sm border border-line bg-surface p-3 sm:p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-text">
        02 / Ihre Systemkonfiguration
      </p>
      <SystemScene
        heatPump={sceneSelection.heatPump}
        heatPumpKind={sceneSelection.heatPumpKind}
        ev={sceneSelection.ev}
        backupReserve={sceneSelection.backupReserve}
        className="sg-preview-scene mt-3"
      />
      <SelectedSystemChips formData={formData} />
    </div>
  );
}
