import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { syncAllForUser } from "@/lib/plaid/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Manual "refresh now". Plaid pushes updates via webhook; this is the impatient path. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Plaid bills per API call and rate-limits its own endpoints; a user leaning on
  // the refresh button should not be able to hammer them.
  const limit = rateLimit(`sync:${user.id}`, 6, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Please wait ${limit.retryAfterSeconds}s before refreshing again` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const results = await syncAllForUser(user.id);

  const totals = results.reduce(
    (acc, r) => ({
      added: acc.added + r.added,
      modified: acc.modified + r.modified,
      removed: acc.removed + r.removed,
      holdings: acc.holdings + r.holdings,
      liabilities: acc.liabilities + r.liabilities,
      errors: acc.errors + (r.error ? 1 : 0),
    }),
    { added: 0, modified: 0, removed: 0, holdings: 0, liabilities: 0, errors: 0 },
  );

  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/transactions");

  return NextResponse.json({ items: results.length, ...totals });
}
