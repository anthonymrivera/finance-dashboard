import { createTOTPKeyURI, generateHOTP } from "@oslojs/otp";
import { decodeBase32IgnorePadding, encodeBase32NoPadding } from "@oslojs/encoding";
import { randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Deliberately free of any dependency on the encryption layer or on env config.
 * Storage concerns live in totp-storage.ts, which keeps the algorithm here pure
 * and directly testable.
 */

/**
 * Time-based one-time passwords, for authenticator apps.
 *
 * 30-second interval, 6 digits — the parameters every authenticator app assumes.
 *
 * Verification returns the *counter* that matched rather than a bare boolean, so
 * the caller can persist it and refuse anything at or below it on the next
 * attempt. Without that, a code stays valid for the whole acceptance window and
 * can be replayed by anyone who observes it — over a shoulder, through a
 * phishing proxy, or from a screenshot — to complete a second sign-in or to
 * satisfy the "enter a current code" check that guards disabling 2FA.
 */

const INTERVAL_SECONDS = 30;
const DIGITS = 6;
const ISSUER = "Finance Dashboard";

/**
 * Accept one step either side of now (a 90-second span) to tolerate clock drift
 * on the phone. Replay prevention is what keeps that window safe.
 */
const WINDOW_STEPS = 1;

/** 20 bytes is the RFC 4226 recommendation for a shared secret. */
export function generateSecret(): Uint8Array {
  return new Uint8Array(randomBytes(20));
}

export function encodeSecret(secret: Uint8Array): string {
  return encodeBase32NoPadding(secret);
}

export function decodeSecret(encoded: string): Uint8Array {
  return decodeBase32IgnorePadding(encoded.toUpperCase());
}

/** otpauth:// URI, rendered as the QR code an authenticator app scans. */
export function keyUri(secret: Uint8Array, accountName: string): string {
  return createTOTPKeyURI(ISSUER, accountName, secret, INTERVAL_SECONDS, DIGITS);
}

function currentCounter(): bigint {
  return BigInt(Math.floor(Date.now() / 1000 / INTERVAL_SECONDS));
}

function codesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type TotpResult = { ok: true; counter: number } | { ok: false };

/**
 * Verify a code and report which time step it came from.
 *
 * `minCounter` is the last counter this user already spent; anything at or below
 * it is refused even when otherwise valid, which is what makes a code one-shot.
 */
export function verifyCodeWithCounter(
  secret: Uint8Array,
  code: string,
  minCounter: number | null,
): TotpResult {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== DIGITS) return { ok: false };

  const now = currentCounter();

  for (let offset = -WINDOW_STEPS; offset <= WINDOW_STEPS; offset++) {
    const counter = now + BigInt(offset);
    if (counter < 0n) continue;

    // Already spent — a replay of a code this account has used before.
    if (minCounter !== null && Number(counter) <= minCounter) continue;

    try {
      if (codesMatch(generateHOTP(secret, counter, DIGITS), normalized)) {
        return { ok: true, counter: Number(counter) };
      }
    } catch {
      return { ok: false };
    }
  }

  return { ok: false };
}
