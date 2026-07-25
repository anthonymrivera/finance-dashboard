"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared axis/grid styling, so every chart in the app reads as one system. */
export const AXIS = {
  stroke: "var(--baseline)",
  tick: { fill: "var(--ink-muted)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID = {
  stroke: "var(--gridline)",
  strokeDasharray: "0",
  vertical: false,
} as const;

/**
 * Tooltip container.
 *
 * Values wear text tokens rather than the series color — a colored swatch beside
 * the label carries identity, so the number itself stays legible against the
 * surface regardless of how light that series happens to be.
 */
export function TooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-xl border bg-[var(--surface-raised)] px-3 py-2.5 shadow-[var(--shadow-lg)]">
      <p className="mb-1.5 text-[0.75rem] font-medium text-[var(--ink-secondary)]">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2.5 text-[0.8125rem]">
            {row.color ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
            ) : null}
            <span className="text-[var(--ink-secondary)]">{row.label}</span>
            <span className="ml-auto font-medium tabular">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A legend is always present for two or more series; identity is never color alone. */
export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[0.75rem]">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-[var(--ink-secondary)]">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChartFrame({
  height = 240,
  children,
}: {
  height?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ height }} className="w-full">
      {children}
    </div>
  );
}
