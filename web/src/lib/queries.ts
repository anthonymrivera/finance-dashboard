import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  balanceSnapshots,
  holdings,
  liabilityDetails,
  plaidItems,
  transactions,
} from "@/db/schema";
import * as money from "@/lib/money";

/**
 * Aggregations run in Postgres rather than by pulling rows into Node and looping.
 * The original app had no cross-account query at all — /api/transactions required
 * an accountId — so a combined view meant N round trips and summing in the client.
 */

export type NetWorth = {
  assets: string;
  liabilities: string;
  netWorth: string;
};

export async function getNetWorth(userId: string): Promise<NetWorth> {
  const [row] = await db
    .select({
      assets: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.isLiability} = false THEN ${accounts.currentBalance} ELSE 0 END), 0)::text`,
      liabilities: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.isLiability} = true THEN ${accounts.currentBalance} ELSE 0 END), 0)::text`,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isHidden, false)));

  const assets = row?.assets ?? "0";
  const liabilities = row?.liabilities ?? "0";

  return { assets, liabilities, netWorth: money.subtract(assets, liabilities) };
}

export type AccountWithInstitution = {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: string;
  availableBalance: string | null;
  creditLimit: string | null;
  isoCurrencyCode: string;
  isLiability: boolean;
  isHidden: boolean;
  isManual: boolean;
  /** The owning Plaid Item, needed to open Link in update mode. Null when manual. */
  itemId: string | null;
  institutionName: string | null;
  itemErrorCode: string | null;
  lastSyncedAt: Date | null;
};

export async function getAccounts(userId: string): Promise<AccountWithInstitution[]> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      officialName: accounts.officialName,
      type: accounts.type,
      subtype: accounts.subtype,
      mask: accounts.mask,
      currentBalance: accounts.currentBalance,
      availableBalance: accounts.availableBalance,
      creditLimit: accounts.creditLimit,
      isoCurrencyCode: accounts.isoCurrencyCode,
      isLiability: accounts.isLiability,
      isHidden: accounts.isHidden,
      plaidItemId: accounts.plaidItemId,
      institutionName: plaidItems.institutionName,
      itemErrorCode: plaidItems.errorCode,
      lastSyncedAt: plaidItems.lastSyncedAt,
    })
    .from(accounts)
    .leftJoin(plaidItems, eq(accounts.plaidItemId, plaidItems.id))
    .where(eq(accounts.userId, userId))
    .orderBy(accounts.isLiability, desc(accounts.currentBalance));

  return rows.map(({ plaidItemId, ...rest }) => ({
    ...rest,
    itemId: plaidItemId,
    isManual: plaidItemId === null,
  }));
}

export type TransactionRow = {
  id: string;
  amount: string;
  date: string;
  name: string;
  merchantName: string | null;
  category: string | null;
  userCategory: string | null;
  pending: boolean;
  notes: string | null;
  accountId: string;
  accountName: string;
  accountMask: string | null;
  institutionName: string | null;
};

export type TransactionFilters = {
  accountIds?: string[];
  from?: string;
  to?: string;
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
};

export async function getTransactions(
  userId: string,
  filters: TransactionFilters = {},
): Promise<{ rows: TransactionRow[]; total: number }> {
  const { accountIds, from, to, search, category, limit = 50, offset = 0 } = filters;

  const conditions = [eq(transactions.userId, userId)];

  if (accountIds?.length) conditions.push(inArray(transactions.accountId, accountIds));
  if (from) conditions.push(gte(transactions.date, from));
  if (to) conditions.push(lte(transactions.date, to));
  if (category) {
    conditions.push(sql`COALESCE(${transactions.userCategory}, ${transactions.category}) = ${category}`);
  }
  if (search) {
    // ILIKE is adequate at personal-finance scale. If this ever gets slow,
    // a pg_trgm GIN index on name is the next step, not a search service.
    conditions.push(
      sql`(${transactions.name} ILIKE ${`%${search}%`} OR ${transactions.merchantName} ILIKE ${`%${search}%`})`,
    );
  }

  const where = and(...conditions);

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        date: transactions.date,
        name: transactions.name,
        merchantName: transactions.merchantName,
        category: transactions.category,
        userCategory: transactions.userCategory,
        pending: transactions.pending,
        notes: transactions.notes,
        accountId: transactions.accountId,
        accountName: accounts.name,
        accountMask: accounts.mask,
        institutionName: plaidItems.institutionName,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(plaidItems, eq(accounts.plaidItemId, plaidItems.id))
      .where(where)
      // `id` breaks ties. Rows inserted by one statement share an identical
      // createdAt (Postgres now() is per-transaction), so without a unique final
      // key the sort is not a total order and LIMIT/OFFSET paging can repeat a
      // row on one page while dropping another entirely.
      .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(transactions)
      .where(where),
  ]);

  return { rows, total: countRow?.count ?? 0 };
}

