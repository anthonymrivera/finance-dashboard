import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { isProd } from "@/lib/env";

const COOKIE_NAME = "fd_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // renew once past halfway

/**
 * The cookie holds the raw token; the database stores only its SHA-256.
 * A leaked database backup therefore contains no usable session credentials —
 * the same reasoning as storing password hashes rather than passwords.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true, // unreadable from JS, so XSS cannot exfiltrate it
    secure: isProd, // HTTPS-only in production
    sameSite: "lax", // blocks CSRF on cross-site POSTs while keeping normal links working
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/**
 * Resolve the current user, sliding the expiry forward when a session is past
 * halfway through its life. Wrapped in React's `cache` so the many server
 * components on a page share one lookup per request instead of one each.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Expired: clean up rather than leaving the row to accumulate.
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  // A deactivated user must lose access immediately. The original app never
  // checked this, so `isActive` was decorative.
  if (!row.user.isActive) return null;

  if (row.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
    const renewed = new Date(Date.now() + SESSION_DURATION_MS);
    await db
      .update(sessions)
      .set({ expiresAt: renewed })
      .where(eq(sessions.id, row.sessionId));
  }

  return row.user;
});

/** For routes and actions where absence of a user is a programming error. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  store.delete(COOKIE_NAME);
}

/** Invalidate every session for a user — "sign out everywhere", or post-compromise. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function pruneExpiredSessions(): Promise<number> {
  const deleted = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning();
  return deleted.length;
}

/** Constant-time compare, for anywhere a secret is checked against user input. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
