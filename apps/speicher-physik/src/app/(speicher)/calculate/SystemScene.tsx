"use client";

import type { SceneHighlightTarget } from "@/lib/calculationProgress";

export type HeatPumpSceneKind = "luftwasser" | "wasserwasser" | "generic";

export type SystemSceneProps = {
  heatPump: boolean;
  heatPumpKind: HeatPumpSceneKind;
  ev: boolean;
  backupReserve: boolean;
  highlight?: SceneHighlightTarget;
  className?: string;
};

function layerClass(
  highlight: SceneHighlightTarget | undefined,
  target: NonNullable<SceneHighlightTarget>
): string {
  return highlight === target ? "sg-scene-active" : "";
}

export function SystemScene({
  heatPump,
  heatPumpKind,
  ev,
  backupReserve,
  highlight = null,
  className,
}: SystemSceneProps) {
  return (
    <svg
      viewBox="0 0 820 460"
      role="img"
      aria-label="Schematische Darstellung des ausgewählten Energiesystems. Die Zeichnung zeigt nicht das tatsächliche Gebäude."
      className={className ?? "h-auto w-full"}
    >
      <title>Ausgewählte Systemkonfiguration</title>
      <desc>
        Haus mit PV-Dach und Batteriespeicher im Inneren
        {heatPump ? ", Wärmepumpe links" : ""}
        {ev ? ", Elektroauto und Wallbox rechts" : ""}
        {backupReserve ? ", Notstromreserve am Speicher" : ""}.
        Keine Echtzeitüberwachung und keine Garantie einer Notstromfunktion.
      </desc>

      <ellipse cx="410" cy="392" rx="310" ry="28" fill="#e8e1d2" />

      <g className={layerClass(highlight, "heatPump")}>
        {heatPump ? (
          heatPumpKind === "wasserwasser" ? (
            <WasserWasserMark />
          ) : heatPumpKind === "luftwasser" ? (
            <LuftWasserUnit />
          ) : (
            <GenericHeatPumpMark />
          )
        ) : null}
      </g>

      <g className={layerClass(highlight, "house")}>
        <polygon points="210,150 360,78 448,122 298,194" fill="#d8d0bf" stroke="#6f6b62" strokeWidth="1.2" />
        <polygon points="360,78 610,150 520,204 448,122" fill="#cfc6b4" stroke="#6f6b62" strokeWidth="1.2" />
        <PvArray />
        <polygon points="210,150 298,194 298,338 210,294" fill="#e7dfcf" stroke="#6f6b62" strokeWidth="1.2" />
        <polygon points="298,194 448,122 448,266 298,338" fill="#f3ecdc" stroke="#6f6b62" strokeWidth="1.2" />
        <polygon points="298,338 448,266 520,204 520,348 400,390 298,338" fill="#efe6d4" stroke="#6f6b62" strokeWidth="1.2" />
        <polygon points="448,122 610,150 610,294 520,348 520,204 448,266" fill="#ddd4c2" stroke="#6f6b62" strokeWidth="1.2" />
        <polygon points="400,210 448,186 448,250 400,274" fill="#d9cbb0" stroke="#6f6b62" strokeWidth="1" />
        <line x1="210" y1="150" x2="360" y2="78" stroke="#6f6b62" strokeWidth="1.2" />
        <rect x="348" y="62" width="14" height="28" fill="#c8c0b0" stroke="#6f6b62" strokeWidth="1" />
        <polygon points="348,62 362,54 376,62 376,70 348,70" fill="#b7ae9c" stroke="#6f6b62" strokeWidth="1" />
      </g>

      <g className={layerClass(highlight, "battery")}>
        <BatteryInside backupReserve={backupReserve} />
      </g>

      <g className={layerClass(highlight, "ev")}>
        {ev ? (
          <>
            <Wallbox />
            <ElectricCar />
          </>
        ) : null}
      </g>
    </svg>
  );
}

function PvArray() {
  const panels = [
    [248, 138, 286, 118, 304, 128, 266, 148],
    [292, 116, 330, 96, 348, 106, 310, 126],
    [336, 94, 374, 86, 392, 96, 354, 104],
    [378, 92, 430, 118, 448, 128, 396, 102],
    [432, 122, 484, 148, 502, 158, 450, 132],
    [486, 152, 538, 178, 556, 188, 504, 162],
  ];
  return (
    <g>
      {panels.map((p, i) => (
        <polygon
          key={i}
          points={`${p[0]},${p[1]} ${p[2]},${p[3]} ${p[4]},${p[5]} ${p[6]},${p[7]}`}
          fill={i % 2 === 0 ? "#4d6358" : "#3f534a"}
          stroke="#2c3b34"
          strokeWidth="0.8"
        />
      ))}
    </g>
  );
}

