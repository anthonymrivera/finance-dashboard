import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getAccounts, getTransactions, getUsedCategories } from "@/lib/queries";
import * as money from "@/lib/money";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SyncButton } from "@/components/sync-button";
import { TransactionList } from "@/components/transaction-list";
import { TransactionFiltersBar } from "./filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const page = Math.max(1, Number(single(params.page) ?? 1) || 1);
  const search = single(params.q) ?? undefined;
  const category = single(params.category) ?? undefined;
  const accountId = single(params.account) ?? undefined;
  const from = single(params.from) ?? undefined;
  const to = single(params.to) ?? undefined;

  const [{ rows, total }, accounts, categories] = await Promise.all([
    getTransactions(user.id, {
      search,
      category,
      accountIds: accountId ? [accountId] : undefined,
      from,
      to,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getAccounts(user.id),
    getUsedCategories(user.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Net of what is currently filtered, which is the number the filters are
  // usually being manipulated to find.
  const net = rows.reduce((sum, tx) => money.add(sum, tx.amount), "0");

  return (
    <>
      <PageHeader
        title="Transactions"
        description={
          total > 0
            ? `${total.toLocaleString()} transaction${total === 1 ? "" : "s"} · net ${money.display(net, { signed: true })} on this page`
            : undefined
        }
        action={<SyncButton />}
      />

      <TransactionFiltersBar accounts={accounts} categories={categories} />

      <Card className="mt-4">
        {rows.length > 0 ? (
          <TransactionList transactions={rows} />
        ) : (
          <EmptyState
            icon={<Receipt className="size-8" />}
            title={total === 0 && !search && !category ? "No transactions yet" : "Nothing matches those filters"}
            description={
              total === 0 && !search && !category
                ? "Link a bank account and sync to pull in your history."
                : "Try widening the date range or clearing a filter."
            }
          />
        )}
      </Card>

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
          <PageLink
            params={params}
            page={page - 1}
            disabled={page <= 1}
            label="← Previous"
          />
          <span className="text-[0.8125rem] text-[var(--ink-secondary)]">
            Page {page} of {totalPages}
          </span>
          <PageLink
            params={params}
            page={page + 1}
            disabled={page >= totalPages}
            label="Next →"
          />
        </nav>
      ) : null}
    </>
  );
}

function PageLink({
  params,
  page,
  disabled,
  label,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="rounded-lg border px-3 py-1.5 text-[0.8125rem] opacity-40"
      >
        {label}
      </span>
    );
  }

  // Carry every active filter into the paged URL, otherwise turning the page
  // silently drops the filters the reader just set.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = single(value);
    if (v && key !== "page") query.set(key, v);
  }
  query.set("page", String(page));

  return (
    <Link
      href={`/transactions?${query.toString()}`}
      className="rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors hover:bg-[var(--surface)]"
    >
      {label}
    </Link>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
