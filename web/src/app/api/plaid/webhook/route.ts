import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { verifyWebhook } from "@/lib/plaid/client";
import { syncItem } from "@/lib/plaid/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Plaid's push notification that an Item has new data.
 *
 * This endpoint is public and unauthenticated by necessity — Plaid's servers
 * call it, not a logged-in browser — so every request must be cryptographically
 * verified before it is allowed to touch anything.
 */
export async function POST(request: Request) {
  // The raw body is needed byte-for-byte: the signature covers a hash of it,
  // and re-serializing parsed JSON would not reproduce the same bytes.
  const rawBody = await request.text();
  const verificationHeader = request.headers.get("plaid-verification");

  if (!verificationHeader || !(await verifyWebhook(rawBody, verificationHeader))) {
    console.warn("[plaid] rejected webhook with invalid or missing signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { webhook_type?: string; webhook_code?: string; item_id?: string; error?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const { webhook_type: type, webhook_code: code, item_id: plaidItemId } = payload;

  if (!plaidItemId) return NextResponse.json({ received: true });

  const item = await db.query.plaidItems.findFirst({
    where: eq(plaidItems.plaidItemId, plaidItemId),
  });

  // An unknown Item is normal after an unlink — acknowledge rather than error,
  // or Plaid will keep retrying a webhook that can never succeed.
  if (!item) return NextResponse.json({ received: true });

  try {
    if (type === "TRANSACTIONS") {
      switch (code) {
        case "SYNC_UPDATES_AVAILABLE":
        case "INITIAL_UPDATE":
        case "HISTORICAL_UPDATE":
        case "DEFAULT_UPDATE":
          await syncItem(item.id);
          break;
        default:
          break;
      }
    }

    if (type === "ITEM") {
      if (code === "ERROR") {
        const errorCode =
          (payload.error as { error_code?: string } | undefined)?.error_code ?? "ITEM_ERROR";
        await db.update(plaidItems).set({ errorCode }).where(eq(plaidItems.id, item.id));
      }

      // The user repaired the login through Link's update mode.
      if (code === "USER_PERMISSION_REVOKED" || code === "PENDING_EXPIRATION") {
        await db.update(plaidItems).set({ errorCode: code }).where(eq(plaidItems.id, item.id));
      }
    }
  } catch (error) {
    // Returning 200 regardless: the work is retried by the next webhook or the
    // scheduled sync, and a non-2xx here triggers Plaid's own retry storm.
    console.error("[plaid] webhook handling failed", { type, code, error });
  }

  return NextResponse.json({ received: true });
}
