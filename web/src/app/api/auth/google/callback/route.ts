import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { googleClient, parseIdToken } from "@/lib/auth/google";
import { canRegister, consumeInvite } from "@/lib/auth/invites";
import { createSession } from "@/lib/auth/session";
import { setPendingCookie } from "@/lib/auth/pending";
import { googleEnabled, env, isEmailAllowed } from "@/lib/env";

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

    // This endpoint is reachable by anyone holding any Google account, so the
    // allowlist is checked before any account lookup, creation, or linking.
    if (!isEmailAllowed(profile.email)) {
      console.warn("[auth] google sign-in refused for non-allowlisted address");
      return NextResponse.redirect(`${env.APP_URL}/login?error=not_invited`);
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

      // Google satisfies the first factor only. Skipping this made the settings
      // page's promise — "you will be asked for a code next time you sign in" —
      // false for anyone signing in with Google.
      if (existingByGoogleId.totpEnabledAt) {
        await setPendingCookie(existingByGoogleId.id);
        return NextResponse.redirect(`${env.APP_URL}/login/verify`);
      }

      await createSession(existingByGoogleId.id);
      return NextResponse.redirect(`${env.APP_URL}/dashboard`);
    }

    const existingByEmail = await db.query.users.findFirst({
      where: eq(users.email, profile.email),
    });

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        return NextResponse.redirect(`${env.APP_URL}/login?error=account_disabled`);
      }

      /**
       * Refuse to auto-link Google onto an account protected by a password and
       * TOTP. Linking on a verified-email match alone would let anyone able to
       * obtain a Google-verified token for that address — a Workspace domain
       * admin, or whoever re-registers a lapsed domain — bypass both factors in
       * a single request. The owner can link Google deliberately from Settings.
       */
      if (existingByEmail.totpEnabledAt) {
        return NextResponse.redirect(`${env.APP_URL}/login?error=link_requires_signin`);
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
    // Message only. The OAuth token exchange posts GOOGLE_CLIENT_SECRET, and a
    // thrown request/response object can carry that body into the logs.
    console.error(
      "[auth] google callback failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.redirect(`${env.APP_URL}/login?error=oauth_failed`);
  }
}
