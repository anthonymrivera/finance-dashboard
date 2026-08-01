import { AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getAccounts,
  getHoldings,
  getLiabilityDetails,
  type AccountWithInstitution,
} from "@/lib/queries";
import { HoldingsTable, LiabilityFacts } from "@/components/account-detail";
import * as money from "@/lib/money";
import { cn, humanizeCategory, relativeTime } from "@/lib/utils";
import { Movement, Empty } from "@/components/ledger";
import { SyncButton } from "@/components/sync-button";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { AddManualAccount } from "./add-manual-account";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, holdings, liabilities] = await Promise.all([
    getAccounts(user.id),
    getHoldings(user.id),
    getLiabilityDetails(user.id),
  ]);

  const groups = groupByInstitution(accounts);

  // Index once rather than filtering the full list inside the render loop.
  const holdingsByAccount = Map.groupBy(holdings, (h) => h.accountId);
  const liabilityByAccount = new Map(liabilities.map((l) => [l.accountId, l]));

  return (
    <>
      {accounts.length === 0 ? (
        <Movement
          label="Holdings"
          first
          action={
            <div className="flex items-center gap-4">
              <SyncButton />
              <PlaidLinkButton label="Link bank" size="sm" variant="secondary" />
            </div>
          }
        >
          <Empty
            title="No accounts yet"
            hint="Link a bank to pull balances and transactions automatically, or add something manually for assets Plaid cannot reach."
            action={<PlaidLinkButton label="Link your first account" />}
          />
        </Movement>
      ) : null}

      {groups.map((group, index) => (
        <Movement
          key={group.key}
          label={group.name}
          first={index === 0}
          action={
            index === 0 ? (
              <div className="flex items-center gap-4">
                <SyncButton />
                <PlaidLinkButton label="Link bank" size="sm" variant="secondary" />
              </div>
            ) : undefined
          }
        >
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <span className="meta">
              {group.isManual
                ? "Tracked manually"
                : group.lastSyncedAt
                  ? `Synced ${relativeTime(group.lastSyncedAt)}`
                  : "Not synced yet"}
            </span>
            <span className="tabular text-[17px]">{money.display(group.total)}</span>
          </div>

          {group.errorCode ? (
            <div
              className="mb-6 flex flex-wrap items-center gap-3 border-l-2 py-3 pl-4"
              style={{ borderColor: "var(--warn)" }}
            >
              {/* Icon plus text, so the warning does not rely on colour alone. */}
              <AlertTriangle className="size-4 shrink-0" style={{ color: "var(--warn)" }} aria-hidden="true" />
              <p className="min-w-0 flex-1 text-[15px]">
                This connection needs attention
                <span style={{ color: "var(--muted)" }}> — {explainError(group.errorCode)}</span>
              </p>
              {group.itemId ? (
                <PlaidLinkButton itemId={group.itemId} label="Reconnect" variant="secondary" size="sm" />
              ) : null}
            </div>
          ) : null}

          <div className="border-t-[1.5px]" style={{ borderColor: "var(--heavy)" }}>
            {group.accounts.map((account) => (
              <div
                key={account.id}
                className={cn("border-b py-5", account.isHidden && "opacity-55")}
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-8">
                  <div className="min-w-0">
                    <div className="truncate text-[18px]">
                      {account.name}
                      {account.mask ? (
                        <span style={{ color: "var(--faint)" }}> ••{account.mask}</span>
                      ) : null}
                    </div>
                    <div className="meta mt-1.5">
                      {humanizeCategory(account.subtype ?? account.type)}
                      {account.isHidden ? " · Hidden from totals" : ""}
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <div className="tabular text-[18px]">
                      {money.display(account.currentBalance, { currency: account.isoCurrencyCode })}
                    </div>
                    {account.availableBalance ? (
                      <div className="meta tabular mt-1.5">
                        {money.display(account.availableBalance, {
                          currency: account.isoCurrencyCode,
                        })}{" "}
                        available
                      </div>
                    ) : account.creditLimit ? (
                      <div className="meta tabular mt-1.5">
                        of{" "}
                        {money.display(account.creditLimit, { currency: account.isoCurrencyCode })}{" "}
                        limit
                      </div>
                    ) : null}
                  </div>
                </div>

                <HoldingsTable holdings={holdingsByAccount.get(account.id) ?? []} />
                <LiabilityFacts detail={liabilityByAccount.get(account.id)} />
              </div>
            ))}
          </div>
        </Movement>
      ))}

      <Movement label="Add a manual account" offset={1}>
        <p className="mb-7 max-w-[46ch] text-[17px]" style={{ color: "var(--muted)" }}>
          For anything Plaid cannot link — cash, a vehicle, property, a private pension.
        </p>
        <div className="border-t-[1.5px] pt-7" style={{ borderColor: "var(--heavy)" }}>
          <AddManualAccount />
        </div>
      </Movement>
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
    /**
     * Group by the Plaid item, not by the institution's name.
     *
     * Two separate connections to the same bank — a personal and a business
     * login — share a name but are distinct items with their own tokens and
     * error states. Keying on the name merged them and took errorCode, itemId,
     * and lastSyncedAt from whichever account happened to sort first, so a
     * broken connection could show no warning banner at all while its balances
     * silently went stale.
     */
    const key = account.isManual ? "__manual__" : (account.itemId ?? "unlinked");

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
