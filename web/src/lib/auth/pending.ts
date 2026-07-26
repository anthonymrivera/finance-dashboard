import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env, isProd } from "@/lib/env";

/**
 * The interstitial between "credentials accepted" and "logged in".
 *
 * Lives in its own module because both the password path and the Google OAuth
 * callback must use it. Anything exported from a "use server" file has to be an
 * async server action, so the shared helpers cannot live in actions.ts.
 *
 * The state is an HMAC-signed cookie rather than a session row: holding it
 * proves the first factor was satisfied and nothing more, so it grants no access
 * on its own.
 */

const COOKIE = "fd_2fa_pending";
const TTL_MS = 5 * 60 * 1000;

function sign(userId: string, expiresAt: number): string {
  const payload = `${userId}.${expiresAt}`;
  const mac = createHmac("sha256", env.ENCRYPTION_KEY).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

/** Returns the user id if the token is authentic and unexpired, else null. */
export function verifyPendingToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAtRaw, mac] = parts;

  const expected = createHmac("sha256", env.ENCRYPTION_KEY)
    .update(`${userId}.${expiresAtRaw}`)
    .digest("base64url");

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (!Number(expiresAtRaw) || Number(expiresAtRaw) < Date.now()) return null;

  return userId;
}

export async function setPendingCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sign(userId, Date.now() + TTL_MS), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function readPendingUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  return token ? verifyPendingToken(token) : null;
}

export async function clearPendingCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export const PENDING_COOKIE_NAME = COOKIE;
