"use client";

import { useState } from "react";
import type { MonthlyFlow } from "@/lib/queries";
import * as money from "@/lib/money";

/**
 * Received against spent, drawn as ruled columns rather than a chart widget.
 *
 * Two series of one hue at different weights — lightness carries the
 * distinction, which every kind of colour vision reads. A legend is present
 * because there are two series, and selecting a month surfaces both figures, so
 * identity never rests on colour alone. Each month is a real button: hover,
 * tap, and keyboard all reach the same figures, and the label reads the data
 * out for assistive tech.
 */
export function FlowChart({ data }: { data: MonthlyFlow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const peak = data.reduce((max, d) => {
    const local = Math.max(money.toNumber(d.income), money.toNumber(d.expenses));
    return local > max ? local : max;
  }, 0);

  const height = (v: string) => (peak > 0 ? Math.max((money.toNumber(v) / peak) * 100, 1) : 1);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
        <span className="label flex items-center" style={{ letterSpacing: "0.11em" }}>
          <i
            aria-hidden="true"
            className="mr-2 inline-block size-2"
            style={{ background: "var(--olive)", opacity: 0.45 }}
          />
          Received
        </span>
        <span className="label flex items-center" style={{ letterSpacing: "0.11em" }}>
          <i aria-hidden="true" className="mr-2 inline-block size-2" style={{ background: "var(--olive)" }} />
          Spent
        </span>
      </div>

      <div
        className="flex h-[clamp(180px,26vh,260px)] items-end gap-[clamp(10px,2.4vw,40px)] border-b-[1.5px]"
        style={{ borderColor: "var(--heavy)" }}
        onMouseLeave={() => setHovered(null)}
      >
        {data.map((m, i) => (
          <button
            key={m.month}
            type="button"
            aria-label={`${fullMonth(m.month)}: received ${money.display(m.income)}, spent ${money.display(m.expenses)}`}
            aria-pressed={hovered === i}
            className="flex h-full max-w-[132px] flex-1 cursor-pointer items-end gap-[6px] appearance-none border-0 bg-transparent p-0"
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            onClick={() => setHovered(i)}
          >
            <b
              className="flex-1 transition-opacity duration-500"
              style={{
                height: `${height(m.income)}%`,
                background: "var(--olive)",
                opacity: hovered === null ? 0.45 : hovered === i ? 0.6 : 0.26,
              }}
            />
            <b
              className="flex-1 transition-opacity duration-500"
              style={{
                height: `${height(m.expenses)}%`,
                background: "var(--olive)",
                opacity: hovered === null ? 1 : hovered === i ? 1 : 0.5,
              }}
            />
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-[clamp(10px,2.4vw,40px)]">
        {data.map((m) => (
          <span key={m.month} className="label max-w-[132px] flex-1 text-center">
            {monthName(m.month)}
          </span>
        ))}
      </div>

      {/* Figures rather than a floating tooltip — a ledger states its numbers. */}
      <div className="mt-6 min-h-[22px]">
        {hovered !== null && data[hovered] ? (
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-[14px]">
            <span style={{ color: "var(--muted)" }}>{fullMonth(data[hovered].month)}</span>
            <span className="tabular">
              received <span style={{ color: "var(--gain)" }}>{money.display(data[hovered].income)}</span>
            </span>
            <span className="tabular">spent {money.display(data[hovered].expenses)}</span>
            <span className="tabular">
              net {money.display(data[hovered].net, { signed: true })}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function monthName(iso: string): string {
  const [y, m] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function fullMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
