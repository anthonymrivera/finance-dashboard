import type { TransactionRow } from "@/lib/queries";
import * as money from "@/lib/money";
import { humanizeCategory } from "@/lib/utils";

/**
 * Entries, grouped by day.
 *
 * The date prints once per group as a marginal note rather than repeating on
 * every row — a ledger says nothing twice.
 *
 * Narrow, a row is description over a meta line with the figure right-aligned.
 * Once there is width, category and account break out into their own ruled
 * columns instead of the row stretching into two islands with a gulf between
 * them. Amounts hold a strict right-aligned column at every width so they stay
 * comparable, and sign is carried by an explicit +/− as well as colour.
 */
const COLUMNS = "lg:grid-cols-[minmax(0,1fr)_minmax(0,18%)_minmax(0,20%)_minmax(140px,13%)]";

export function Entries({ rows }: { rows: TransactionRow[] }) {
  const days = groupByDay(rows);

  return (
    <div className="border-t-[1.5px]" style={{ borderColor: "var(--heavy)" }}>
      {days.map(({ date, items }) => (
        <div key={date} className="pt-6 first:pt-4">
          <div className="label mb-1.5">{formatDay(date)}</div>

          {items.map((tx) => {
            const inflow = !money.isNegative(tx.amount);
            const category = humanizeCategory(tx.userCategory ?? tx.category);
            const account = `${tx.accountName}${tx.accountMask ? ` ••${tx.accountMask}` : ""}`;

            return (
              <div
                key={tx.id}
                className={`grid grid-cols-[1fr_auto] items-baseline gap-x-8 border-b py-3.5 ${COLUMNS}`}
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[17.5px]">{tx.merchantName ?? tx.name}</div>
                  <div className="meta mt-1 truncate lg:hidden">
                    {category} · {account}
                    {tx.pending ? " · pending" : ""}
                  </div>
                </div>

                <div className="meta hidden min-w-0 truncate lg:block">{category}</div>

                <div className="meta hidden min-w-0 truncate lg:block">
                  {account}
                  {tx.pending ? " · pending" : ""}
                </div>

                <div
                  className="tabular text-right text-[16.5px] whitespace-nowrap"
                  style={{ color: inflow ? "var(--gain)" : undefined }}
                >
                  {money.display(tx.amount, { signed: true, currency: "USD" })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function groupByDay(rows: TransactionRow[]): { date: string; items: TransactionRow[] }[] {
  const map = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const list = map.get(row.date);
    if (list) list.push(row);
    else map.set(row.date, [row]);
  }
  return [...map.entries()].map(([date, items]) => ({ date, items }));
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
  });
}
