import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { decrypt } from "@/lib/crypto";
import { removeItem } from "@/lib/plaid/client";
import { describePlaidError } from "@/lib/plaid/errors";

export const runtime = "nodejs";

/**
 * Unlink an institution.
 *
 * Deletes the Item at Plaid first so the access token is revoked on their side —
 * dropping our row alone would leave a live token orphaned and still billable.
 * Accounts and transactions cascade from the foreign keys.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await context.params;

  const item = await db.query.plaidItems.findFirst({
    where: and(eq(plaidItems.id, id), eq(plaidItems.userId, user.id)),
  });

  if (!item) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  try {
    await removeItem(decrypt(item.accessTokenEncrypted));
  } catch (error) {
    // If Plaid already dropped the Item, local cleanup should still proceed;
    // otherwise the row is unremovable through the UI forever.
    console.warn("[plaid] itemRemove failed, continuing with local delete", describePlaidError(error));
  }

  await db.delete(plaidItems).where(eq(plaidItems.id, item.id));

  return NextResponse.json({ removed: true });
}