export type CategorySpend = {
  category: string;
  total: string;
  count: number;
};

/**
 * Money moving between accounts you own is not income and not spending.
 *
 * Without this, paying a linked credit card from a linked checking account is
 * counted twice: the checking leg as spending, and the card leg as income. The
 * same happens on every checking→savings transfer. Anyone with more than one
 * linked account — the entire point of this app — would see inflated totals on
 * both sides.
 *
 * LOAN_PAYMENTS is included because a card or loan payment is debt service, not
 * consumption; the original purchases were already counted as spending when they
 * were made. The trade-off: payments toward a loan that is *not* linked here are
 * also excluded, so spending is understated for unlinked debt. That is the same
 * call the mainstream finance apps make.
 */
const TRANSFER_CATEGORIES = ["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS"] as const;

/** Effective category — the user's override wins over Plaid's. */
const effectiveCategory = sql`COALESCE(${transactions.userCategory}, ${transactions.category})`;

const notATransfer = sql`(${effectiveCategory} IS NULL OR ${effectiveCategory} <> ALL(ARRAY[${sql.join(
  TRANSFER_CATEGORIES.map((c) => sql`${c}`),
  sql`, `,
)}]::text[]))`;

/**
 * Exclude transactions belonging to a hidden account.
 *
 * Hiding an account removes it from net worth, so leaving its transactions in
 * the spending and cash-flow totals would make two figures on the same screen
 * disagree about the same account.
 */
const accountNotHidden = sql`EXISTS (
  SELECT 1 FROM ${accounts}
  WHERE ${accounts.id} = ${transactions.accountId} AND ${accounts.isHidden} = false
)`;

/**
 * Spending only — inflows are excluded, otherwise a paycheck swamps every
 * category. Returned as positive magnitudes because "spent $420 on groceries"
 * is the natural reading.
 */
export async function getSpendingByCategory(
  userId: string,
  from: string,
  to: string,
): Promise<CategorySpend[]> {
  const rows = await db
    .select({
      category: sql<string>`COALESCE(${transactions.userCategory}, ${transactions.category}, 'UNCATEGORIZED')`,
      total: sql<string>`ABS(SUM(${transactions.amount}))::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, from),
        lte(transactions.date, to),
        sql`${transactions.amount} < 0`,
        eq(transactions.pending, false),
        notATransfer,
        accountNotHidden,
      ),
    )
    .groupBy(sql`COALESCE(${transactions.userCategory}, ${transactions.category}, 'UNCATEGORIZED')`)
    .orderBy(sql`ABS(SUM(${transactions.amount})) DESC`);

  return rows;
}

export type MonthlyFlow = {
  month: string;
  income: string;
  expenses: string;
  net: string;
};

export async function getCashFlow(userId: string, months = 6): Promise<MonthlyFlow[]> {
  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${transactions.date}), 'YYYY-MM')`,
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END), 0)::text`,
      expenses: sql<string>`COALESCE(ABS(SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        // Anchor to the start of the month, not "N months before today".
        // Subtracting a raw interval lands mid-month, so the oldest bucket held
        // only a few days and the chart rendered N+1 bars — the first a stub.
        gte(
          transactions.date,
          sql`(DATE_TRUNC('month', CURRENT_DATE) - ((${months} - 1) || ' months')::interval)`,
        ),
        eq(transactions.pending, false),
        notATransfer,
        accountNotHidden,
      ),
    )
    .groupBy(sql`DATE_TRUNC('month', ${transactions.date})`)
    .orderBy(sql`DATE_TRUNC('month', ${transactions.date})`);

  const byMonth = new Map(rows.map((r) => [r.month, r]));

  // Zero-fill missing months. A month with no transactions must still occupy a
  // slot, or callers indexing by position compare the wrong periods.
  const filled: MonthlyFlow[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const row = byMonth.get(key);

    const income = row?.income ?? "0";
    const expenses = row?.expenses ?? "0";
    filled.push({ month: key, income, expenses, net: money.subtract(income, expenses) });
  }

  return filled;
}

export type TopMerchant = { merchant: string; total: string; count: number };

