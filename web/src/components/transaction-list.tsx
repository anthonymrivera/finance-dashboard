import type { TransactionRow } from "@/lib/queries";
import * as money from "@/lib/money";
import { categorySlot, cn, humanizeCategory, seriesColor } from "@/lib/utils";

/**
 * Shared between the dashboard preview and the full transactions page.
 *
 * Amounts are right-aligned with tabular figures so digits line up column-wise,
 * and sign is carried by an explicit +/− as well as color — a red number alone
 * is not accessible.
 */
export function TransactionList({
  transactions,
  showAccount = true,
}: {
  transactions: TransactionRow[];
  showAccount?: boolean;
}) {
  return (
    <ul className="divide-y">
      {transactions.map((tx) => {
        const inflow = !money.isNegative(tx.amount);
        const category = tx.userCategory ?? tx.category;

        return (
          <li
            key={tx.id}
            className="flex items-center gap-3 px-5 py-3 transition-colors first:border-t-0 hover:bg-[var(--page)]"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: category ? seriesColor(categorySlot(category)) : "var(--ink-muted)" }}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.875rem] font-medium">
                {tx.merchantName ?? tx.name}
              </p>
              <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-secondary)]">
                {humanizeCategory(category)}
                {showAccount ? ` · ${tx.accountName}` : ""}
                {tx.accountMask ? ` ••${tx.accountMask}` : ""}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-[0.875rem] font-medium tabular",
                  inflow ? "text-[var(--positive)]" : "text-[var(--ink-primary)]",
                )}
              >
                {money.display(tx.amount, { signed: true })}
              </p>
              <p className="mt-0.5 text-[0.75rem] text-[var(--ink-secondary)]">
                {formatDate(tx.date)}
                {tx.pending ? (
                  <span className="ml-1.5 rounded bg-[var(--gridline)] px-1 py-px text-[0.625rem] font-medium text-[var(--ink-secondary)]">
                    Pending
                  </span>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
