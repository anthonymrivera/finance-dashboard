import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordSnapshot } from "@/lib/queries";
import { syncAllForUser } from "@/lib/plaid/sync";
import { describePlaidError } from "@/lib/plaid/errors";
import { pruneExpiredSessions, safeEqual } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily maintenance, run by Vercel Cron (see vercel.json).
 *
 * Records a net-worth snapshot per user — Plaid has no historical balance API,
 * so this is the only way a net-worth-over-time chart can ever exist — then
 * syncs and prunes dead sessions.
 *
 * Authorized by CRON_SECRET. Vercel sends it automatically; without the check
 * this endpoint would be a public trigger for unbounded Plaid API calls.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true));

  const results = [];

  for (const user of active) {
    try {
      // Sync first so the snapshot reflects today's balances rather than
      // yesterday's cached ones.
      await syncAllForUser(user.id);
      await recordSnapshot(user.id);
      results.push({ userId: user.id, ok: true });
    } catch (error) {
      // One user's broken bank connection must not stop everyone else's snapshot.
      console.error("[cron] snapshot failed", {
        userId: user.id,
        error: describePlaidError(error),
      });
      results.push({ userId: user.id, ok: false });
    }
  }

  const prunedSessions = await pruneExpiredSessions();

  return NextResponse.json({
    users: results.length,
    failed: results.filter((r) => !r.ok).length,
    prunedSessions,
  });
}
