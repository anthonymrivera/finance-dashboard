import Link from "next/link";
import { Landmark, TrendingUp } from "lucide-react";
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
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/page-header";
import { SyncButton } from "@/components/sync-button";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { TransactionList } from "@/components/transaction-list";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategoryBreakdown } from "@/components/charts/category-breakdown";
import { NetWorthTrend } from "@/components/charts/net-worth-trend";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const monthStart = startOfMonth();
  const today = isoDate(new Date());

  // Independent queries, so fire them together rather than awaiting in sequence.
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
      <>
        <PageHeader title="Overview" />
        <Card>
          <EmptyState
            icon={<Landmark className="size-8" />}
            title="No accounts yet"
            description="Link a bank to pull in balances and transactions automatically. Everything you connect shows up here in one view."
            action={<PlaidLinkButton label="Link your first account" />}
          />
        </Card>
      </>
    );
  }

  const monthSpend = spending.reduce((sum, s) => money.add(sum, s.total), "0");
  const thisMonth = cashFlow.at(-1);
  const lastMonth = cashFlow.at(-2);

  const spendDelta =
    thisMonth && lastMonth && money.toNumber(lastMonth.expenses) > 0
      ? Math.round(
          ((money.toNumber(thisMonth.expenses) - money.toNumber(lastMonth.expenses)) /
            money.toNumber(lastMonth.expenses)) *
            100,
        )
      : null;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${accounts.length} account${accounts.length === 1 ? "" : "s"} connected`}
        action={
          <>
            <SyncButton />
            <PlaidLinkButton label="Add" size="sm" />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Net worth"
          value={money.display(netWorth.netWorth)}
          accent="var(--color-series-1)"
          className="animate-in"
        />
        <StatTile
          label="Assets"
          value={money.display(netWorth.assets)}
          accent="var(--color-series-2)"
          className="animate-in [animation-delay:40ms]"
        />
        <StatTile
          label="Liabilities"
          value={money.display(netWorth.liabilities)}
          accent="var(--color-series-6)"
          className="animate-in [animation-delay:80ms]"
        />
        <StatTile
          label="Spent this month"
          value={money.display(monthSpend)}
          // Arrow follows the number; color follows whether spending less is good.
          trend={spendDelta === null ? undefined : spendDelta > 0 ? "up" : "down"}
          sentiment={spendDelta === null ? "neutral" : spendDelta > 0 ? "bad" : "good"}
          deltaLabel={
            spendDelta === null ? undefined : `${Math.abs(spendDelta)}% vs last month`
          }
          accent="var(--color-series-3)"
          className="animate-in [animation-delay:120ms]"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="animate-in [animation-delay:160ms]">
          <CardHeader
            title="Net worth"
            description={
              history.length > 1
                ? "Last 90 days"
                : "Recorded daily — a trend appears once there is more than one day of history"
            }
          />
          <CardBody>
            {history.length > 1 ? (
              <NetWorthTrend data={history} />
            ) : (
              <EmptyState
                icon={<TrendingUp className="size-7" />}
                title="Not enough history yet"
                description="Net worth is snapshotted once a day. Check back tomorrow to see the first trend."
              />
            )}
          </CardBody>
        </Card>

        <Card className="animate-in [animation-delay:200ms]">
          <CardHeader title="Cash flow" description="Income against spending, last 6 months" />
          <CardBody>
            {cashFlow.length > 0 ? (
              <CashFlowChart data={cashFlow} />
            ) : (
              <EmptyState title="No transactions yet" description="Sync to pull in your history." />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="animate-in lg:col-span-2 [animation-delay:240ms]">
          <CardHeader title="Where it went" description="This month, by category" />
          <CardBody>
            {spending.length > 0 ? (
              <CategoryBreakdown data={spending} />
            ) : (
              <EmptyState title="Nothing spent yet this month" />
            )}
          </CardBody>
        </Card>

        <Card className="animate-in lg:col-span-3 [animation-delay:280ms]">
          <CardHeader
            title="Recent activity"
            action={
              <Link
                href="/transactions"
                className="text-[0.8125rem] font-medium text-[var(--accent)] hover:underline"
              >
                View all
              </Link>
            }
          />
          {recent.rows.length > 0 ? (
            <div className="border-t">
              <TransactionList transactions={recent.rows} />
            </div>
          ) : (
            <EmptyState title="No transactions yet" />
          )}
        </Card>
      </div>
    </>
  );
}

function startOfMonth(): string {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
