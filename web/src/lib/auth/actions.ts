"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env, isProd, isEmailAllowed } from "@/lib/env";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { rateLimit, resetRateLimit } from "./rate-limit";
import { canRegister, consumeInvite, isFirstRun } from "./invites";
import { decryptSecret, verifyCode } from "./totp";

export type AuthState = { error?: string } | undefined;

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(256),
});

async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

// ─── Two-factor interstitial ─────────────────────────────────────────────────

const PENDING_COOKIE = "fd_2fa_pending";
const PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Between a correct password and a correct TOTP code the user is authenticated
 * but not yet logged in. That state lives in a short-lived HMAC-signed cookie
 * rather than a real session, so possessing it grants nothing on its own.
 */
function signPending(userId: string, expiresAt: number): string {
  const payload = `${userId}.${expiresAt}`;
  const mac = createHmac("sha256", env.ENCRYPTION_KEY).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function verifyPending(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAtRaw, mac] = parts;
  const expected = createHmac("sha256", env.ENCRYPTION_KEY)
    .update(`${userId}.${expiresAtRaw}`)
    .digest("base64url");

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (Number(expiresAtRaw) < Date.now()) return null;

  return userId;
}

async function startTwoFactor(userId: string): Promise<never> {
  const expiresAt = Date.now() + PENDING_TTL_MS;

  const store = await cookies();
  store.set(PENDING_COOKIE, signPending(userId, expiresAt), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_TTL_MS / 1000,
  });

  redirect("/login/verify");
}

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

  if (user.totpEnabledAt) await startTwoFactor(user.id);

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);

  redirect("/dashboard");
}

export async function verifyTwoFactor(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;

  const userId = token ? verifyPending(token) : null;
  if (!userId) return { error: "That sign-in attempt expired. Start again." };

  const limit = rateLimit(`2fa:${userId}`, 8, 15 * 60 * 1000);
  if (!limit.allowed) return { error: "Too many attempts. Try again shortly." };

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.totpSecretEncrypted || !user.isActive) {
    return { error: "That sign-in attempt expired. Start again." };
  }

  const code = String(formData.get("code") ?? "");
  if (!verifyCode(decryptSecret(user.totpSecretEncrypted), code)) {
    return { error: "That code is not valid. Check your authenticator app." };
  }

  store.delete(PENDING_COOKIE);

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
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
