# Finance Dashboard

Every account in one view. Balances and transactions sync automatically from your
banks through Plaid; anything Plaid cannot reach you can track by hand.

Next.js 16 · Postgres (Neon) · Drizzle · Plaid · Tailwind 4

---

## Setup

### 1. Database

Create a free project at [neon.tech](https://neon.tech), then copy the **pooled**
connection string (the host contains `-pooler`) from Connection Details.

### 2. Plaid

Create a free account at [dashboard.plaid.com](https://dashboard.plaid.com).
Under **Developers → Keys**, copy your `client_id` and your **Sandbox** secret.

Sandbox is free and unlimited: fake institutions with realistic generated
transactions. Build and test everything against it before touching real accounts.

### 3. Environment

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `PLAID_CLIENT_ID`, and `PLAID_SECRET`. Generate the two
secrets:

```bash
openssl rand -base64 32   # ENCRYPTION_KEY
openssl rand -hex 32      # CRON_SECRET
```

> **Back up `ENCRYPTION_KEY`.** It encrypts your stored Plaid access tokens. If it
> is lost or changed, every bank connection becomes undecryptable and has to be
> relinked from scratch.

### 4. Run

```bash
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The first account you create is yours and needs no
invite. After that, **sign-up is invite-only**: add an address under
Settings → People before that person can register, by password or by Google.

### 4a. Google sign-in (optional)

At [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services
→ Credentials** → **Create credentials → OAuth client ID → Web application**, add
these Authorized redirect URIs:

```
http://localhost:3000/api/auth/google/callback
https://your-domain.com/api/auth/google/callback
```

Put the client ID and secret in `.env`. Leave them blank and the Google button
simply doesn't render — passwords keep working.

Signing in with Google against an address that already has a password account
links the two rather than creating a duplicate, but only when Google reports the
address as verified.

### 5. Link a sandbox bank

Click **Link an account** and pick any institution. At the credentials prompt use
Plaid's sandbox login:

| Field    | Value           |
| -------- | --------------- |
| Username | `user_good`     |
| Password | `pass_good`     |
| MFA code | `1234` if asked |

Two years of generated transactions land within a few seconds.

---

## Going to production

1. **Deploy.** Import the repo on Vercel, set the root directory to `web`, and add
   every variable from `.env` to the project. Set `APP_URL` to the deployed origin.
2. **Request Plaid Production access** in the Plaid dashboard. You will complete an
   application profile, a company profile, and a security questionnaire; approval
   takes a couple of business days. New teams get a free **Trial plan** with real
   production data, capped at 10 linked Items.
3. **Switch keys.** Set `PLAID_ENV=production` and swap in the production secret.
   Existing sandbox Items do not carry over — relink each institution.
4. **Confirm webhooks.** Once `APP_URL` is HTTPS, new Items register
   `/api/plaid/webhook` automatically, and Plaid pushes updates rather than waiting
   for a manual refresh.

`vercel.json` registers a daily cron at 08:00 UTC that syncs every account, records
a net-worth snapshot, and prunes expired sessions.

---

## How it works

**Sync.** `/transactions/sync` is cursor-based. Each page is written before the
cursor advances, so an interrupted sync resumes rather than replaying history.
Accounts upsert on Plaid's account id and transactions on Plaid's transaction id,
which makes re-running a sync harmless.

**Sign convention.** Plaid reports `amount` as positive when money *leaves* an
account. That is inverted once, at the sync boundary, so everywhere else positive
means money in and negative means money out.

**Money.** Amounts are `numeric(19,4)` in Postgres and strings in TypeScript, with
arithmetic in `lib/money.ts` over scaled BigInts. Nothing touches a float — `0.1 +
0.2` costing you a cent is a real bug in a finance app.

**Your edits survive syncs.** Recategorizing writes to `user_category`, not
`category`, and notes live in their own column. A re-sync overwrites what the bank
owns and never what you wrote.

**Net worth history.** Plaid has no historical balance API, so the daily cron
snapshots assets, liabilities, and net worth. The trend chart is only as deep as
the job has been running.

**Products.** Transactions, Investments, and Liabilities are all requested at link
time — meaning balances and history, brokerage holdings, and loan terms (APR,
minimum payment, due dates). Requesting a product *after* an Item is linked does
not apply to it; every institution would have to be reconnected. Institutions that
don't support a product return a "no such product" error, which is treated as
"nothing here" rather than a failure.

## Security

- **Invite-only registration.** The app is public; sign-up is not. An email must be
  allowlisted before it can register — by password or by Google. Without this,
  anyone who finds the URL can link banks against your Plaid bill.
- **Two-factor authentication** (TOTP) for password accounts. Between a correct
  password and a correct code the user holds a short-lived signed cookie, not a
  session, so that intermediate state grants nothing. Turning 2FA off requires a
  current code.
- Plaid access tokens are encrypted at rest with AES-256-GCM before they touch the
  database. They are bank credentials. TOTP secrets use the same envelope.
- Sessions are server-side rows behind an httpOnly, `SameSite=Lax`, secure cookie.
  The database stores only a SHA-256 of the token, so a leaked dump yields nothing
  usable, and any session can be revoked instantly.
- Passwords are Argon2id at OWASP parameters, with a 12-character minimum and no
  composition rules — length is what actually resists cracking.
- Webhooks verify Plaid's ES256 signature *and* a hash of the raw body, and reject
  anything older than five minutes.
- Login and sign-up are rate-limited, and failed logins are indistinguishable from
  unknown emails in both message and timing.

## Commands

| Command               | What it does                         |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Development server                   |
| `npm run build`       | Production build                     |
| `npm run typecheck`   | `tsc --noEmit`                       |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate`  | Apply pending migrations             |
| `npm run db:studio`   | Browse the database                  |
