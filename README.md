# Finance Dashboard

Every account in one view — bank, credit card, loan, and brokerage — synced
automatically from the institutions themselves.

**Next.js 16 · Postgres (Neon) · Drizzle · Plaid · Tailwind 4**

The application lives in [`web/`](./web). Its [README](./web/README.md) covers
setup, deployment, and how the sync works.

---

## What it does

- **Net worth** across every linked account, with assets and liabilities
  separated, snapshotted daily so the trend builds over time
- **Transactions** from up to 24 months of history, filterable by account,
  category, and date range
- **Investment holdings** — positions, cost basis, and unrealized gain
- **Loan detail** — APR, minimum payment, next due date
- **Manual accounts** for anything Plaid cannot reach: cash, a vehicle, property

Read-only throughout. The Plaid products in use (Transactions, Investments,
Liabilities) cannot move money.

## Design notes

**Money is never a float.** Amounts are `numeric(19,4)` in Postgres and strings
in TypeScript, with arithmetic over scaled BigInts. `0.1 + 0.2` costing a cent is
a real bug in a finance app.

**Plaid's sign convention is inverted once, at the boundary.** Plaid reports
`amount` as positive when money leaves an account; everywhere downstream,
positive means money in.

**Sync is idempotent.** Cursor-based, with accounts and transactions upserting on
Plaid's own identifiers, so re-running never duplicates or loses data.

**Your edits survive syncs.** Recategorizing writes to a separate column from
Plaid's category, so a refresh overwrites what the bank owns and never what you
wrote.

**Transfers are not spending.** Paying a linked credit card from a linked
checking account would otherwise be counted twice — once as spending, once as
income.

## Security

Plaid access tokens and TOTP secrets are encrypted with AES-256-GCM before they
reach the database. Sessions are server-side rows behind httpOnly cookies, with
only a hash stored. Passwords, where set, use Argon2id. Webhooks are verified by
signature *and* body hash, and must originate from the same Plaid environment as
the item they target. An allowlist in deployment configuration governs which
addresses can hold a session at all, checked on every request.

Policies covering data retention and the wider security posture are in
[`web/docs/`](./web/docs).

## History

This began as a Spring Boot API with a separate Vite frontend. That version was
replaced by the single Next.js application in `web/`, which removed the CORS
layer, moved sessions off `localStorage` into httpOnly cookies, and gave Plaid a
public HTTPS endpoint for webhooks. The original code remains in the git history.
