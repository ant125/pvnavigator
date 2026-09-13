"use client";

import type { SceneHighlightTarget } from "@/lib/calculationProgress";
import type { SpeicherInput } from "../types/speicher";

export type HeatPumpSceneKind = "luftwasser" | "wasserwasser" | "generic";

export type SystemSceneProps = {
  heatPump: boolean;
  heatPumpKind: HeatPumpSceneKind;
  ev: boolean;
  backupReserve: boolean;
  highlight?: SceneHighlightTarget;
  className?: string;
};

export const SYSTEM_SCENE_BASE_SRC = "/system-scene/base-house-no-label.png";
export const SYSTEM_SCENE_HP_LUFTWASSER_SRC =
  "/system-scene/heat-pump-luftwasser.png";
export const SYSTEM_SCENE_HP_NEUTRAL_SRC = "/system-scene/heat-pump-neutral.png";
export const SYSTEM_SCENE_HP_WASSERWASSER_SRC =
  "/system-scene/wasser-wassser.png";
export const SYSTEM_SCENE_EV_SRC = "/system-scene/ev-set.png";

export function systemSceneFromForm(
  form: Partial<SpeicherInput>
): Pick<SystemSceneProps, "heatPump" | "heatPumpKind" | "ev" | "backupReserve"> {
  return {
    heatPump: form.heatPumpEnabled === true,
    heatPumpKind:
      form.heatPumpTechnology === "wasserwasser"
        ? "wasserwasser"
        : form.heatPumpTechnology === "luftwasser"
          ? "luftwasser"
          : "generic",
    ev: form.evEnabled === true,
    backupReserve: (form.backupReserveKwh ?? 0) > 0,
  };
}

function layerClass(
  highlight: SceneHighlightTarget | undefined,
  target: NonNullable<SceneHighlightTarget>
): string {
  return highlight === target ? "sg-scene-layer sg-scene-active" : "sg-scene-layer";
}

function heatPumpSrc(kind: HeatPumpSceneKind): string {
  return kind === "luftwasser"
    ? SYSTEM_SCENE_HP_LUFTWASSER_SRC
    : kind === "wasserwasser"
      ? SYSTEM_SCENE_HP_WASSERWASSER_SRC
      : SYSTEM_SCENE_HP_NEUTRAL_SRC;
}

function heatPumpSize(kind: HeatPumpSceneKind): { width: number; height: number } {
  if (kind === "luftwasser") return { width: 393, height: 381 };
  if (kind === "wasserwasser") return { width: 1079, height: 1457 };
  return { width: 330, height: 446 };
}

export function SystemScene({
  heatPump,
  heatPumpKind,
  ev,
  backupReserve,
  highlight = null,
  className,
}: SystemSceneProps) {
  const parts = ["Haus mit PV-Dach und Batteriespeicher im Inneren"];
  if (heatPump) {
    parts.push(
      heatPumpKind === "luftwasser"
        ? "Wärmepumpe außen links"
        : "Wärmepumpe im Haus"
    );
  }
  if (ev) parts.push("Elektroauto und Wallbox rechts");
  if (backupReserve) {
    parts.push("Notstromreserve links außerhalb des Speichers");
  }

  const pumpSize = heatPumpSize(heatPumpKind);

  return (
    <div
      className={className ? `${className} sg-scene-frame` : "sg-scene-frame"}
      role="img"
      aria-label={`Schematische Darstellung: ${parts.join(", ")}. Die Zeichnung zeigt nicht das tatsächliche Gebäude.`}
      data-heat-pump={heatPump ? "true" : "false"}
      data-heat-pump-kind={heatPumpKind}
      data-ev={ev ? "true" : "false"}
      data-backup-reserve={backupReserve ? "true" : "false"}
    >
      <div
        className={
          highlight === "house" || highlight === "battery"
            ? "sg-scene-house sg-scene-active"
            : "sg-scene-house"
        }
      >
        <img
          src={SYSTEM_SCENE_BASE_SRC}
          alt=""
          width={1533}
          height={1026}
        />
      </div>

      {heatPump && heatPumpKind === "luftwasser" ? (
        <svg className="sg-scene-pipes" viewBox="0 0 1600 900" aria-hidden="true">
          <path d="M285 628 H318 Q330 628 330 616 V601 H362 M285 642 H326 Q344 642 344 628 V615 H362" />
        </svg>
      ) : null}

      {heatPump ? (
        <div
          className={`${layerClass(highlight, "heatPump")} sg-scene-hp sg-scene-hp-${heatPumpKind} sg-scene-equip`}
          data-testid={`heat-pump-${heatPumpKind}`}
        >
          <img
            src={heatPumpSrc(heatPumpKind)}
            alt=""
            width={pumpSize.width}
            height={pumpSize.height}
          />
        </div>
      ) : null}

      {ev ? (
        <div
          className={`${layerClass(highlight, "ev")} sg-scene-ev sg-scene-equip`}
          data-testid="ev-set"
        >
          <img src={SYSTEM_SCENE_EV_SRC} alt="" width={580} height={409} />
        </div>
      ) : null}

      {backupReserve ? (
        <div
          className={`${layerClass(highlight, "battery")} sg-scene-backup sg-scene-equip`}
          data-testid="backup-badge"
        >
          <NotstromBadge />
        </div>
      ) : null}
    </div>
  );
}

function NotstromBadge() {
  return (
    <svg
      viewBox="0 0 64 72"
      className="sg-scene-badge"
      aria-hidden="true"
    >
      <path
        d="M32 3.5 L56 12.5 V34 c0 16.5-10.8 28.2-24 34.2 C18.8 62.7 8 51 8 34 V12.5 Z"
        fill="#fbf9f3"
        stroke="#454942"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M35.5 16 L22 36.5 h9.2 L27.2 55.5 44.5 33.2 h-9.4 Z"
        fill="#b77c28"
      />
    </svg>
  );
}
