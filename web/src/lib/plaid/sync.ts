import { and, eq, inArray, sql } from "drizzle-orm";
import type { AccountBase, RemovedTransaction, Transaction as PlaidTransaction } from "plaid";
import { db } from "@/db";
import {
  accounts,
  holdings,
  liabilityDetails,
  plaidItems,
  transactions,
  type NewTransaction,
} from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { plaid } from "./client";
import { plaidErrorCode } from "./errors";

/**
 * Plaid reports `amount` as positive when money leaves the account and negative
 * when it arrives — the opposite of how anyone reading a dashboard expects a
 * number to read. It is inverted here, once, at the boundary. Every other layer
 * can then treat positive as income and negative as spending.
 */
function normalizeAmount(plaidAmount: number): string {
  return (-plaidAmount).toFixed(4);
}

/** Credit cards, mortgages and loans reduce net worth rather than adding to it. */
function isLiabilityType(type: string): boolean {
  return type === "credit" || type === "loan";
}

/**
 * Plaid reports a credit card's `current` balance as a positive number meaning
 * "amount owed". Stored as-is with isLiability set, so net worth is
 * SUM(assets) − SUM(liabilities) rather than a sign convention hidden in queries.
 */
function balanceOf(account: AccountBase): string {
  return (account.balances.current ?? 0).toFixed(4);
}

export type SyncResult = {
  accountsUpdated: number;
  added: number;
  modified: number;
  removed: number;
  holdings: number;
  liabilities: number;
  error?: string;
};

/**
 * Plaid error codes that mean "this Item legitimately has nothing here" rather
 * than "something broke" — a checking-only bank has no holdings, and an account
 * with no debt has no liabilities. These must not mark the Item as errored.
 */
const ABSENT_PRODUCT_CODES = new Set([
  "PRODUCTS_NOT_SUPPORTED",
  "PRODUCT_NOT_READY",
  "NO_INVESTMENT_ACCOUNTS",
  "NO_LIABILITY_ACCOUNTS",
  "NO_ACCOUNTS",
  "INVALID_PRODUCT",
]);

/**
 * Pull balances and transactions for one linked institution.
 *
 * Safe to call repeatedly: accounts upsert on Plaid's account id, transactions
 * upsert on Plaid's transaction id, and the cursor only advances after the page
 * it describes has been written.
 */
export async function syncItem(itemId: string): Promise<SyncResult> {
  const item = await db.query.plaidItems.findFirst({ where: eq(plaidItems.id, itemId) });
  if (!item) throw new Error(`Plaid item not found: ${itemId}`);

  try {
    // Inside the try: a token that fails to decrypt (rotated ENCRYPTION_KEY,
    // corrupted row) must degrade to one broken Item, not throw out of syncItem
    // and take down every other institution's sync with it.
    const accessToken = decrypt(item.accessTokenEncrypted);

    const accountsUpdated = await syncAccounts(item.id, item.userId, accessToken);
    const txResult = await syncTransactions(item.id, item.userId, accessToken, item.transactionCursor);

    // Investments and liabilities are optional per institution. A bank with
    // neither is normal, so these run independently and never fail the sync.
    const [holdingCount, liabilityCount] = await Promise.all([
      syncHoldings(item.id, item.userId, accessToken).catch(absentProduct),
      syncLiabilities(item.id, item.userId, accessToken).catch(absentProduct),
    ]);

    await db
      .update(plaidItems)
      .set({ lastSyncedAt: new Date(), errorCode: null })
      .where(eq(plaidItems.id, item.id));

    return {
      accountsUpdated,
      ...txResult,
      holdings: holdingCount,
      liabilities: liabilityCount,
    };
  } catch (error: unknown) {
    const code = plaidErrorCode(error);

    // A broken login is expected operationally, not exceptional. Record it so the
    // UI can prompt a reconnect instead of the sync silently doing nothing forever.
    await db.update(plaidItems).set({ errorCode: code }).where(eq(plaidItems.id, item.id));

    return {
      accountsUpdated: 0,
      added: 0,
      modified: 0,
      removed: 0,
      holdings: 0,
      liabilities: 0,
      error: code,
    };
  }
}

/**
 * Swallow "this Item has no such product"; re-throw anything genuinely wrong.
 *
 * Returning 0 for every error would mark the Item as freshly synced with
 * errorCode cleared, so a real outage on the holdings endpoint would read as
 * "Synced just now" over stale positions.
 */
function absentProduct(error: unknown): number {
  const code = plaidErrorCode(error);
  if (ABSENT_PRODUCT_CODES.has(code)) return 0;
  throw error;
}


