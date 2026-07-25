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

  PLAID_CLIENT_ID: z.string().min(1),
  PLAID_SECRET: z.string().min(1),
  PLAID_ENV: z.enum(["sandbox", "production"]).default("sandbox"),

  /** Public origin, e.g. https://finance.example.com. Used for Plaid redirect + webhook URIs. */
  APP_URL: z.string().url().default("http://localhost:3000"),

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
