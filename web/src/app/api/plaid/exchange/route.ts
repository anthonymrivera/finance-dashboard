import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { encrypt } from "@/lib/crypto";
import { exchangePublicToken, getInstitution } from "@/lib/plaid/client";
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
      // Re-linking an institution already connected should refresh the stored
      // token in place, not create a second Item pointing at the same bank.
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
    console.error("[plaid] public token exchange failed", error);
    return NextResponse.json({ error: "Could not link account" }, { status: 502 });
  }
}