async function syncAccounts(itemId: string, userId: string, accessToken: string): Promise<number> {
  const { data } = await plaid.accountsGet({ access_token: accessToken });

  for (const account of data.accounts) {
    const liability = isLiabilityType(account.type);

    await db
      .insert(accounts)
      .values({
        userId,
        plaidItemId: itemId,
        plaidAccountId: account.account_id,
        name: account.name,
        officialName: account.official_name ?? null,
        type: account.type,
        subtype: account.subtype ?? null,
        mask: account.mask ?? null,
        currentBalance: balanceOf(account),
        availableBalance: account.balances.available?.toFixed(4) ?? null,
        creditLimit: account.balances.limit?.toFixed(4) ?? null,
        isoCurrencyCode: account.balances.iso_currency_code ?? "USD",
        isLiability: liability,
      })
      .onConflictDoUpdate({
        target: accounts.plaidAccountId,
        set: {
          // Only bank-authoritative fields refresh. `isHidden` is a user
          // preference and must survive every sync.
          name: account.name,
          officialName: account.official_name ?? null,
          currentBalance: balanceOf(account),
          availableBalance: account.balances.available?.toFixed(4) ?? null,
          creditLimit: account.balances.limit?.toFixed(4) ?? null,
          isLiability: liability,
          updatedAt: new Date(),
        },
      });
  }

  return data.accounts.length;
}

async function syncTransactions(
  itemId: string,
  userId: string,
  accessToken: string,
  startCursor: string | null,
): Promise<{ added: number; modified: number; removed: number }> {
  // Map Plaid's account ids onto our own primary keys once, rather than
  // querying per transaction.
  const accountIdByPlaidId = await mapAccountIds(itemId);

  let cursor = startCursor ?? undefined;
  let hasMore = true;
  const counts = { added: 0, modified: 0, removed: 0 };

  while (hasMore) {
    const { data } = await plaid.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });

    await persistTransactions(userId, accountIdByPlaidId, data.added, data.modified, data.removed);

    counts.added += data.added.length;
    counts.modified += data.modified.length;
    counts.removed += data.removed.length;

    cursor = data.next_cursor;
    hasMore = data.has_more;

    // Persist the cursor after each page. If the process dies mid-sync, the next
    // run resumes from here instead of replaying the entire history.
    await db.update(plaidItems).set({ transactionCursor: cursor }).where(eq(plaidItems.id, itemId));
  }

  return counts;
}

async function persistTransactions(
  userId: string,
  accountIdByPlaidId: Map<string, string>,
  added: PlaidTransaction[],
  modified: PlaidTransaction[],
  removed: RemovedTransaction[],
): Promise<void> {
  const toRow = (tx: PlaidTransaction): NewTransaction | null => {
    const accountId = accountIdByPlaidId.get(tx.account_id);
    // An unmapped account means accounts and transactions drifted out of step.
    // Skipping is correct: the next sync picks it up once the account exists.
    if (!accountId) return null;

    return {
      userId,
      accountId,
      plaidTransactionId: tx.transaction_id,
      amount: normalizeAmount(tx.amount),
      isoCurrencyCode: tx.iso_currency_code ?? "USD",
      date: tx.date,
      authorizedDate: tx.authorized_date ?? null,
      name: tx.name,
      merchantName: tx.merchant_name ?? null,
      category: tx.personal_finance_category?.primary ?? null,
      categoryDetailed: tx.personal_finance_category?.detailed ?? null,
      pending: tx.pending,
    };
  };

  const rows = [...added, ...modified].map(toRow).filter((r): r is NewTransaction => r !== null);

  // Chunked to stay well clear of Postgres' 65535 bind-parameter ceiling.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);

    await db
      .insert(transactions)
      .values(chunk)
      .onConflictDoUpdate({
        target: transactions.plaidTransactionId,
        set: {
          amount: sqlExcluded("amount"),
          date: sqlExcluded("date"),
          authorizedDate: sqlExcluded("authorized_date"),
          name: sqlExcluded("name"),
          merchantName: sqlExcluded("merchant_name"),
          category: sqlExcluded("category"),
          categoryDetailed: sqlExcluded("category_detailed"),
          pending: sqlExcluded("pending"),
          updatedAt: new Date(),
          // userCategory and notes are intentionally absent: a re-sync must never
          // overwrite a recategorization or a note the user wrote.
        },
      });
  }

  if (removed.length > 0) {
    const ids = removed.map((r) => r.transaction_id);
    for (let i = 0; i < ids.length; i += 500) {
      await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            inArray(transactions.plaidTransactionId, ids.slice(i, i + 500)),
          ),
        );
    }
  }
}

