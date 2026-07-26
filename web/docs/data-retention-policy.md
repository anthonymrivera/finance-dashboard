# Data Retention and Disposal Policy

- **Application:** AMR Finance — personal finance dashboard
- **Owner:** Anthony Rivera, sole developer and operator
- **Contact:** arivera1995@gmail.com
- **Effective:** 25 July 2026
- **Review cadence:** Annually, and on any change to what data the application stores

---

## 1. Scope

This policy covers all consumer financial data the application receives from the
Plaid API, together with the account and session records needed to operate it.

The application is a single-operator personal finance dashboard. It is not a
commercial service and has no customers. Access is restricted to a fixed list of
email addresses set in deployment configuration; no other person can create an
account or hold a session.

## 2. Data collected and why

| Data | Source | Purpose |
|---|---|---|
| Account name, type, subtype, mask, balances, currency | Plaid `/accounts/get` | Display balances and compute net worth |
| Transactions: amount, date, merchant, category, pending status | Plaid `/transactions/sync` | Spending history and cash-flow analysis |
| Investment holdings: security, quantity, cost basis, price, value | Plaid `/investments/holdings/get` | Portfolio display |
| Liability detail: APR, minimum payment, due dates, origination | Plaid `/liabilities/get` | Debt tracking |
| Plaid `access_token` and `item_id` | Plaid `/item/public_token/exchange` | Authorize subsequent data requests |
| Institution name and identifier | Plaid `/institutions/get_by_id` | Label connections in the interface |
| Email address, password hash (optional), Google subject identifier | The operator | Authentication |
| Session records | Generated at sign-in | Maintain an authenticated session |
| Daily net-worth snapshots (aggregate totals only) | Computed | Net worth over time |

No data is collected beyond what these products return. No data is sold, shared,
or transmitted to any third party. There are no analytics, advertising, or
tracking services in the application.

## 3. Where data is stored

- **Database:** Neon (managed PostgreSQL), US East region. Encrypted at rest by
  the provider; all connections require TLS (`sslmode=require`).
- **Application:** Vercel, US East. TLS 1.2 and 1.3 only; TLS 1.0 and 1.1 are
  refused. HSTS is enforced with a two-year max-age.
- **Secrets:** Deployment environment variables, not in source control. The
  repository has never contained a credential.

## 4. Encryption

- **In transit:** TLS 1.2 or better on every hop — browser to application,
  application to database, application to Plaid.
- **At rest:** Plaid `access_token` values and TOTP shared secrets are encrypted
  with **AES-256-GCM** at the application layer before they are written, using a
  32-byte key held only in deployment configuration. A database dump alone
  therefore yields no usable bank credential. Remaining data is covered by the
  database provider's storage encryption.
- **Passwords:** Argon2id (19 MiB memory, 2 iterations), when a password is set
  at all. Session tokens are stored only as SHA-256 digests, never in the clear.

## 5. Retention periods

| Record | Retained | Basis |
|---|---|---|
| Accounts, transactions, holdings, liability detail | While the connection is linked | Required for the application's only function |
| Plaid access tokens | While the connection is linked | Required to refresh data |
| Net-worth snapshots | Indefinitely | Aggregate totals only; no account or transaction detail |
| User record | Until the account is deleted | Required for authentication |
| Sessions | 30 days maximum, extended on use | Bounds the window of a stolen session |
| Invitations | Until revoked | Access-control record |

Plaid returns up to 24 months of transaction history. The application does not
request or retain data beyond what the linked institution provides.

## 6. Deletion

Deletion is enforced by database foreign-key constraints rather than by
application code remembering to clean up, so it cannot be partially applied.

**Unlinking an institution** revokes the access token at Plaid via
`/item/remove`, then deletes the local record. Every account, transaction,
holding, and liability record belonging to that institution is removed by
cascade in the same transaction.

**Deleting the user record** removes every account, transaction, holding,
liability record, session, and snapshot belonging to it, by cascade.

**Expired sessions** are deleted daily by a scheduled job, independently of
whether the user signs in again.

Deletion is immediate and permanent. There is no soft-delete, no archive, and no
backup tier that retains deleted records beyond the database provider's
short-term point-in-time recovery window.

## 7. Access control

Access to production systems (hosting, database, Plaid dashboard, source
repository) is limited to the single operator, using individual accounts secured
with multi-factor authentication. There are no employees, contractors, shared
accounts, or third-party processors, so there is no provisioning or
de-provisioning process to operate.

Within the application, every database query is scoped to the authenticated
user's identifier, and an allowlist held in deployment configuration governs
which email addresses may hold a session at all — checked on every request, not
only at sign-in.

## 8. Review

This policy is reviewed annually, and whenever the application begins storing a
new category of data or changes where data is stored. The current version is
kept in the application's source repository.
