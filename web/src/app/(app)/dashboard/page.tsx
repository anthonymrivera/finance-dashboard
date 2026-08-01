import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import {
  getAccounts,
  getCashFlow,
  getNetWorth,
  getNetWorthHistory,
  getSpendingByCategory,
  getTransactions,
} from "@/lib/queries";
import * as money from "@/lib/money";
import { Movement, Line, Empty } from "@/components/ledger";
import { FlowChart } from "@/components/charts/flow-chart";
import { TrendLine } from "@/components/charts/trend-line";
import { SpendRanking } from "@/components/charts/spend-ranking";
import { Entries } from "@/components/entries";
import { SyncButton } from "@/components/sync-button";
import { PlaidLinkButton } from "@/components/plaid-link-button";

export const dynamic = "force-dynamic";

export default async function PositionPage() {
  const user = await requireUser();

  const monthStart = startOfMonth();
  const today = isoDate(new Date());

  const [netWorth, accounts, cashFlow, spending, recent, history] = await Promise.all([
    getNetWorth(user.id),
    getAccounts(user.id),
    getCashFlow(user.id, 6),
    getSpendingByCategory(user.id, monthStart, today),
    getTransactions(user.id, { limit: 8 }),
    getNetWorthHistory(user.id, 90),
  ]);

  if (accounts.length === 0) {
    return (
      <Movement label="Nothing linked yet" first>
        <Empty
          title="No accounts yet"
          hint="Link a bank to pull in balances and transactions automatically. Everything you connect appears here."
          action={<PlaidLinkButton label="Link your first account" />}
        />
      </Movement>
    );
  }

  const visible = accounts.filter((a) => !a.isHidden);
  const assetAccounts = visible.filter((a) => !a.isLiability);
  const liabilityAccounts = visible.filter((a) => a.isLiability);

  return (
    <>
      <Movement
        label="What you hold"
        first
        action={
          <div className="flex items-center gap-4">
            <SyncButton />
            <PlaidLinkButton label="Link" size="sm" variant="secondary" />
          </div>
        }
      >
        <Line
          first
          name="Cash, deposits and investments"
          meta={institutions(assetAccounts)}
          amount={money.display(netWorth.assets)}
          under={`${assetAccounts.length} account${assetAccounts.length === 1 ? "" : "s"}`}
        />
        <Line
          name="Cards, loans and mortgage"
          meta={institutions(liabilityAccounts)}
          amount={money.display(netWorth.liabilities)}
          under={`${liabilityAccounts.length} account${liabilityAccounts.length === 1 ? "" : "s"}`}
        />
      </Movement>

      <Movement label="Trajectory · ninety days" offset={1}>
        {history.length > 1 ? (
          <TrendLine data={history} />
        ) : (
          <Empty
            title="Not enough history yet"
            hint="Your net worth is recorded once a day. The line appears after the second day."
          />
        )}
      </Movement>

      <Movement label="Flow · six months" offset={2}>
        {cashFlow.length > 0 ? (
          <FlowChart data={cashFlow} />
        ) : (
          <Empty title="No transactions yet" hint="Refresh to pull in your history." />
        )}
      </Movement>

      <Movement label="Where it went · this month">
        {spending.length > 0 ? (
          <SpendRanking data={spending} />
        ) : (
          <Empty title="Nothing spent yet this month" />
        )}
      </Movement>

      <Movement
        label="Recent entries"
        action={
          <Link
            href="/transactions"
            className="wipe font-[family-name:var(--font-sans)] text-[11.5px] tracking-[0.05em]"
            style={{ color: "var(--muted)" }}
          >
            All entries
          </Link>
        }
      >
        {recent.rows.length > 0 ? (
          <Entries rows={recent.rows} />
        ) : (
          <Empty title="No entries yet" />
        )}
      </Movement>
    </>
  );
}

/** Up to three institution names, so the line reads rather than lists. */
function institutions(accounts: { institutionName: string | null; isManual: boolean }[]): string {
  const names = [
    ...new Set(accounts.map((a) => (a.isManual ? "Manual" : (a.institutionName ?? "Linked")))),
  ];
  if (names.length === 0) return "None";
  return names.length <= 3 ? names.join(" · ") : `${names.slice(0, 3).join(" · ")} +${names.length - 3}`;
}

/**
 * First of the month in UTC. Built with Date.UTC because the result is
 * serialized with toISOString(); a local-time construction west of Greenwich
 * resolves to the previous month.
 */
function startOfMonth(): string {
  const now = new Date();
  return isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
