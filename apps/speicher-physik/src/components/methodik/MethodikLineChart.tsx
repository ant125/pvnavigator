"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MethodikChartPoint } from "@/lib/methodik/exampleCsv";

const CHART = {
  grid: "var(--color-chart-grid)",
  axis: "var(--color-chart-axis)",
  line: "var(--color-chart-line)",
  tooltipBg: "var(--color-tooltip-bg)",
  tooltipBorder: "var(--color-tooltip-border)",
  tooltipInk: "var(--color-tooltip-ink)",
} as const;

const WEEKDAYS_DE = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;

const WEEKDAYS_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

function parseChartDate(value: string): {
  year: number;
  month: number;
  day: number;
  time?: string;
} {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return { year, month, day, time: timePart };
}

function weekdayIndex(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function periodTicks(data: readonly MethodikChartPoint[]): string[] {
  return data
    .filter((point) => {
      const time = point.x.slice(11);
      return time === "00:00" || time === "12:00" || time === "18:00";
    })
    .map((point) => point.x);
}

function formatDayTick(value: string): string {
  const { year, month, day, time } = parseChartDate(value);
  if (time && time !== "00:00") {
    return time;
  }
  const weekday = WEEKDAYS_SHORT_DE[weekdayIndex(year, month, day)];
  return `${weekday} ${day}.${month}.`;
}

function formatTooltipDate(value: string): { date: string; time: string } {
  const { year, month, day, time } = parseChartDate(value);
  const weekday = WEEKDAYS_DE[weekdayIndex(year, month, day)];
  const monthName = MONTHS_DE[month - 1];
  return {
    date: `${weekday}, ${day}. ${monthName} ${year}`,
    time: time ? `${time} Uhr` : "",
  };
}

function formatNumberDe(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function ChartTooltip({
  active,
  payload,
  label,
  seriesLabel,
}: {
  active?: boolean;
  payload?: readonly { value?: unknown }[];
  label?: string;
  seriesLabel: string;
}) {
  if (!active || payload == null || payload.length === 0 || label == null) {
    return null;
  }

  const { date, time } = formatTooltipDate(label);
  const value = Number(payload[0]?.value);

  return (
    <div
      className="px-3 py-2 text-[13px] leading-snug"
      style={{
        background: CHART.tooltipBg,
        border: `1px solid ${CHART.tooltipBorder}`,
        borderRadius: 4,
        color: CHART.tooltipInk,
      }}
    >
      <p>{date}</p>
      {time ? (
        <p className="mt-0.5" style={{ opacity: 0.72 }}>
          {time}
        </p>
      ) : null}
      <p className="mt-1.5 tabular-nums">
        {seriesLabel}: {formatNumberDe(value)} kWh
      </p>
    </div>
  );
}

export function MethodikLineChart({
  data,
  seriesLabel,
  xLabel,
  yLabel,
  caption,
}: {
  data: readonly MethodikChartPoint[];
  seriesLabel: string;
  xLabel: string;
  yLabel: string;
  caption?: string;
}) {
  const ticks = periodTicks(data);

  return (
    <figure className="my-6 w-full min-w-0 sm:-mx-1">
      <p className="mb-1.5 text-xs text-ink-muted">{yLabel}</p>
      <div className="border border-line bg-surface px-1 py-3 sm:px-2 sm:py-4">
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[...data]}
              margin={{ top: 8, right: 10, left: 4, bottom: 8 }}
            >
              <CartesianGrid stroke={CHART.grid} />
              <XAxis
                dataKey="x"
                ticks={ticks}
                tickFormatter={formatDayTick}
                tick={{ fill: CHART.axis, fontSize: 12 }}
                axisLine={{ stroke: CHART.grid }}
                tickLine={{ stroke: CHART.grid }}
                tickMargin={8}
                interval={0}
                minTickGap={0}
              />
              <YAxis
                tick={{ fill: CHART.axis, fontSize: 12 }}
                axisLine={{ stroke: CHART.grid }}
                tickLine={{ stroke: CHART.grid }}
                width={40}
                tickMargin={6}
                tickFormatter={(value: number) => formatNumberDe(value)}
              />
              <Tooltip
                content={({ active, payload, label }) => (
                  <ChartTooltip
                    active={active}
                    payload={payload}
                    label={label == null ? undefined : String(label)}
                    seriesLabel={seriesLabel}
                  />
                )}
              />
              <Line
                type="stepAfter"
                dataKey="y"
                name={seriesLabel}
                stroke={CHART.line}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="mt-1.5 text-center text-xs text-ink-muted">{xLabel}</p>
      {caption ? (
        <figcaption className="mt-2 max-w-reading text-xs leading-relaxed text-ink-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
