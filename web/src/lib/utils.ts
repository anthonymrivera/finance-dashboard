import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes so later conditional classes win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Plaid's Personal Finance Category enums are SCREAMING_SNAKE_CASE.
 * Rendered as-is they shout; this makes them read like labels.
 */
export function humanizeCategory(category: string | null | undefined): string {
  if (!category) return "Uncategorized";
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Stable category → series slot mapping.
 *
 * Hashing the category name means a given category keeps its color as filters
 * change the set of visible categories. Assigning by rank would repaint the
 * survivors every time a filter moved, which breaks the reader's mental map.
 */
export function categorySlot(category: string): number {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 8) + 1;
}

export function seriesColor(slot: number): string {
  return `var(--color-series-${((slot - 1) % 8) + 1})`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** "2 minutes ago", "3 days ago" — for last-synced timestamps. */
export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "never";

  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2592000, "month"],
    [31536000, "year"],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (let i = units.length - 1; i >= 0; i--) {
    const [threshold, unit] = units[i];
    if (seconds >= threshold) {
      return formatter.format(-Math.floor(seconds / threshold), unit);
    }
  }

  return formatter.format(-Math.floor(seconds / 60), "minute");
}
