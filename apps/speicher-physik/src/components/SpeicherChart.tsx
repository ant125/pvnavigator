"use client";

import { formatQuantityDe, formatQuantityWithUnit } from "@/lib/formatQuantityDe";
import {
  estimateBoundaryLabelWidth,
  formatTechnicalBoundaryLabel,
  placeBoundaryLabel,
} from "@/lib/speicherChartCaption";
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
  useChartWidth,
  usePlotArea,
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

const BOUNDARY_LABEL_FONT_PX = 12;

/**
 * Plot band only. Margins, the 30px category axis and the boundary caption
 * stay put, so a shorter box shortens the curve and not the type.
 * Desktop plot is 193px: 10% under the previous 214px (288px box).
 * Below `lg` the box stays 392px and the plot stays 318px.
 */
const CHART_BOX_CLASS = "h-[392px] w-full min-w-0 max-w-full lg:h-[267px]";
const CHART_MARGIN = { top: 32, right: 24, left: 8, bottom: 12 } as const;

function TechnicalBoundaryLabel({
  viewBox,
  caption,
}: LabelProps & { caption: string }) {
  const plot = usePlotArea();
  const chartWidth = useChartWidth();
  if (
    !viewBox ||
    typeof viewBox !== "object" ||
    !("width" in viewBox) ||
    typeof viewBox.x !== "number" ||
    !Number.isFinite(viewBox.x) ||
    !plot ||
    plot.width <= 0 ||
    typeof chartWidth !== "number" ||
    !Number.isFinite(chartWidth) ||
    chartWidth <= 0
  ) {
    return null;
  }

  const { x: vx, y: vy, width: vw, height: vh } = viewBox;
  const markerX = vx + vw / 2;
  const verticalSign = vh >= 0 ? 1 : -1;
  const labelY = vy - verticalSign * 10;
  const labelWidth = estimateBoundaryLabelWidth(caption, BOUNDARY_LABEL_FONT_PX);
  const placement = placeBoundaryLabel({
    markerX,
    labelWidth,
    boundsLeft: plot.x,
    boundsRight: Math.max(plot.x + 1, chartWidth - 4),
  });

  return (
    <text
      x={placement.x}
      y={labelY}
      textAnchor={placement.textAnchor}
      className="recharts-text recharts-label"
      fill={CHART.marker}
      fontSize={BOUNDARY_LABEL_FONT_PX}
    >
      {caption}
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

  const boundaryCaption =
    recommendedTechnicalSize > 0
      ? formatTechnicalBoundaryLabel(recommendedTechnicalSize)
      : null;

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className={CHART_BOX_CLASS}>
        <ResponsiveContainer>
          <LineChart
            data={visibleData}
            margin={CHART_MARGIN}
          >
            <CartesianGrid vertical={false} stroke={CHART.grid} />

            <XAxis
              dataKey="size"
              stroke={CHART.axis}
              tick={{ fill: CHART.axis, fontSize: 12 }}
              tickMargin={6}
              padding={{ left: 8, right: 8 }}
              tickFormatter={(value: number) => formatQuantityDe(Number(value), 0)}
            />

            <YAxis
              domain={yDomain}
              ticks={yTicks}
              stroke={CHART.axis}
              tick={{ fill: CHART.axis, fontSize: 12 }}
              tickMargin={8}
              tickFormatter={(value: number) => formatQuantityDe(Number(value), 0)}
            />

            {recommendedTechnicalSize > 0 && (
              <ReferenceLine
                x={recommendedTechnicalSize}
                stroke={CHART.marker}
                strokeWidth={2}
                strokeDasharray="4 4"
                label={
                  boundaryCaption ? (
                    <Label
                      position="top"
                      fill={CHART.marker}
                      fontSize={BOUNDARY_LABEL_FONT_PX}
                      offset={10}
                      content={
                        <TechnicalBoundaryLabel caption={boundaryCaption} />
                      }
                    />
                  ) : undefined
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
                    <div>
                      Eigenverbrauch:{" "}
                      {formatQuantityWithUnit(Math.round(Number(ev)), "kWh")}
                    </div>
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
