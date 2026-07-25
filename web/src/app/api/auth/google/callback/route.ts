import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { googleClient, parseIdToken } from "@/lib/auth/google";
import { canRegister, consumeInvite } from "@/lib/auth/invites";
import { createSession } from "@/lib/auth/session";
import { googleEnabled, env } from "@/lib/env";

export const runtime = "nodejs";

/** Complete the Google sign-in redirect and establish a session. */
export async function GET(request: Request) {
  if (!googleEnabled) {
    return NextResponse.redirect(`${env.APP_URL}/login?error=google_unavailable`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const storedState = store.get("google_oauth_state")?.value;
  const codeVerifier = store.get("google_code_verifier")?.value;

  // Single-use: clear them before doing anything else, so a replayed callback
  // cannot reuse the same state.
  store.delete("google_oauth_state");
  store.delete("google_code_verifier");

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return NextResponse.redirect(`${env.APP_URL}/login?error=oauth_state`);
  }

  try {
    const tokens = await googleClient().validateAuthorizationCode(code, codeVerifier);
    const profile = parseIdToken(tokens.idToken());

    // An unverified Google address could belong to someone else entirely, which
    // would let an attacker claim an existing account by email match.
    if (!profile.emailVerified) {
      return NextResponse.redirect(`${env.APP_URL}/login?error=email_unverified`);
    }

    const existingByGoogleId = await db.query.users.findFirst({
      where: eq(users.googleId, profile.sub),
    });

    if (existingByGoogleId) {
      if (!existingByGoogleId.isActive) {
        return NextResponse.redirect(`${env.APP_URL}/login?error=account_disabled`);
      }
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), avatarUrl: profile.picture })
        .where(eq(users.id, existingByGoogleId.id));

      await createSession(existingByGoogleId.id);
      return NextResponse.redirect(`${env.APP_URL}/dashboard`);
    }

    // Same verified address as an existing password account: link the two rather
    // than creating a duplicate. Safe because Google vouched for the address.
    const existingByEmail = await db.query.users.findFirst({
      where: eq(users.email, profile.email),
    });

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        return NextResponse.redirect(`${env.APP_URL}/login?error=account_disabled`);
      }
      await db
        .update(users)
        .set({
          googleId: profile.sub,
          avatarUrl: profile.picture,
          displayName: existingByEmail.displayName ?? profile.name,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, existingByEmail.id));

      await createSession(existingByEmail.id);
      return NextResponse.redirect(`${env.APP_URL}/dashboard`);
    }

    // Brand new: the allowlist applies to Google exactly as it does to passwords.
    if (!(await canRegister(profile.email))) {
      return NextResponse.redirect(`${env.APP_URL}/login?error=not_invited`);
    }

    const [created] = await db
      .insert(users)
      .values({
        email: profile.email,
        googleId: profile.sub,
        displayName: profile.name,
        avatarUrl: profile.picture,
      })
      .returning({ id: users.id });

    if (!created) throw new Error("Failed to create user");

    await consumeInvite(profile.email);
    await createSession(created.id);

    return NextResponse.redirect(`${env.APP_URL}/dashboard`);
  } catch (error) {
    console.error("[auth] google callback failed", error);
    return NextResponse.redirect(`${env.APP_URL}/login?error=oauth_failed`);
  }
}
