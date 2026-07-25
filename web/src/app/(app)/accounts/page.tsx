import { AlertTriangle, Landmark } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getAccounts,
  getHoldings,
  getLiabilityDetails,
  getNetWorth,
  type AccountWithInstitution,
} from "@/lib/queries";
import { HoldingsTable, LiabilityFacts } from "@/components/account-detail";
import * as money from "@/lib/money";
import { cn, humanizeCategory, relativeTime } from "@/lib/utils";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/page-header";
import { SyncButton } from "@/components/sync-button";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { AddManualAccount } from "./add-manual-account";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, netWorth, holdings, liabilities] = await Promise.all([
    getAccounts(user.id),
    getNetWorth(user.id),
    getHoldings(user.id),
    getLiabilityDetails(user.id),
  ]);

  const groups = groupByInstitution(accounts);

  // Index once rather than filtering the full list inside the render loop.
  const holdingsByAccount = Map.groupBy(holdings, (h) => h.accountId);
  const liabilityByAccount = new Map(liabilities.map((l) => [l.accountId, l]));

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Linked banks update automatically. Manual accounts are yours to maintain."
        action={
          <>
            <SyncButton />
            <PlaidLinkButton label="Link bank" size="sm" />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Net worth" value={money.display(netWorth.netWorth)} accent="var(--color-series-1)" />
        <StatTile label="Assets" value={money.display(netWorth.assets)} accent="var(--color-series-2)" />
        <StatTile
          label="Liabilities"
          value={money.display(netWorth.liabilities)}
          accent="var(--color-series-6)"
        />
      </div>

      {accounts.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Landmark className="size-8" />}
            title="No accounts yet"
            description="Link a bank to pull balances and transactions automatically, or add something manually for assets Plaid cannot reach."
            action={<PlaidLinkButton label="Link your first account" />}
          />
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <Card key={group.key}>
              <CardHeader
                title={group.name}
                description={
                  group.isManual
                    ? "Tracked manually"
                    : group.lastSyncedAt
                      ? `Synced ${relativeTime(group.lastSyncedAt)}`
                      : "Not synced yet"
                }
                action={
                  <span className="text-[0.875rem] font-semibold tabular">
                    {money.display(group.total)}
                  </span>
                }
              />

              {group.errorCode ? (
                <div className="mx-5 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-3">
                  {/* Icon plus text, so the warning does not rely on color alone. */}
                  <AlertTriangle className="size-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-[0.8125rem]">
                    This connection needs attention
                    <span className="text-[var(--ink-secondary)]"> — {explainError(group.errorCode)}</span>
                  </p>
                  {group.itemId ? (
                    <PlaidLinkButton itemId={group.itemId} label="Reconnect" variant="secondary" size="sm" />
                  ) : null}
                </div>
              ) : null}

              <div className="border-t">
                <ul className="divide-y">
                  {group.accounts.map((account) => (
                    <li key={account.id} className={cn(account.isHidden && "opacity-55")}>
                      <div className="flex items-center gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.875rem] font-medium">
                          {account.name}
                          {account.mask ? (
                            <span className="ml-1.5 font-normal text-[var(--ink-muted)]">
                              ••{account.mask}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-[var(--ink-secondary)]">
                          {humanizeCategory(account.subtype ?? account.type)}
                          {account.isHidden ? " · Hidden from totals" : ""}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[0.9375rem] font-semibold tabular">
                          {money.display(account.currentBalance, {
                            currency: account.isoCurrencyCode,
                          })}
                        </p>
                        {account.availableBalance ? (
                          <p className="mt-0.5 text-[0.75rem] text-[var(--ink-secondary)] tabular">
                            {money.display(account.availableBalance, {
                              currency: account.isoCurrencyCode,
                            })}{" "}
                            available
                          </p>
                        ) : account.creditLimit ? (
                          <p className="mt-0.5 text-[0.75rem] text-[var(--ink-secondary)] tabular">
                            of {money.display(account.creditLimit)} limit
                          </p>
                        ) : null}
                        </div>
                      </div>

                      <HoldingsTable holdings={holdingsByAccount.get(account.id) ?? []} />
                      <LiabilityFacts detail={liabilityByAccount.get(account.id)} />
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-4">
        <CardHeader
          title="Add a manual account"
          description="For anything Plaid cannot link — cash, a vehicle, property, a private pension."
        />
        <CardBody>
          <AddManualAccount />
        </CardBody>
      </Card>
    </>
  );
}

type Group = {
  key: string;
  name: string;
  isManual: boolean;
  itemId: string | null;
  errorCode: string | null;
  lastSyncedAt: Date | null;
  total: string;
  accounts: AccountWithInstitution[];
};

function groupByInstitution(accounts: AccountWithInstitution[]): Group[] {
  const map = new Map<string, Group>();

  for (const account of accounts) {
    const key = account.isManual ? "__manual__" : (account.institutionName ?? "Linked bank");

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        name: account.isManual ? "Manual accounts" : (account.institutionName ?? "Linked bank"),
        isManual: account.isManual,
        itemId: account.itemId,
        errorCode: account.itemErrorCode,
        lastSyncedAt: account.lastSyncedAt,
        total: "0",
        accounts: [],
      };
      map.set(key, group);
    }

    group.accounts.push(account);

    // Hidden accounts stay visible in the list but must not move the total,
    // which is the whole point of hiding one.
    if (!account.isHidden) {
      group.total = account.isLiability
        ? money.subtract(group.total, account.currentBalance)
        : money.add(group.total, account.currentBalance);
    }
  }

  // Manual accounts last — synced institutions are the primary view.
  return [...map.values()].sort((a, b) => Number(a.isManual) - Number(b.isManual));
}

function explainError(code: string): string {
  switch (code) {
    case "ITEM_LOGIN_REQUIRED":
      return "your bank needs you to sign in again";
    case "PENDING_EXPIRATION":
      return "access expires soon and needs renewing";
    case "USER_PERMISSION_REVOKED":
      return "access was revoked at the bank";
    case "INSUFFICIENT_CREDENTIALS":
      return "additional verification is required";
    default:
      return "reconnect to resume syncing";
  }
}