/** Reference the pending-insert row inside an ON CONFLICT DO UPDATE clause. */
function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}

// ─── Investments ─────────────────────────────────────────────────────────────

/**
 * Refresh holdings for every investment account on this Item.
 *
 * Plaid reports current positions rather than a delta, so anything absent from
 * the response has been sold and is deleted. Doing that per account rather than
 * per Item means an institution reporting only some accounts cannot wipe the
 * rest.
 */
async function syncHoldings(itemId: string, userId: string, accessToken: string): Promise<number> {
  const { data } = await plaid.investmentsHoldingsGet({ access_token: accessToken });

  const accountIdByPlaidId = await mapAccountIds(itemId);
  const securities = new Map(data.securities.map((s) => [s.security_id, s]));

  // Seed every account on this Item with an empty list. Populating only from the
  // response would mean an account that has been fully liquidated — and so
  // reports no holdings at all — never appears in the delete pass, leaving its
  // sold positions on screen forever.
  const seenByAccount = new Map<string, string[]>(
    [...accountIdByPlaidId.values()].map((id) => [id, []]),
  );
  let written = 0;

  for (const holding of data.holdings) {
    const accountId = accountIdByPlaidId.get(holding.account_id);
    if (!accountId) continue;

    const security = securities.get(holding.security_id);

    await db
      .insert(holdings)
      .values({
        userId,
        accountId,
        plaidSecurityId: holding.security_id,
        tickerSymbol: security?.ticker_symbol ?? null,
        name: security?.name ?? null,
        securityType: security?.type ?? null,
        quantity: holding.quantity.toFixed(8),
        costBasis: holding.cost_basis?.toFixed(4) ?? null,
        price: holding.institution_price.toFixed(4),
        value: holding.institution_value.toFixed(4),
        isoCurrencyCode: holding.iso_currency_code ?? "USD",
      })
      .onConflictDoUpdate({
        target: [holdings.accountId, holdings.plaidSecurityId],
        set: {
          quantity: holding.quantity.toFixed(8),
          costBasis: holding.cost_basis?.toFixed(4) ?? null,
          price: holding.institution_price.toFixed(4),
          value: holding.institution_value.toFixed(4),
          tickerSymbol: security?.ticker_symbol ?? null,
          name: security?.name ?? null,
          securityType: security?.type ?? null,
          updatedAt: new Date(),
        },
      });

    written += 1;
    seenByAccount.set(accountId, [...(seenByAccount.get(accountId) ?? []), holding.security_id]);
  }

  for (const [accountId, securityIds] of seenByAccount) {
    // An account that reported nothing has been fully liquidated: drop all of
    // its holdings. Handled explicitly rather than relying on how an empty array
    // binds into `<> ALL(...)`.
    if (securityIds.length === 0) {
      await db.delete(holdings).where(eq(holdings.accountId, accountId));
      continue;
    }

    await db
      .delete(holdings)
      .where(
        and(
          eq(holdings.accountId, accountId),
          sql`${holdings.plaidSecurityId} <> ALL(${securityIds})`,
        ),
      );
  }

  return written;
}

// ─── Liabilities ─────────────────────────────────────────────────────────────

type LiabilityRow = {
  accountId: string;
  liabilityType: string;
  apr: string | null;
  aprType: string | null;
  minimumPayment: string | null;
  lastPaymentAmount: string | null;
  lastPaymentDate: string | null;
  nextPaymentDueDate: string | null;
  originationDate: string | null;
  originationPrincipal: string | null;
  isOverdue: boolean | null;
  ytdInterestPaid: string | null;
  ytdPrincipalPaid: string | null;
};

/**
 * Flatten Plaid's three differently-shaped liability arrays into one table.
 *
 * Credit cards carry an array of APRs (purchase, cash advance, balance transfer);
 * the purchase APR is the one people mean, so it is preferred, falling back to
 * the first reported.
 */
