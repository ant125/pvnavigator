"use client";

import type { SpeicherInput } from "../types/speicher";
import { SelectedSystemChips } from "./SelectedSystemChips";
import { SystemScene, systemSceneFromForm } from "./SystemScene";

const RUN_SCENE_ID = "run-system-scene";

export function RunSystemPreview({
  formData,
  sceneOpen,
  onToggleScene,
}: {
  formData: Partial<SpeicherInput>;
  sceneOpen: boolean;
  onToggleScene: () => void;
}) {
  const sceneSelection = systemSceneFromForm(formData);

  return (
    <div className="rounded-sm border border-line bg-surface p-3 sm:p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-text">
        02 / Ihre Systemkonfiguration
      </p>
      <SelectedSystemChips formData={formData} />
      <button
        type="button"
        className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-text hover:text-accent-hover"
        aria-expanded={sceneOpen}
        aria-controls={RUN_SCENE_ID}
        onClick={onToggleScene}
      >
        {sceneOpen ? "Szene ausblenden" : "Szene anzeigen"}
      </button>
      {sceneOpen ? (
        <div id={RUN_SCENE_ID}>
          <SystemScene
            heatPump={sceneSelection.heatPump}
            heatPumpKind={sceneSelection.heatPumpKind}
            ev={sceneSelection.ev}
            backupReserve={sceneSelection.backupReserve}
            className="mt-3"
          />
        </div>
      ) : (
        <div id={RUN_SCENE_ID} hidden />
      )}
    </div>
  );
}
