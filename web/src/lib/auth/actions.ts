"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isEmailAllowed } from "@/lib/env";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { rateLimit, resetRateLimit } from "./rate-limit";
import { canRegister, consumeInvite, isFirstRun } from "./invites";
import { verifyCodeWithCounter } from "./totp";
import { decryptSecret } from "./totp-storage";
import { clearPendingCookie, readPendingUserId, setPendingCookie } from "./pending";

export type AuthState = { error?: string } | undefined;

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(256),
});

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();

  // Prefer the platform header, which the edge sets and a client cannot forge.
  // Falling back to the *rightmost* X-Forwarded-For entry rather than the
  // leftmost: the left is client-supplied on most infrastructure, so keying on
  // it would let an attacker sidestep the limit by varying one header.
  const ip =
    h.get("x-vercel-forwarded-for") ??
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown";

  return `${prefix}:${ip}`;
}

/**
 * A real Argon2id hash of a value nobody knows, used to burn the same CPU time
 * on a missing account as on a real one. Without this, "no such user" returns
 * measurably faster than "wrong password" and the login form becomes an oracle
 * for which emails are registered.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$c2FtcGxlZHVtbXloYXNodmFsdWVub3RyZWFs";

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const key = await clientKey("login");
  const limit = rateLimit(key, 10, 15 * 60 * 1000);

  if (!limit.allowed) {
    return {
      error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  const valid = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, parsed.data.password);

  // One message for every failure mode. A Google-only account has no password
  // hash, so it falls through here too rather than revealing how it signs in —
  // and a non-allowlisted address is indistinguishable from a wrong password.
  if (!user || !user.passwordHash || !valid || !user.isActive || !isEmailAllowed(user.email)) {
    return { error: "Incorrect email or password" };
  }

  resetRateLimit(key);

  if (user.totpEnabledAt) {
    await setPendingCookie(user.id);
    redirect("/login/verify");
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);

  redirect("/dashboard");
}

/** Attempts allowed against the second factor before the account locks briefly. */
const TOTP_MAX_ATTEMPTS = 8;
const TOTP_LOCKOUT_MS = 15 * 60 * 1000;

export async function verifyTwoFactor(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const userId = await readPendingUserId();
  if (!userId) return { error: "That sign-in attempt expired. Start again." };

  // In-memory limiter first (cheap), but it resets on cold start and is not
  // shared across serverless instances — so the real cap is the persisted
  // counter below.
  rateLimit(`2fa:${userId}`, TOTP_MAX_ATTEMPTS, TOTP_LOCKOUT_MS);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.totpSecretEncrypted || !user.isActive) {
    return { error: "That sign-in attempt expired. Start again." };
  }

  if (user.totpLockedUntil && user.totpLockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.totpLockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Too many incorrect codes. Try again in ${minutes} minute(s).` };
  }

  const code = String(formData.get("code") ?? "");
  const result = verifyCodeWithCounter(
    decryptSecret(user.totpSecretEncrypted),
    code,
    user.totpLastUsedCounter,
  );

  if (!result.ok) {
    const attempts = user.totpFailedAttempts + 1;

    await db
      .update(users)
      .set({
        totpFailedAttempts: attempts,
        totpLockedUntil:
          attempts >= TOTP_MAX_ATTEMPTS ? new Date(Date.now() + TOTP_LOCKOUT_MS) : null,
      })
      .where(eq(users.id, user.id));

    return { error: "That code is not valid. Check your authenticator app." };
  }

  await clearPendingCookie();

  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      // Burn this time step so the same code cannot be replayed.
      totpLastUsedCounter: result.counter,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    })
    .where(eq(users.id, user.id));

  await createSession(user.id);

  redirect("/dashboard");
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const strength = validatePasswordStrength(parsed.data.password);
  if (!strength.ok) return { error: strength.reason };

  const limit = rateLimit(await clientKey("register"), 5, 60 * 60 * 1000);
  if (!limit.allowed) return { error: "Too many sign-up attempts. Try again later." };

  const email = parsed.data.email.toLowerCase().trim();

  if (!(await canRegister(email))) {
    return { error: "That email has not been invited to this dashboard." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  // Let the unique index arbitrate rather than checking-then-inserting, which
  // races under concurrent submissions.
  const inserted = await db
    .insert(users)
    .values({ email, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  const user = inserted[0];
  if (!user) return { error: "An account with that email already exists" };

  await consumeInvite(email);
  await createSession(user.id);

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export { isFirstRun };

/** Random, URL-safe, and unguessable — for anywhere a one-off token is needed. */
export async function generateToken(): Promise<string> {
  return randomBytes(32).toString("base64url");
}
