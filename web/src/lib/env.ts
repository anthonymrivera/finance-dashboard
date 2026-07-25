import { z } from "zod";

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
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

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
