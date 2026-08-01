import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getAccounts, getTransactions, getUsedCategories } from "@/lib/queries";
import * as money from "@/lib/money";
import { Movement, Empty } from "@/components/ledger";
import { Entries } from "@/components/entries";
import { SyncButton } from "@/components/sync-button";
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

  const unfiltered = total === 0 && !search && !category;

  return (
    <>
      <Movement label="Entries" first action={<SyncButton />}>
        {total > 0 ? (
          <p className="mb-8 text-[17px]" style={{ color: "var(--muted)" }}>
            {total.toLocaleString()} entr{total === 1 ? "y" : "ies"} · net{" "}
            <span className="tabular" style={{ color: "var(--ink)" }}>
              {money.display(net, { signed: true })}
            </span>{" "}
            on this page
          </p>
        ) : null}

        <TransactionFiltersBar accounts={accounts} categories={categories} />

        <div className="mt-9">
          {rows.length > 0 ? (
            <Entries rows={rows} />
          ) : (
            <Empty
              title={unfiltered ? "No entries yet" : "Nothing matches those filters"}
              hint={
                unfiltered
                  ? "Link a bank account and refresh to pull in your history."
                  : "Try widening the date range or clearing a filter."
              }
            />
          )}
        </div>

        {totalPages > 1 ? (
          <nav
            aria-label="Pagination"
            className="mt-10 flex items-center justify-between gap-4 border-t pt-6"
            style={{ borderColor: "var(--rule)" }}
          >
            <PageLink params={params} page={page - 1} disabled={page <= 1} label="← Previous" />
            <span className="label">
              Page {page} of {totalPages}
            </span>
            <PageLink params={params} page={page + 1} disabled={page >= totalPages} label="Next →" />
          </nav>
        ) : null}
      </Movement>
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
        className="font-[family-name:var(--font-sans)] text-[11.5px] opacity-40"
        style={{ color: "var(--muted)" }}
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
      className="wipe font-[family-name:var(--font-sans)] text-[11.5px]"
      style={{ color: "var(--ink)" }}
    >
      {label}
    </Link>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
