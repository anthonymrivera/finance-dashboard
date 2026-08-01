"use client";

import { useId, useState } from "react";
import type { NetWorthPoint } from "@/lib/queries";
import * as money from "@/lib/money";

/**
 * Net worth over time, drawn as a single inked line over ruled paper.
 *
 * One series, so no legend — the movement's label names it. The y-domain is
 * padded rather than zero-based: a net-worth line that must include zero
 * flattens a five-figure balance into a hairline, and what the reader wants
 * here is the *shape* of the last ninety days, stated against real figures at
 * the edges.
 *
 * Selection works by pointer, touch, and keyboard (the overlay is a slider),
 * and the figures print inline below the plot — a ledger states its numbers
 * rather than floating them in a tooltip.
 */
const W = 1000;
const H = 240;
const PAD_Y = 18;

export function TrendLine({ data }: { data: NetWorthPoint[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const gradientId = useId();

  const values = data.map((d) => money.toNumber(d.netWorth));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;

  const x = (i: number) => (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - PAD_Y * 2);

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;

  const first = data[0];
  const last = data[data.length - 1];
  const change = money.subtract(last.netWorth, first.netWorth);
  const rising = !money.isNegative(change);
  const current = picked !== null ? data[picked] : null;

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-[clamp(150px,22vh,220px)] w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--olive)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--olive)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ruled paper: three hairlines, the way a ledger page is printed. */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1="0"
              x2={W}
              y1={PAD_Y + t * (H - PAD_Y * 2)}
              y2={PAD_Y + t * (H - PAD_Y * 2)}
              stroke="var(--rule)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={path}
            fill="none"
            stroke="var(--olive)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {picked !== null ? (
            <>
              <line
                x1={x(picked)}
                x2={x(picked)}
                y1={PAD_Y / 2}
                y2={H}
                stroke="var(--faint)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={x(picked)} cy={y(values[picked])} r="4" fill="var(--olive)" />
            </>
          ) : null}
        </svg>

        {/*
         * The whole plot is one slider: drag, tap, or arrow through the days.
         * A native range input gives keyboard and assistive-tech semantics for
         * free; it is visually silent and sits over the SVG.
         */}
        <input
          type="range"
          min={0}
          max={data.length - 1}
          step={1}
          value={picked ?? data.length - 1}
          onChange={(e) => setPicked(Number(e.currentTarget.value))}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === "mouse") {
              const rect = e.currentTarget.getBoundingClientRect();
              const t = (e.clientX - rect.left) / rect.width;
              setPicked(Math.round(Math.min(1, Math.max(0, t)) * (data.length - 1)));
            }
          }}
          onPointerLeave={() => setPicked(null)}
          aria-label="Inspect net worth by day"
          aria-valuetext={
            current
              ? `${formatDate(current.date)}: ${money.display(current.netWorth)}`
              : `${formatDate(last.date)}: ${money.display(last.netWorth)}`
          }
          // pan-y keeps a thumb-swipe over the plot scrolling the page; only a
          // horizontal drag scrubs.
          className="absolute inset-0 h-full w-full cursor-crosshair appearance-none bg-transparent opacity-0 [touch-action:pan-y]"
        />
      </div>

      <div
        className="flex items-baseline justify-between gap-6 border-t-[1.5px] pt-3"
        style={{ borderColor: "var(--heavy)" }}
      >
        <span className="label">{formatDate(first.date)}</span>
        <span className="label">{formatDate(last.date)}</span>
      </div>

      <div className="mt-5 min-h-[22px] text-[14px]">
        {current ? (
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <span style={{ color: "var(--muted)" }}>{formatDate(current.date)}</span>
            <span className="tabular">{money.display(current.netWorth)}</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <span style={{ color: "var(--muted)" }}>
              {daySpan(first.date, last.date)} days
            </span>
            <span className="tabular">
              <span style={{ color: rising ? "var(--gain)" : "var(--loss)" }}>
                {money.display(change, { signed: true })}
              </span>{" "}
              over the period
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daySpan(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000,
  );
}
