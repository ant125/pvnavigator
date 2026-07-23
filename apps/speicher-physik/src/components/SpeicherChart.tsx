"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Label,
  type LabelProps,
} from "recharts";

function TechnicalPlateauReferenceLabel(props: LabelProps) {
  const { offset = 5, viewBox } = props;
  if (
    !viewBox ||
    typeof viewBox !== "object" ||
    !("width" in viewBox) ||
    typeof viewBox.x !== "number" ||
    !Number.isFinite(viewBox.x)
  ) {
    return null;
  }

  const { x: vx, y: vy, width: vw, height: vh } = viewBox;
  const cx = vx + vw / 2;
  const verticalSign = vh >= 0 ? 1 : -1;
  const labelY = vy - verticalSign * offset;

  return (
    <text
      x={cx}
      y={labelY}
      textAnchor="middle"
      className="recharts-text recharts-label"
      fill="#34d399"
      fontSize={12}
    >
      Technische Speichergrenze
    </text>
  );
}

type Props = {
  data: {
    size: number;
    eigenverbrauch: number;
    deltaEigenverbrauch: number;
  }[];
  recommendedTechnicalSize: number;
};

export default function SpeicherChart({
  data,
  recommendedTechnicalSize,
}: Props) {
  const minYRaw = Math.min(...data.map((d) => d.eigenverbrauch));
  const maxY = Math.max(...data.map((d) => d.eigenverbrauch));

  const minY = Math.floor(minYRaw / 500) * 500;
  const maxYRounded = Math.ceil(maxY / 500) * 500;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="w-full h-[420px]">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
          >
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />

            <XAxis
              dataKey="size"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickMargin={6}
            />

            <YAxis
              domain={[minY, maxYRounded]}
              ticks={[
                minY,
                minY + 500,
                minY + 1000,
                minY + 1500,
                maxYRounded,
              ]}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickMargin={8}
            />

            <ReferenceLine
              x={recommendedTechnicalSize}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={
                <Label
                  position="top"
                  fill="#34d399"
                  fontSize={12}
                  offset={5}
                  content={TechnicalPlateauReferenceLabel}
                />
              }
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const ev = payload[0]?.value;
                return (
                  <div
                    className="px-3 py-2 text-sm text-slate-200"
                    style={{
                      backgroundColor: "#020617",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                  >
                    <div>Speichergröße: {label} kWh</div>
                    <div>Eigenverbrauch: {Math.round(Number(ev))} kWh</div>
                  </div>
                );
              }}
              cursor={{
                stroke: "#94a3b8",
                strokeWidth: 1,
                strokeDasharray: "4 4",
                opacity: 0.4,
              }}
            />

            <Line
              type="monotone"
              dataKey="eigenverbrauch"
              name="Eigenverbrauch"
              stroke="#34d399"
              strokeWidth={3}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const isRecommended =
                  payload.size === recommendedTechnicalSize;

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isRecommended ? 6 : 3}
                    fill={isRecommended ? "#10b981" : "#34d399"}
                    stroke={isRecommended ? "#fff" : "none"}
                    strokeWidth={isRecommended ? 2 : 0}
                  />
                );
              }}
              activeDot={{
                r: 6,
                stroke: "#34d399",
                strokeWidth: 2,
                fill: "#020617",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
