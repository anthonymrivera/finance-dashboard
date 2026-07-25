"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyFlow } from "@/lib/queries";
import * as money from "@/lib/money";
import { AXIS, ChartFrame, GRID, Legend, TooltipCard } from "./chart-shell";

const INCOME = "var(--color-series-1)";
const EXPENSES = "var(--color-series-6)";

/**
 * Income against spending, by month.
 *
 * Grouped rather than stacked: the question is "did I earn more than I spent",
 * which is a comparison of two bar heights. Stacking would make the total the
 * salient quantity instead, which is not a meaningful number here.
 *
 * One y-axis, in dollars, for both series — never a second scale.
 */
export function CashFlowChart({ data }: { data: MonthlyFlow[] }) {
  const rows = data.map((d) => ({
    month: formatMonth(d.month),
    income: money.toNumber(d.income),
    expenses: money.toNumber(d.expenses),
    net: d.net,
  }));

  return (
    <div>
      <Legend
        className="mb-3"
        items={[
          { label: "Income", color: INCOME },
          { label: "Spending", color: EXPENSES },
        ]}
      />

      <ChartFrame height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barGap={2}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="month" {...AXIS} />
            <YAxis {...AXIS} tickFormatter={(v: number) => compactUsd(v)} width={56} />
            <Tooltip
              cursor={{ fill: "var(--gridline)", opacity: 0.35 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (typeof rows)[number];
                return (
                  <TooltipCard
                    title={String(label)}
                    rows={[
                      { label: "Income", value: money.display(String(row.income)), color: INCOME },
                      {
                        label: "Spending",
                        value: money.display(String(row.expenses)),
                        color: EXPENSES,
                      },
                      { label: "Net", value: money.display(row.net, { signed: true }) },
                    ]}
                  />
                );
              }}
            />
            {/* 4px rounded data-ends, anchored to the baseline. */}
            <Bar dataKey="income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expenses" fill={EXPENSES} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function formatMonth(iso: string): string {
  const [year, month] = iso.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

function compactUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(value);
}
