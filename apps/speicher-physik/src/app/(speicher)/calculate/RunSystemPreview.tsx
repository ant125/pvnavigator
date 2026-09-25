"use client";

import type { SpeicherInput } from "../types/speicher";
import { FORM_COLUMN_BAR, FORM_COLUMN_BAR_LABEL } from "./formStyles";
import { SelectedSystemChips } from "./SelectedSystemChips";
import { SystemScene, systemSceneFromForm } from "./SystemScene";

const RUN_SCENE_ID = "run-system-scene";

export function RunSystemPreview({
  formData,
  sceneOpen,
  onToggleScene,
  showColumnHeader = true,
}: {
  formData: Partial<SpeicherInput>;
  sceneOpen: boolean;
  onToggleScene: () => void;
  showColumnHeader?: boolean;
}) {
  const sceneSelection = systemSceneFromForm(formData);

  return (
    <div
      className={
        showColumnHeader
          ? "overflow-visible rounded-none border border-line bg-surface"
          : "min-w-0 px-panel-padding-x py-panel-padding-y"
      }
    >
      {showColumnHeader ? (
        <header className={FORM_COLUMN_BAR}>
          <p className={FORM_COLUMN_BAR_LABEL}>
            <span>02</span>
            <span>Ihre Systemkonfiguration</span>
          </p>
        </header>
      ) : null}
      <div
        className={
          showColumnHeader ? "px-panel-padding-x py-panel-padding-y" : undefined
        }
      >
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
    </div>
  );
}
