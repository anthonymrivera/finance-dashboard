import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Money is stored as numeric(19,4) and surfaces in TypeScript as a string.
 * This is deliberate: JS numbers are IEEE-754 doubles and silently lose cents
 * at scale. All arithmetic goes through lib/money.ts, never the `+` operator.
 *
 * SIGN CONVENTION: positive = money into the account, negative = money out.
 * Plaid uses the opposite convention for `amount`, so it is inverted exactly
 * once, at the sync boundary in lib/plaid.ts. Everything downstream of that
 * can reason about signs the way a human would.
 */
const money = (name: string) => numeric(name, { precision: 19, scale: 4 });

// ─── Users & sessions ────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),

    /**
     * Null for accounts that only ever sign in with Google. Storing a dummy hash
     * instead would make "does this account have a password" unanswerable.
     */
    passwordHash: text("password_hash"),

    /** Google's stable subject claim. Never the email — people change those. */
    googleId: text("google_id"),

    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),

    /**
     * TOTP shared secret, encrypted with the same AES-256-GCM envelope as Plaid
     * tokens. Plaintext here would let a database reader mint valid codes.
     */
    totpSecretEncrypted: text("totp_secret_encrypted"),
    /** Set only once a first code has been verified, so a half-finished enrolment never locks anyone out. */
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),

    /**
     * Enrolment in progress. Kept apart from the live secret so starting a new
     * setup cannot overwrite — or silently disable — a factor that is already
     * protecting the account.
     */
    totpSecretPendingEncrypted: text("totp_secret_pending_encrypted"),

    /**
     * Highest TOTP time step already accepted. Codes at or below it are refused,
     * making each code single-use rather than valid for its whole window.
     */
    totpLastUsedCounter: integer("totp_last_used_counter"),

    /**
     * Persisted failure counter for the 2FA step. The in-memory limiter resets
     * on every cold start and is not shared between serverless instances, so the
     * attempt cap has to live in the database to mean anything.
     */
    totpFailedAttempts: integer("totp_failed_attempts").notNull().default(0),
    totpLockedUntil: timestamp("totp_locked_until", { withTimezone: true }),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    uniqueIndex("users_google_id_key").on(t.googleId),
  ],
);

/**
 * Sign-up allowlist.
 *
 * The app is deployed publicly but registration is not open: an email must be
 * invited before it can register, by password or by Google. This is what keeps
 * a stranger who finds the URL from linking bank accounts on someone else's
 * Plaid bill.
 */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("invites_email_key").on(t.email)],
);

/**
 * Server-side sessions rather than stateless JWTs. The original app put a JWT in
 * localStorage, which is readable by any XSS and impossible to revoke before it
 * expires. A session row behind an httpOnly cookie can be killed instantly —
 * which matters a great deal more once this is on the public internet holding
 * real bank data.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // 256 bits of entropy, hashed before storage
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

// ─── Plaid linkage ───────────────────────────────────────────────────────────

/**
 * One row per linked institution (a Plaid "Item"). An Item can expose several
 * accounts — a checking and a savings at the same bank share one Item and one
 * access token.
 */
export const plaidItems = pgTable(
  "plaid_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    plaidItemId: text("plaid_item_id").notNull(),
    /** AES-256-GCM envelope from lib/crypto.ts. Never logged, never sent to the client. */
    accessTokenEncrypted: text("access_token_encrypted").notNull(),

    institutionId: text("institution_id"),
    institutionName: text("institution_name"),

    /**
     * Opaque Plaid pagination cursor for /transactions/sync. Null means this Item
     * has never completed an initial sync, which is a meaningfully different state
     * from "synced and found nothing".
     */
    transactionCursor: text("transaction_cursor"),

    /**
     * Set when Plaid reports the login is broken (ITEM_LOGIN_REQUIRED and friends).
     * Drives the "reconnect this bank" prompt in the UI.
     */
    errorCode: text("error_code"),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("plaid_items_plaid_item_id_key").on(t.plaidItemId),
    index("plaid_items_user_id_idx").on(t.userId),
  ],
);

// ─── Accounts ────────────────────────────────────────────────────────────────

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Null for manually-tracked accounts: cash, a car, property, an unlinkable 401k. */
    plaidItemId: uuid("plaid_item_id").references(() => plaidItems.id, { onDelete: "cascade" }),
    plaidAccountId: text("plaid_account_id"),

    name: text("name").notNull(),
    officialName: text("official_name"),
    /** Plaid taxonomy: depository | credit | loan | investment | other */
    type: text("type").notNull(),
    /** checking | savings | credit card | mortgage | 401k | ... */
    subtype: text("subtype"),
    /** Last 2-4 digits, for telling two checking accounts apart. */
    mask: text("mask"),

    currentBalance: money("current_balance").notNull().default("0"),
    /** Current minus pending holds. Plaid-only; null for manual accounts. */
    availableBalance: money("available_balance"),
    /** Credit cards and loans: what you owe against what you can borrow. */
    creditLimit: money("credit_limit"),

    isoCurrencyCode: text("iso_currency_code").notNull().default("USD"),

    /**
     * Liabilities (credit cards, mortgages, loans) count against net worth.
     * Derived from `type` at sync time and stored, so net-worth math is a plain
     * SUM rather than a CASE over Plaid's taxonomy scattered across queries.
     */
    isLiability: boolean("is_liability").notNull().default(false),

    /** Lets you keep a stale account visible in history without it skewing totals. */
    isHidden: boolean("is_hidden").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    index("accounts_plaid_item_id_idx").on(t.plaidItemId),
    // Plaid account ids are globally unique; this is what makes sync idempotent.
    uniqueIndex("accounts_plaid_account_id_key").on(t.plaidAccountId),
  ],
);

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * A real foreign key. The original schema stored account_id as a bare Long
     * with no constraint, so nothing stopped a transaction from outliving its
     * account or pointing at someone else's.
     */
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    /** Null for manually-entered transactions. */
    plaidTransactionId: text("plaid_transaction_id"),

    /** Positive = money in, negative = money out. See note at top of file. */
    amount: money("amount").notNull(),
    isoCurrencyCode: text("iso_currency_code").notNull().default("USD"),

    date: date("date").notNull(),
    /** When the transaction actually cleared, if Plaid knows. */
    authorizedDate: date("authorized_date"),

    name: text("name").notNull(),
    merchantName: text("merchant_name"),

    /** Plaid's Personal Finance Category, e.g. FOOD_AND_DRINK. */
    category: text("category"),
    categoryDetailed: text("category_detailed"),
    /**
     * Your override. Kept in a separate column so a re-sync can freely overwrite
     * Plaid's `category` without ever clobbering a recategorization you made.
     */
    userCategory: text("user_category"),

    /**
     * Pending transactions are replaced by a posted counterpart days later,
     * carrying a different id. Tracked so the UI can visually distinguish them.
     */
    pending: boolean("pending").notNull().default(false),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The dashboard's hot path: this user's transactions, newest first.
    index("transactions_user_id_date_idx").on(t.userId, t.date),
    index("transactions_account_id_idx").on(t.accountId),
    uniqueIndex("transactions_plaid_transaction_id_key").on(t.plaidTransactionId),
  ],
);

