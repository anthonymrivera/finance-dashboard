import "server-only";
import { z } from "zod";

/**
 * Treat an empty string the same as unset, so a blank line in .env disables an
 * optional feature rather than tripping the inner min-length check.
 */
function emptyToUndefined<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => (v === "" ? undefined : v), inner.optional());
}

/**
 * Validated at import time so a misconfigured deploy fails fast and loudly
 * rather than surfacing as a confusing runtime error three layers deep.
 */
const schema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid Postgres connection string"),

  /** 32 bytes, base64-encoded. Generate: openssl rand -base64 32 */
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "ENCRYPTION_KEY must be exactly 32 bytes, base64-encoded (openssl rand -base64 32)",
    }),

  /** Same value across every Plaid environment. */
  PLAID_CLIENT_ID: z.string().min(1),

  /**
   * Plaid secrets are environment-specific, and this app talks to both at once:
   * real accounts against production, the demo account against sandbox. Holding
   * a single secret would make that impossible.
   */
  PLAID_SANDBOX_SECRET: z.string().min(1),
  PLAID_PRODUCTION_SECRET: emptyToUndefined(z.string().min(1)),

  /** Environment used by ordinary accounts. Demo accounts are always sandbox. */
  PLAID_ENV: z.enum(["sandbox", "production"]).default("sandbox"),

  /**
   * Addresses pinned to Plaid Sandbox no matter what PLAID_ENV says,
   * comma-separated.
   *
   * This is what makes a demo account safe to show people once the app is live
   * in production: anything linked from it can only ever be a fake sandbox
   * institution. Without the pin, clicking "Link an account" while signed into
   * the demo would connect a real bank to the real Plaid account — consuming a
   * production Item and pulling genuine financial data into a login meant for
   * demonstrations.
   *
   * Deployment config rather than a database flag, deliberately: no application
   * bug can promote a demo account to production.
   */
  DEMO_EMAILS: emptyToUndefined(z.string().min(1)),

  /**
   * Public origin, e.g. https://finance.example.com. Used for Plaid redirect and
   * webhook URIs.
   *
   * Trailing slashes are stripped. Everything downstream builds paths as
   * `${APP_URL}/api/...`, so a value pasted with the slash a browser address bar
   * shows produces `//api/...` — which Google rejects as redirect_uri_mismatch,
   * an error that says nothing about the actual cause.
   */
  APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, "")),

  /**
   * Optional: Google sign-in is disabled unless both are present, so the app
   * still boots for anyone who has not set up an OAuth client yet.
   *
   * An empty string in .env (how the setup script writes "unset") must read as
   * absent, not as a present-but-too-short value — otherwise a blank line here
   * fails validation instead of simply disabling Google.
   */
  GOOGLE_CLIENT_ID: emptyToUndefined(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: emptyToUndefined(z.string().min(1)),

  /**
   * Hard allowlist of addresses permitted to hold a session, comma-separated.
   *
   * This is deliberately redundant with the invite system. Invites are database
   * state; this is deployment configuration. With Google sign-in enabled, the
   * OAuth callback is reachable by anyone holding any Google account, so the
   * "only me" guarantee should not rest on a single layer of application logic
   * being correct forever. An attacker would have to compromise the Vercel
   * environment itself to get past this.
   *
   * Leave unset to fall back to invite-only behaviour.
   */
  ALLOWED_EMAILS: emptyToUndefined(z.string().min(1)),

  /**
   * Upstash Redis, for rate limiting shared across serverless instances.
   *
   * Optional: without both values the limiter falls back to an in-process Map,
   * which is fine locally but enforces little on Vercel, where every cold start
   * begins with an empty one.
   */
  UPSTASH_REDIS_REST_URL: emptyToUndefined(z.string().url()),
  UPSTASH_REDIS_REST_TOKEN: emptyToUndefined(z.string().min(1)),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

/** Google sign-in needs both halves of the credential pair to be usable. */
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Parsed once at boot rather than on every request. */
const allowedEmails = env.ALLOWED_EMAILS
  ? new Set(
      env.ALLOWED_EMAILS.split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
  : null;

export const allowlistActive = allowedEmails !== null;

/**
 * Whether this address may hold a session at all.
 *
 * Checked at every authentication entry point *and* on session validation, so
 * removing an address from the allowlist revokes access on the next request
 * rather than whenever the existing session happens to expire.
 */
export function isEmailAllowed(email: string): boolean {
  if (!allowedEmails) return true;
  return allowedEmails.has(email.trim().toLowerCase());
}

const demoEmails = new Set(
  (env.DEMO_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export type PlaidEnv = "sandbox" | "production";

/** True for accounts that exist to be shown to other people. */
export function isDemoEmail(email: string): boolean {
  return demoEmails.has(email.trim().toLowerCase());
}

/**
 * Which Plaid environment this account operates in.
 *
 * Demo accounts are hard-pinned to sandbox; everyone else follows PLAID_ENV.
 */
export function plaidEnvFor(email: string): PlaidEnv {
  return isDemoEmail(email) ? "sandbox" : env.PLAID_ENV;
}

// Fail at boot rather than at link time: a production deployment missing its
// production secret is a misconfiguration, not a runtime condition to handle.
if (env.PLAID_ENV === "production" && !env.PLAID_PRODUCTION_SECRET) {
  throw new Error(
    "PLAID_ENV is 'production' but PLAID_PRODUCTION_SECRET is not set.\n" +
      "Add the production secret from dashboard.plaid.com → Developers → Keys.",
  );
}
