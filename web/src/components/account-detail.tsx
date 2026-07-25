import type { HoldingRow, LiabilityRow } from "@/lib/queries";
import * as money from "@/lib/money";
import { cn, humanizeCategory } from "@/lib/utils";

/**
 * The extra detail Plaid's Investments and Liabilities products provide,
 * rendered inline under the account it belongs to. Both are optional per
 * institution, so both render nothing rather than an empty shell when absent.
 */

export function HoldingsTable({ holdings }: { holdings: HoldingRow[] }) {
  if (holdings.length === 0) return null;

  const total = money.add(...holdings.map((h) => h.value));

  return (
    <div className="border-t bg-[var(--page)]/50 px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="text-[0.75rem] font-medium tracking-wide text-[var(--ink-secondary)] uppercase">
          Holdings
        </h4>
        <span className="text-[0.8125rem] font-medium tabular">{money.display(total)}</span>
      </div>

      {/* Wide content scrolls inside its own container so the page never does. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[0.8125rem]">
          <thead>
            <tr className="text-left text-[var(--ink-secondary)]">
              <th className="pb-2 font-medium">Security</th>
              <th className="pb-2 text-right font-medium">Shares</th>
              <th className="pb-2 text-right font-medium">Price</th>
              <th className="pb-2 text-right font-medium">Value</th>
              <th className="pb-2 text-right font-medium">Gain</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {holdings.map((holding) => (
              <tr key={holding.id}>
                <td className="py-2 pr-3">
                  <span className="font-medium">
                    {holding.tickerSymbol ?? holding.name ?? "—"}
                  </span>
                  {holding.tickerSymbol && holding.name ? (
                    <span className="ml-2 text-[var(--ink-secondary)]">{holding.name}</span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular">{trimQuantity(holding.quantity)}</td>
                <td className="py-2 text-right tabular">
                  {holding.price ? money.display(holding.price) : "—"}
                </td>
                <td className="py-2 text-right font-medium tabular">
                  {money.display(holding.value)}
                </td>
                <td
                  className={cn(
                    "py-2 text-right tabular",
                    holding.gain && money.isNegative(holding.gain)
                      ? "text-[var(--negative)]"
                      : holding.gain
                        ? "text-[var(--positive)]"
                        : "text-[var(--ink-muted)]",
                  )}
                >
                  {holding.gain ? money.display(holding.gain, { signed: true }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LiabilityFacts({ detail }: { detail: LiabilityRow | undefined }) {
  if (!detail) return null;

  const facts: { label: string; value: string; alert?: boolean }[] = [];

  if (detail.apr) facts.push({ label: "APR", value: `${Number(detail.apr).toFixed(2)}%` });
  if (detail.minimumPayment) {
    facts.push({ label: "Minimum payment", value: money.display(detail.minimumPayment) });
  }
  if (detail.nextPaymentDueDate) {
    facts.push({
      label: "Next due",
      value: new Date(`${detail.nextPaymentDueDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      alert: detail.isOverdue === true,
    });
  }
  if (detail.originationPrincipal) {
    facts.push({ label: "Original", value: money.display(detail.originationPrincipal) });
  }

  if (facts.length === 0) return null;

  return (
    <div className="border-t bg-[var(--page)]/50 px-5 py-3">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-[0.75rem] font-medium tracking-wide text-[var(--ink-secondary)] uppercase">
          {humanizeCategory(detail.liabilityType)} detail
        </h4>
        {detail.isOverdue ? (
          <span className="rounded-full bg-[var(--negative)]/15 px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--negative)]">
            Overdue
          </span>
        ) : null}
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[0.75rem] text-[var(--ink-secondary)]">{fact.label}</dt>
            <dd
              className={cn(
                "text-[0.8125rem] font-medium tabular",
                fact.alert && "text-[var(--negative)]",
              )}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 12.500000 → 12.5, but 0.25 stays 0.25. Trailing zeros are noise on share counts. */
function trimQuantity(quantity: string): string {
  const n = Number(quantity);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}
