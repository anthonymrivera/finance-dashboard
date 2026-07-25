"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as money from "@/lib/money";
import { AXIS, ChartFrame, GRID, TooltipCard } from "./chart-shell";

const SERIES = "var(--color-series-1)";

export type NetWorthPoint = { date: string; netWorth: string };

/**
 * Net worth over time.
 *
 * A single series, so no legend — the card title names it. Area rather than bare
 * line purely to give the eye a magnitude cue; the fill is a low-opacity wash of
 * the same hue, not a second encoding.
 */
export function NetWorthTrend({ data }: { data: NetWorthPoint[] }) {
  const rows = data.map((d) => ({
    date: d.date,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: money.toNumber(d.netWorth),
    raw: d.netWorth,
  }));

  return (
    <ChartFrame height={200}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} minTickGap={28} />
          <YAxis
            {...AXIS}
            width={56}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                notation: "compact",
                maximumFractionDigits: 0,
              }).format(v)
            }
          />
          <Tooltip
            // Crosshair on a time series: the reader is asking "what was it on
            // this date", which needs a vertical reference line, not just a dot.
            cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as (typeof rows)[number];
              return (
                <TooltipCard
                  title={new Date(`${row.date}T00:00:00`).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  rows={[{ label: "Net worth", value: money.display(row.raw), color: SERIES }]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            fill="url(#netWorthFill)"
            // Markers appear on hover only; a dot on every point turns a trend
            // line into visual noise.
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
