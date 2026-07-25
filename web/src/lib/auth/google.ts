import { Google } from "arctic";
import { env } from "@/lib/env";

/**
 * Google OAuth 2.0 with PKCE, via arctic.
 *
 * Arctic handles the protocol details — state, code verifier, token exchange —
 * while sessions stay on the app's own `sessions` table. That keeps one session
 * model for both password and Google sign-in, rather than bolting on a second
 * auth system with its own idea of what "logged in" means.
 */
export function googleClient(): Google {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google sign-in is not configured");
  }

  return new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.APP_URL}/api/auth/google/callback`,
  );
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/**
 * Read the profile from the ID token's payload.
 *
 * The token's signature was already validated by arctic during exchange, and it
 * came directly from Google's token endpoint over TLS, so decoding the payload
 * here is safe — this is not accepting a token from the browser.
 */
export function parseIdToken(idToken: string): GoogleProfile {
  const payload = JSON.parse(
    Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"),
  ) as Record<string, unknown>;

  const email = typeof payload.email === "string" ? payload.email : null;
  const sub = typeof payload.sub === "string" ? payload.sub : null;

  if (!sub || !email) throw new Error("Google returned an incomplete profile");

  return {
    sub,
    email: email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
