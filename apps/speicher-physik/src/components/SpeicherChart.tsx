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
} from "recharts";

type Props = {
  data: {
    size: number;
    eigenverbrauch: number;
    deltaEigenverbrauch: number;
  }[];
  recommendedSize: number;
};

export default function SpeicherChart({ data, recommendedSize }: Props) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="w-full h-[420px]">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
          >
            <CartesianGrid vertical={false} stroke="#1e293b" />

            <XAxis
              dataKey="size"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickMargin={6}
            />

            <YAxis
              domain={[2000, 4200]}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickMargin={8}
            />

            <ReferenceLine
              x={recommendedSize}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{
                value: "Empfohlen",
                position: "top",
                fill: "#fbbf24",
                fontSize: 12,
              }}
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
              stroke="#22c55e"
              strokeWidth={3}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const isRecommended = payload.size === recommendedSize;

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isRecommended ? 6 : 3}
                    fill={isRecommended ? "#f59e0b" : "#22c55e"}
                    stroke={isRecommended ? "#fff" : "none"}
                    strokeWidth={isRecommended ? 2 : 0}
                  />
                );
              }}
              activeDot={{
                r: 6,
                stroke: "#f59e0b",
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