function BatteryInside({ backupReserve }: { backupReserve: boolean }) {
  return (
    <g>
      <polygon points="338,248 392,222 392,292 338,318" fill="#dfe8e2" stroke="#5d675f" strokeWidth="1" />
      <polygon points="392,222 418,236 418,306 392,292" fill="#c5d2cb" stroke="#5d675f" strokeWidth="1" />
      <polygon points="338,318 392,292 418,306 364,332" fill="#b7c6be" stroke="#5d675f" strokeWidth="1" />
      <rect x="352" y="258" width="28" height="8" rx="1" fill="#6d8a7a" />
      <rect x="352" y="270" width="28" height="8" rx="1" fill="#6d8a7a" />
      <text
        x="365"
        y="246"
        textAnchor="middle"
        fill="#3a3a36"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        Speicher
      </text>
      {backupReserve ? (
        <g transform="translate(404 236)">
          <circle cx="10" cy="10" r="11" fill="#fbf9f3" stroke="#2f4a3c" strokeWidth="1.4" />
          <path
            d="M10 3.5 L16.5 6.2 V11.2 C16.5 14.4 13.7 17.2 10 18.5 C6.3 17.2 3.5 14.4 3.5 11.2 V6.2 Z"
            fill="none"
            stroke="#2f4a3c"
            strokeWidth="1.1"
          />
          <path
            d="M11.4 6.2 L7.6 11.2 H10.3 L8.7 15.8 L14.2 10.2 H11.3 Z"
            fill="#2f4a3c"
          />
        </g>
      ) : null}
    </g>
  );
}

function LuftWasserUnit() {
  return (
    <g transform="translate(46 248)" data-testid="heat-pump-luftwasser">
      <polygon points="20,70 92,70 108,54 36,54" fill="#d7d0c2" stroke="#5c5a52" strokeWidth="1.1" />
      <polygon points="20,18 92,18 92,70 20,70" fill="#ece6d8" stroke="#5c5a52" strokeWidth="1.1" />
      <polygon points="92,18 108,2 108,54 92,70" fill="#ddd6c8" stroke="#5c5a52" strokeWidth="1.1" />
      <polygon points="20,18 36,2 108,2 92,18" fill="#e7e0d2" stroke="#5c5a52" strokeWidth="1.1" />
      <circle cx="56" cy="44" r="16" fill="none" stroke="#6f6b62" strokeWidth="1.2" />
      <circle cx="56" cy="44" r="4" fill="#6f6b62" />
      {[0, 45, 90, 135].map((deg) => (
        <line
          key={deg}
          x1="56"
          y1="44"
          x2={56 + Math.cos((deg * Math.PI) / 180) * 14}
          y2={44 + Math.sin((deg * Math.PI) / 180) * 14}
          stroke="#8a8578"
          strokeWidth="1"
        />
      ))}
      <text
        x="56"
        y="92"
        textAnchor="middle"
        fill="#5c5a52"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        Wärmepumpe
      </text>
    </g>
  );
}

function WasserWasserMark() {
  return (
    <g transform="translate(58 268)" data-testid="heat-pump-wasserwasser">
      <ellipse cx="48" cy="62" rx="28" ry="8" fill="#d7d0c2" stroke="#5c5a52" strokeWidth="1" />
      <rect x="36" y="18" width="24" height="44" rx="2" fill="#ece6d8" stroke="#5c5a52" strokeWidth="1.1" />
      <path d="M48 18 C40 8 56 8 48 18" fill="none" stroke="#5c5a52" strokeWidth="1.2" />
      <path d="M42 34 H54 M42 42 H54 M42 50 H54" stroke="#8a8578" strokeWidth="1" />
      <circle cx="48" cy="62" r="6" fill="#c9d4ce" stroke="#5c5a52" strokeWidth="1" />
      <text
        x="48"
        y="86"
        textAnchor="middle"
        fill="#5c5a52"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        Wärmepumpe
      </text>
    </g>
  );
}

function GenericHeatPumpMark() {
  return (
    <g transform="translate(62 268)">
      <rect x="18" y="16" width="56" height="44" rx="3" fill="#ece6d8" stroke="#5c5a52" strokeWidth="1.1" />
      <path d="M30 38 H62" stroke="#6f6b62" strokeWidth="1.2" />
      <circle cx="46" cy="38" r="6" fill="none" stroke="#6f6b62" strokeWidth="1.2" />
      <text
        x="46"
        y="80"
        textAnchor="middle"
        fill="#5c5a52"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        Wärmepumpe
      </text>
    </g>
  );
}

function Wallbox() {
  return (
    <g transform="translate(528 236)">
      <rect x="0" y="0" width="18" height="28" rx="2" fill="#ece6d8" stroke="#5c5a52" strokeWidth="1.1" />
      <rect x="4" y="6" width="10" height="8" rx="1" fill="#4d6358" />
      <path d="M9 28 C18 42 28 48 40 52" fill="none" stroke="#5c5a52" strokeWidth="1.6" />
    </g>
  );
}

function ElectricCar() {
  return (
    <g transform="translate(572 292)">
      <path
        d="M18 46 C16 34 28 22 52 18 L96 18 C118 20 132 30 138 42 L148 46 L148 62 L18 62 Z"
        fill="#f4efe4"
        stroke="#5c5a52"
        strokeWidth="1.2"
      />
      <path d="M48 20 L62 8 H98 L118 20" fill="#d7efe3" stroke="#5c5a52" strokeWidth="1" />
      <path d="M70 8 L78 20" stroke="#5c5a52" strokeWidth="0.8" />
      <circle cx="46" cy="62" r="10" fill="#ece6d8" stroke="#5c5a52" strokeWidth="1.2" />
      <circle cx="46" cy="62" r="4" fill="#8a8578" />
      <circle cx="126" cy="62" r="10" fill="#ece6d8" stroke="#5c5a52" strokeWidth="1.2" />
      <circle cx="126" cy="62" r="4" fill="#8a8578" />
      <text
        x="84"
        y="86"
        textAnchor="middle"
        fill="#5c5a52"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        Elektroauto
      </text>
    </g>
  );
}
