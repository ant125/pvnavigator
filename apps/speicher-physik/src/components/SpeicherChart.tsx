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

/**
 * Semantic chart tokens from globals.css. SVG presentation attributes are
 * parsed as CSS values, so Recharts can forward `var(...)` unchanged.
 */
const CHART = {
  grid: "var(--color-chart-grid)",
  axis: "var(--color-chart-axis)",
  line: "var(--color-chart-line)",
  marker: "var(--color-chart-marker)",
  surface: "var(--color-surface)",
} as const;

/** Y grid granularity, and the tick count the ladder aims for. */
const Y_TICK_STEP_KWH = 500;
const Y_TICK_MAX_INTERVALS = 5;

/**
 * Uniform Y ladder across the visible range: one step size, no gaps, no
 * duplicates. The step grows in 500 kWh multiples until the range fits into
 * `Y_TICK_MAX_INTERVALS` intervals, so a wide range stays readable and a narrow
 * one keeps its 500 kWh granularity.
 */
function buildYAxisScale(values: number[]): { domain: [number, number]; ticks: number[] } {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const step =
    Math.max(
      1,
      Math.ceil((rawMax - rawMin) / (Y_TICK_MAX_INTERVALS * Y_TICK_STEP_KWH))
    ) * Y_TICK_STEP_KWH;

  const min = Math.floor(rawMin / step) * step;
  const max = Math.max(Math.ceil(rawMax / step) * step, min + step);

  const ticks: number[] = [];
  for (let value = min; value <= max; value += step) {
    ticks.push(value);
  }

  return { domain: [min, max], ticks };
}

/**
 * The label is centred on the marker, so at the first and last visible capacity
 * it would reach past the plot into the Y-axis labels or the right edge. There
 * it is anchored to the inner side of the line instead.
 */
function TechnicalPlateauReferenceLabel(props: LabelProps) {
  const { offset = 5, viewBox, textAnchor = "middle" } = props;
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
  const labelX =
    textAnchor === "start" ? cx + 6 : textAnchor === "end" ? cx - 6 : cx;

  return (
    <text
      x={labelX}
      y={labelY}
      textAnchor={textAnchor}
      className="recharts-text recharts-label"
      fill={CHART.marker}
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
  /*
    Display-only view of the model data. The simulation keeps its 0 kWh
    baseline — it carries Eigenverbrauch without storage, the baseline KPIs and
    the plateau logic — but the chart shows only the capacities that were
    actually swept, so no category, segment or tooltip exists at 0 kWh.
  */
  const visibleData = data.filter((point) => point.size > 0);
  if (visibleData.length === 0) {
    return null;
  }

  const { domain: yDomain, ticks: yTicks } = buildYAxisScale(
    visibleData.map((point) => point.eigenverbrauch)
  );

  const markerIndex = visibleData.findIndex(
    (point) => point.size === recommendedTechnicalSize
  );
  const markerLabelAnchor =
    markerIndex === 0
      ? "start"
      : markerIndex === visibleData.length - 1
        ? "end"
        : "middle";

  return (
    <div className="w-full">
      <div className="w-full h-[380px]">
        <ResponsiveContainer>
          <LineChart
            data={visibleData}
            margin={{ top: 20, right: 24, left: 0, bottom: 12 }}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} />

            <XAxis
              dataKey="size"
              stroke={CHART.axis}
              tick={{ fill: CHART.axis, fontSize: 12 }}
              tickMargin={6}
              padding={{ left: 8, right: 8 }}
            />

            <YAxis
              domain={yDomain}
              ticks={yTicks}
              stroke={CHART.axis}
              tick={{ fill: CHART.axis, fontSize: 12 }}
              tickMargin={8}
            />

            {recommendedTechnicalSize > 0 && (
              <ReferenceLine
                x={recommendedTechnicalSize}
                stroke={CHART.marker}
                strokeWidth={2}
                strokeDasharray="4 4"
                label={
                  <Label
                    position="top"
                    fill={CHART.marker}
                    fontSize={12}
                    offset={5}
                    textAnchor={markerLabelAnchor}
                    content={TechnicalPlateauReferenceLabel}
                  />
                }
              />
            )}

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const ev = payload[0]?.value;
                return (
                  <div className="rounded-md border border-tooltip-border bg-tooltip-bg px-3 py-2 text-sm text-tooltip-ink shadow-sm">
                    <div>Speichergröße: {label} kWh</div>
                    <div>Eigenverbrauch: {Math.round(Number(ev))} kWh</div>
                  </div>
                );
              }}
              cursor={{
                stroke: CHART.axis,
                strokeWidth: 1,
                strokeDasharray: "4 4",
                opacity: 0.4,
              }}
            />

            <Line
              type="monotone"
              dataKey="eigenverbrauch"
              name="Eigenverbrauch"
              stroke={CHART.line}
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
                    fill={isRecommended ? CHART.marker : CHART.line}
                    stroke={isRecommended ? CHART.surface : "none"}
                    strokeWidth={isRecommended ? 2 : 0}
                  />
                );
              }}
              activeDot={{
                r: 6,
                stroke: CHART.line,
                strokeWidth: 2,
                fill: CHART.surface,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