export async function getTopMerchants(
  userId: string,
  from: string,
  to: string,
  limit = 5,
): Promise<TopMerchant[]> {
  return db
    .select({
      merchant: sql<string>`COALESCE(${transactions.merchantName}, ${transactions.name})`,
      total: sql<string>`ABS(SUM(${transactions.amount}))::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, from),
        lte(transactions.date, to),
        sql`${transactions.amount} < 0`,
        notATransfer,
        accountNotHidden,
      ),
    )
    .groupBy(sql`COALESCE(${transactions.merchantName}, ${transactions.name})`)
    .orderBy(sql`ABS(SUM(${transactions.amount})) DESC`)
    .limit(limit);
}

export type NetWorthPoint = { date: string; netWorth: string };

/**
 * Net worth history from daily snapshots.
 *
 * Plaid has no historical-balance API — it only reports balances as of now — so
 * this chart is only as deep as the snapshot job has been running. A brand-new
 * account legitimately has nothing to show here.
 */
export async function getNetWorthHistory(userId: string, days = 90): Promise<NetWorthPoint[]> {
  return db
    .select({ date: balanceSnapshots.date, netWorth: balanceSnapshots.netWorth })
    .from(balanceSnapshots)
    .where(
      and(
        eq(balanceSnapshots.userId, userId),
        gte(balanceSnapshots.date, sql`(CURRENT_DATE - (${days} || ' days')::interval)`),
      ),
    )
    .orderBy(balanceSnapshots.date);
}

/**
 * Record today's net worth. Idempotent — re-running on the same day overwrites
 * rather than duplicating, so the job is safe to trigger more than once.
 */
export async function recordSnapshot(userId: string): Promise<void> {
  const { assets, liabilities, netWorth } = await getNetWorth(userId);

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isHidden, false)));

  await db
    .insert(balanceSnapshots)
    .values({
      userId,
      date: sql`CURRENT_DATE` as unknown as string,
      assets,
      liabilities,
      netWorth,
      accountCount: countRow?.count ?? 0,
    })
    .onConflictDoUpdate({
      target: [balanceSnapshots.userId, balanceSnapshots.date],
      set: { assets, liabilities, netWorth, accountCount: countRow?.count ?? 0 },
    });
}

export type HoldingRow = {
  id: string;
  accountId: string;
  tickerSymbol: string | null;
  name: string | null;
  securityType: string | null;
  quantity: string;
  costBasis: string | null;
  price: string | null;
  value: string;
  /** Unrealized gain or loss. Null when the institution reports no cost basis. */
  gain: string | null;
};

export async function getHoldings(userId: string): Promise<HoldingRow[]> {
  const rows = await db
    .select({
      id: holdings.id,
      accountId: holdings.accountId,
      tickerSymbol: holdings.tickerSymbol,
      name: holdings.name,
      securityType: holdings.securityType,
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      price: holdings.price,
      value: holdings.value,
    })
    .from(holdings)
    .where(eq(holdings.userId, userId))
    .orderBy(desc(holdings.value));

  return rows.map((row) => ({
    ...row,
    gain: row.costBasis ? money.subtract(row.value, row.costBasis) : null,
  }));
}

export type LiabilityRow = {
  accountId: string;
  liabilityType: string;
  apr: string | null;
  minimumPayment: string | null;
  nextPaymentDueDate: string | null;
  lastPaymentAmount: string | null;
  isOverdue: boolean | null;
  originationPrincipal: string | null;
};

export async function getLiabilityDetails(userId: string): Promise<LiabilityRow[]> {
  return db
    .select({
      accountId: liabilityDetails.accountId,
      liabilityType: liabilityDetails.liabilityType,
      apr: liabilityDetails.apr,
      minimumPayment: liabilityDetails.minimumPayment,
      nextPaymentDueDate: liabilityDetails.nextPaymentDueDate,
      lastPaymentAmount: liabilityDetails.lastPaymentAmount,
      isOverdue: liabilityDetails.isOverdue,
      originationPrincipal: liabilityDetails.originationPrincipal,
    })
    .from(liabilityDetails)
    .where(eq(liabilityDetails.userId, userId));
}

export async function getLinkedItems(userId: string) {
  return db
    .select({
      id: plaidItems.id,
      institutionName: plaidItems.institutionName,
      institutionId: plaidItems.institutionId,
      errorCode: plaidItems.errorCode,
      lastSyncedAt: plaidItems.lastSyncedAt,
      createdAt: plaidItems.createdAt,
      accountCount: sql<number>`(SELECT COUNT(*)::int FROM ${accounts} WHERE ${accounts.plaidItemId} = ${plaidItems.id})`,
    })
    .from(plaidItems)
    .where(eq(plaidItems.userId, userId))
    .orderBy(plaidItems.createdAt);
}

/** Distinct categories present in this user's data, for filter dropdowns. */
export async function getUsedCategories(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({
      category: sql<string>`COALESCE(${transactions.userCategory}, ${transactions.category})`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`COALESCE(${transactions.userCategory}, ${transactions.category}) IS NOT NULL`))
    .orderBy(sql`COALESCE(${transactions.userCategory}, ${transactions.category})`);

  return rows.map((r) => r.category).filter(Boolean);
}
