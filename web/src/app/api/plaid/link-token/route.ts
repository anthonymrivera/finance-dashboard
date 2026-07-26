import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { decrypt } from "@/lib/crypto";
import { plaidEnvFor, type PlaidEnv } from "@/lib/env";
import { createLinkToken, createUpdateModeLinkToken } from "@/lib/plaid/client";
import { describePlaidError } from "@/lib/plaid/errors";

export const runtime = "nodejs";

/**
 * Mint a Link token for the browser.
 *
 * Passing `?itemId=` returns an update-mode token, which repairs an existing
 * connection whose login has expired rather than creating a duplicate Item.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const itemId = new URL(request.url).searchParams.get("itemId");

  try {
    if (itemId) {
      const item = await db.query.plaidItems.findFirst({
        // Scoped to the caller — otherwise an id from another user's account
        // would mint a token against their bank connection.
        where: and(eq(plaidItems.id, itemId), eq(plaidItems.userId, user.id)),
      });

      if (!item) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

      // Update mode must target the environment that issued the existing token.
      const linkToken = await createUpdateModeLinkToken(
        user.id,
        decrypt(item.accessTokenEncrypted),
        item.environment as PlaidEnv,
      );
      return NextResponse.json({ linkToken });
    }

    // A demo account is pinned to sandbox, so anything linked from it can only
    // ever be a fake institution — even when the app is live in production.
    const environment = plaidEnvFor(user.email);

    return NextResponse.json({
      linkToken: await createLinkToken(user.id, environment),
      environment,
    });
  } catch (error) {
    console.error("[plaid] link token creation failed", describePlaidError(error));
    return NextResponse.json({ error: "Could not start bank connection" }, { status: 502 });
  }
}