// ─── Investments ─────────────────────────────────────────────────────────────

/**
 * What an investment account actually holds, from Plaid's Investments product.
 *
 * Separate from `accounts` because one brokerage account has many positions, and
 * separate from `transactions` because a holding is a running position, not an
 * event. Refreshed wholesale on each sync — Plaid reports current holdings
 * rather than a delta.
 */
export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    plaidSecurityId: text("plaid_security_id").notNull(),
    tickerSymbol: text("ticker_symbol"),
    name: text("name"),
    /** equity | etf | mutual fund | fixed income | cash | derivative | other */
    securityType: text("security_type"),

    quantity: numeric("quantity", { precision: 24, scale: 8 }).notNull(),
    /** Total paid, not per-share. Null when the institution does not report it. */
    costBasis: money("cost_basis"),
    price: money("price"),
    value: money("value").notNull(),

    isoCurrencyCode: text("iso_currency_code").notNull().default("USD"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("holdings_user_id_idx").on(t.userId),
    index("holdings_account_id_idx").on(t.accountId),
    // One position per security per account — what makes the refresh idempotent.
    uniqueIndex("holdings_account_security_key").on(t.accountId, t.plaidSecurityId),
  ],
);

// ─── Liabilities ─────────────────────────────────────────────────────────────

/**
 * Loan detail from Plaid's Liabilities product: rates, due dates, payoff figures.
 *
 * Plaid returns three differently-shaped arrays (credit, student, mortgage). The
 * useful fields overlap heavily, so they are flattened into one table with a
 * discriminator rather than three near-identical ones — the alternative is three
 * joins to answer "what do I owe and when is it due".
 */
export const liabilityDetails = pgTable(
  "liability_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    /** credit | student | mortgage */
    liabilityType: text("liability_type").notNull(),

    /** Percentage, e.g. 21.99 for 21.99% APR. */
    apr: numeric("apr", { precision: 8, scale: 4 }),
    aprType: text("apr_type"),

    minimumPayment: money("minimum_payment"),
    lastPaymentAmount: money("last_payment_amount"),
    lastPaymentDate: date("last_payment_date"),
    nextPaymentDueDate: date("next_payment_due_date"),

    originationDate: date("origination_date"),
    originationPrincipal: money("origination_principal"),
    /** Credit cards only: whether the balance is being carried month to month. */
    isOverdue: boolean("is_overdue"),

    ytdInterestPaid: money("ytd_interest_paid"),
    ytdPrincipalPaid: money("ytd_principal_paid"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("liability_details_user_id_idx").on(t.userId),
    uniqueIndex("liability_details_account_key").on(t.accountId),
  ],
);

/**
 * Daily net-worth snapshots. Plaid only reports balances as of *now* — it has no
 * historical balance API — so a net-worth-over-time chart is impossible unless
 * something records the value each day. Written by a scheduled job.
 */
export const balanceSnapshots = pgTable(
  "balance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    assets: money("assets").notNull(),
    liabilities: money("liabilities").notNull(),
    netWorth: money("net_worth").notNull(),
    accountCount: integer("account_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("balance_snapshots_user_date_key").on(t.userId, t.date)],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  transactions: many(transactions),
  plaidItems: many(plaidItems),
  sessions: many(sessions),
  holdings: many(holdings),
}));

export const holdingsRelations = relations(holdings, ({ one }) => ({
  user: one(users, { fields: [holdings.userId], references: [users.id] }),
  account: one(accounts, { fields: [holdings.accountId], references: [accounts.id] }),
}));

export const liabilityDetailsRelations = relations(liabilityDetails, ({ one }) => ({
  user: one(users, { fields: [liabilityDetails.userId], references: [users.id] }),
  account: one(accounts, { fields: [liabilityDetails.accountId], references: [accounts.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const plaidItemsRelations = relations(plaidItems, ({ one, many }) => ({
  user: one(users, { fields: [plaidItems.userId], references: [users.id] }),
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  plaidItem: one(plaidItems, { fields: [accounts.plaidItemId], references: [plaidItems.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
}));

// ─── Inferred types ──────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type LiabilityDetail = typeof liabilityDetails.$inferSelect;
export type PlaidItem = typeof plaidItems.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type BalanceSnapshot = typeof balanceSnapshots.$inferSelect;
