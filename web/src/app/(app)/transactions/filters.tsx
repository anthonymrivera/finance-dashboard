"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { AccountWithInstitution } from "@/lib/queries";
import { humanizeCategory } from "@/lib/utils";

const CONTROL =
  "h-9 rounded-lg border bg-[var(--surface-raised)] px-3 text-[0.8125rem] outline-none focus-visible:border-[var(--accent)]";

const RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "All", days: null },
];

/** Filters sit in one row above the content, and live in the URL so views are shareable and back works. */
export function TransactionFiltersBar({
  accounts,
  categories,
}: {
  accounts: AccountWithInstitution[];
  categories: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");

  const apply = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change invalidates the current page number.
      next.delete("page");

      router.push(`/transactions?${next.toString()}`);
    },
    [params, router],
  );

  // Debounced so typing does not fire a navigation per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;

    const timer = setTimeout(() => apply({ q: search || null }), 300);
    return () => clearTimeout(timer);
  }, [search, params, apply]);

  const activeFrom = params.get("from");
  const hasFilters = ["q", "category", "account", "from", "to"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--ink-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchant or description"
          aria-label="Search transactions"
          className={`${CONTROL} w-full pl-9`}
        />
      </div>

      <select
        value={params.get("account") ?? ""}
        onChange={(e) => apply({ account: e.target.value || null })}
        aria-label="Filter by account"
        className={CONTROL}
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.mask ? ` ••${a.mask}` : ""}
          </option>
        ))}
      </select>

      <select
        value={params.get("category") ?? ""}
        onChange={(e) => apply({ category: e.target.value || null })}
        aria-label="Filter by category"
        className={CONTROL}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {humanizeCategory(c)}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1 rounded-lg border bg-[var(--surface-raised)] p-0.5">
        {RANGES.map((range) => {
          const from = range.days === null ? null : isoDaysAgo(range.days);
          const active = range.days === null ? !activeFrom : activeFrom === from;

          return (
            <button
              key={range.label}
              onClick={() => apply({ from })}
              aria-pressed={active}
              className={`rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
                active
                  ? "bg-[var(--page)] text-[var(--ink-primary)]"
                  : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>

      {hasFilters ? (
        <button
          onClick={() => {
            setSearch("");
            router.push("/transactions");
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]"
        >
          <X className="size-3.5" aria-hidden="true" />
          Clear
        </button>
      ) : null}
    </div>
  );
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
