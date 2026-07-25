import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { googleClient } from "@/lib/auth/google";
import { googleEnabled, isProd } from "@/lib/env";

export const runtime = "nodejs";

/** Begin the Google sign-in redirect. */
export async function GET() {
  if (!googleEnabled) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 501 });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = googleClient().createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
  ]);

  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // ten minutes is ample for a redirect round trip
  };

  // State defends against CSRF on the callback; the verifier is the PKCE half
  // that proves the same client that started the flow is finishing it.
  store.set("google_oauth_state", state, options);
  store.set("google_code_verifier", codeVerifier, options);

  return NextResponse.redirect(url.toString());
}
