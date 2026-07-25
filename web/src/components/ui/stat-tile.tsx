import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A headline number with optional context.
 *
 * Deliberately not a chart: a single value's job is to be read, and a sparkline
 * or donut around one number adds decoration without adding information. The
 * optional `delta` is the exception — change over time is a second fact.
 */
export function StatTile({
  label,
  value,
  trend,
  sentiment = "neutral",
  deltaLabel,
  hint,
  accent,
  className,
}: {
  label: string;
  value: string;
  /**
   * Which way the number moved. Drives the arrow only.
   *
   * Kept separate from `sentiment` because the two genuinely disagree: spending
   * falling is a down arrow and a good outcome. Folding them into one prop
   * produced a tile reading "↑ 21%" under the words "spent less this month".
   */
  trend?: "up" | "down" | "flat";
  /** Whether that movement is good news. Drives the color only. */
  sentiment?: "good" | "bad" | "neutral";
  deltaLabel?: string;
  hint?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-[var(--surface)] px-5 py-4",
        "shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] rounded-r"
          style={{ background: accent }}
        />
      ) : null}

      <p className="text-[0.75rem] font-medium tracking-wide text-[var(--ink-secondary)] uppercase">
        {label}
      </p>

      <p className="mt-2 text-[1.75rem] leading-none font-semibold tracking-tight tabular">
        {value}
      </p>

      {deltaLabel ? (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-[0.8125rem]",
            sentiment === "good" && "text-[var(--positive)]",
            sentiment === "bad" && "text-[var(--negative)]",
            sentiment === "neutral" && "text-[var(--ink-secondary)]",
          )}
        >
          {/* The arrow reports direction, the color reports whether that is
              welcome — so the trend never rests on color alone. */}
          {trend === "up" ? "↑" : trend === "down" ? "↓" : null}
          {deltaLabel}
        </p>
      ) : null}

      {hint ? <div className="mt-2 text-[0.8125rem] text-[var(--ink-secondary)]">{hint}</div> : null}
    </div>
  );
}