async function syncLiabilities(
  itemId: string,
  userId: string,
  accessToken: string,
): Promise<number> {
  const { data } = await plaid.liabilitiesGet({ access_token: accessToken });

  const accountIdByPlaidId = await mapAccountIds(itemId);
  const rows: LiabilityRow[] = [];

  for (const credit of data.liabilities.credit ?? []) {
    const accountId = credit.account_id ? accountIdByPlaidId.get(credit.account_id) : undefined;
    if (!accountId) continue;

    const purchaseApr =
      credit.aprs?.find((a) => a.apr_type === "purchase_apr") ?? credit.aprs?.[0];

    rows.push({
      accountId,
      liabilityType: "credit",
      apr: purchaseApr?.apr_percentage?.toFixed(4) ?? null,
      aprType: purchaseApr?.apr_type ?? null,
      minimumPayment: credit.minimum_payment_amount?.toFixed(4) ?? null,
      lastPaymentAmount: credit.last_payment_amount?.toFixed(4) ?? null,
      lastPaymentDate: credit.last_payment_date ?? null,
      nextPaymentDueDate: credit.next_payment_due_date ?? null,
      originationDate: null,
      originationPrincipal: null,
      isOverdue: credit.is_overdue ?? null,
      // Plaid reports year-to-date interest for loans, not for credit cards.
      ytdInterestPaid: null,
      ytdPrincipalPaid: null,
    });
  }

  for (const student of data.liabilities.student ?? []) {
    const accountId = student.account_id ? accountIdByPlaidId.get(student.account_id) : undefined;
    if (!accountId) continue;

    rows.push({
      accountId,
      liabilityType: "student",
      apr: student.interest_rate_percentage?.toFixed(4) ?? null,
      aprType: "fixed",
      minimumPayment: student.minimum_payment_amount?.toFixed(4) ?? null,
      lastPaymentAmount: student.last_payment_amount?.toFixed(4) ?? null,
      lastPaymentDate: student.last_payment_date ?? null,
      nextPaymentDueDate: student.next_payment_due_date ?? null,
      originationDate: student.origination_date ?? null,
      originationPrincipal: student.origination_principal_amount?.toFixed(4) ?? null,
      isOverdue: student.is_overdue ?? null,
      ytdInterestPaid: student.ytd_interest_paid?.toFixed(4) ?? null,
      ytdPrincipalPaid: student.ytd_principal_paid?.toFixed(4) ?? null,
    });
  }

  for (const mortgage of data.liabilities.mortgage ?? []) {
    const accountId = mortgage.account_id ? accountIdByPlaidId.get(mortgage.account_id) : undefined;
    if (!accountId) continue;

    rows.push({
      accountId,
      liabilityType: "mortgage",
      apr: mortgage.interest_rate?.percentage?.toFixed(4) ?? null,
      aprType: mortgage.interest_rate?.type ?? null,
      minimumPayment: mortgage.next_monthly_payment?.toFixed(4) ?? null,
      lastPaymentAmount: mortgage.last_payment_amount?.toFixed(4) ?? null,
      lastPaymentDate: mortgage.last_payment_date ?? null,
      nextPaymentDueDate: mortgage.next_payment_due_date ?? null,
      originationDate: mortgage.origination_date ?? null,
      originationPrincipal: mortgage.origination_principal_amount?.toFixed(4) ?? null,
      isOverdue: null,
      ytdInterestPaid: mortgage.ytd_interest_paid?.toFixed(4) ?? null,
      ytdPrincipalPaid: mortgage.ytd_principal_paid?.toFixed(4) ?? null,
    });
  }

  for (const row of rows) {
    const { accountId, ...rest } = row;

    await db
      .insert(liabilityDetails)
      .values({ userId, accountId, ...rest })
      .onConflictDoUpdate({
        target: liabilityDetails.accountId,
        set: { ...rest, updatedAt: new Date() },
      });
  }

  return rows.length;
}

/** Plaid account id → our account uuid, for the accounts on one Item. */
async function mapAccountIds(itemId: string): Promise<Map<string, string>> {
  const linked = await db
    .select({ id: accounts.id, plaidAccountId: accounts.plaidAccountId })
    .from(accounts)
    .where(eq(accounts.plaidItemId, itemId));

  return new Map(linked.filter((a) => a.plaidAccountId).map((a) => [a.plaidAccountId!, a.id]));
}

/**
 * Sync every Item belonging to a user, in parallel.
 *
 * allSettled, not all: one institution failing outright must not abort the
 * others, or a single broken connection would block the whole refresh and the
 * daily net-worth snapshot along with it.
 */
export async function syncAllForUser(userId: string): Promise<SyncResult[]> {
  const items = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.userId, userId));

  const settled = await Promise.allSettled(items.map((item) => syncItem(item.id)));

  return settled.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : {
          accountsUpdated: 0,
          added: 0,
          modified: 0,
          removed: 0,
          holdings: 0,
          liabilities: 0,
          error: plaidErrorCode(result.reason),
        },
  );
}
