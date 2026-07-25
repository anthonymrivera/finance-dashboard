"use client";

import type { CategorySpend } from "@/lib/queries";
import * as money from "@/lib/money";
import { categorySlot, humanizeCategory, seriesColor } from "@/lib/utils";

/**
 * Spending by category, as ranked horizontal bars.
 *
 * Horizontal rather than a pie or donut: comparing arc angles is far harder than
 * comparing bar lengths, and category names are long enough that radial labels
 * would collide. A ranked list is also how the question is actually asked —
 * "where did the money go, most first".
 *
 * Every bar carries a direct value label. That is required, not decorative:
 * three slots in the categorical palette fall below 3:1 contrast on the light
 * surface, and the relief rule says such a palette must ship visible labels.
 *
 * Beyond eight categories the tail folds into "Other" rather than generating a
 * ninth hue.
 */
const MAX_SLICES = 8;

export function CategoryBreakdown({ data }: { data: CategorySpend[] }) {
  const top = data.slice(0, MAX_SLICES);
  const rest = data.slice(MAX_SLICES);

  const rows = [...top];
  if (rest.length > 0) {
    rows.push({
      category: "OTHER",
      total: money.add(...rest.map((r) => r.total)),
      count: rest.reduce((sum, r) => sum + r.count, 0),
    });
  }

  const max = rows.reduce((m, r) => (money.compare(r.total, m) > 0 ? r.total : m), "0");
  const total = money.add(...rows.map((r) => r.total));

  return (
    <div>
      <ul className="space-y-3">
        {rows.map((row) => {
          const width = money.toNumber(max) > 0
            ? (money.toNumber(row.total) / money.toNumber(max)) * 100
            : 0;
          const share = money.toNumber(total) > 0
            ? Math.round((money.toNumber(row.total) / money.toNumber(total)) * 100)
            : 0;
          const color =
            row.category === "OTHER" ? "var(--ink-muted)" : seriesColor(categorySlot(row.category));

          return (
            <li key={row.category}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-[0.8125rem]">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="truncate">{humanizeCategory(row.category)}</span>
                </span>
                <span className="shrink-0 text-[0.8125rem] font-medium tabular">
                  {money.display(row.total)}
                  <span className="ml-1.5 font-normal text-[var(--ink-muted)]">{share}%</span>
                </span>
              </div>

              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--gridline)]"
                role="img"
                aria-label={`${humanizeCategory(row.category)}: ${money.display(row.total)}, ${share} percent of spending`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(width, 1.5)}%`, background: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
