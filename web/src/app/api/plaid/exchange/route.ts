import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { encrypt } from "@/lib/crypto";
import { and, eq } from "drizzle-orm";
import { exchangePublicToken, getInstitution, removeItem } from "@/lib/plaid/client";
import { describePlaidError } from "@/lib/plaid/errors";
import { syncItem } from "@/lib/plaid/sync";

export const runtime = "nodejs";
// The initial sync can pull two years of history; well beyond the default limit.
export const maxDuration = 60;

const schema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().optional(),
});

/**
 * Complete a Link session: trade the public token for a durable access token,
 * store it encrypted, and pull the first batch of accounts and transactions.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { accessToken, itemId } = await exchangePublicToken(parsed.data.publicToken);

    /**
     * Refuse a second connection to an institution this user already linked.
     *
     * Every Link session mints a fresh item_id and fresh account_ids, so nothing
     * about a re-link collides with the existing rows — the accounts insert
     * cleanly alongside the originals and net worth silently doubles. The likely
     * path into this is a user whose connection broke clicking "Link bank"
     * instead of "Reconnect".
     *
     * Rejecting keeps the existing history, categorisations, and notes intact.
     * The escape hatch for a genuine fresh start is Unlink then Link, which
     * revokes and cascades properly.
     */
    if (parsed.data.institutionId) {
      const existing = await db.query.plaidItems.findFirst({
        where: and(
          eq(plaidItems.userId, user.id),
          eq(plaidItems.institutionId, parsed.data.institutionId),
        ),
      });

      if (existing) {
        // Revoke the token just minted, or it lingers as an orphaned — and
        // billable — Item on the Plaid side.
        await removeItem(accessToken).catch(() => {});

        return NextResponse.json(
          {
            error:
              "That bank is already connected. Use Reconnect on the existing connection to repair it, or Unlink it first to start over.",
          },
          { status: 409 },
        );
      }
    }

    const institution = parsed.data.institutionId
      ? await getInstitution(parsed.data.institutionId)
      : null;

    const [item] = await db
      .insert(plaidItems)
      .values({
        userId: user.id,
        plaidItemId: itemId,
        accessTokenEncrypted: encrypt(accessToken),
        institutionId: parsed.data.institutionId ?? null,
        institutionName: institution?.name ?? null,
      })
      // Belt and braces for the exact-same-item_id case (update mode re-entry).
      .onConflictDoUpdate({
        target: plaidItems.plaidItemId,
        set: { accessTokenEncrypted: encrypt(accessToken), errorCode: null },
      })
      .returning({ id: plaidItems.id });

    if (!item) throw new Error("Failed to persist Plaid item");

    const result = await syncItem(item.id);

    return NextResponse.json({
      institutionName: institution?.name ?? "Your bank",
      ...result,
    });
  } catch (error) {
    console.error("[plaid] public token exchange failed", describePlaidError(error));
    return NextResponse.json({ error: "Could not link account" }, { status: 502 });
  }
}
