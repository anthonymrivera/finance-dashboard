import { createTOTPKeyURI, verifyTOTPWithGracePeriod } from "@oslojs/otp";
import { decodeBase32IgnorePadding, encodeBase32NoPadding } from "@oslojs/encoding";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * Time-based one-time passwords, for authenticator apps.
 *
 * 30-second interval, 6 digits — the parameters every authenticator app assumes.
 * A 30-second grace period is allowed on verification so a phone whose clock has
 * drifted by a few seconds still works; without it, correct codes get rejected
 * and people conclude 2FA is broken.
 */

const INTERVAL_SECONDS = 30;
const DIGITS = 6;
const ISSUER = "Finance Dashboard";

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

/** Encrypt before storage — a readable secret is a mintable code. */
export function encryptSecret(secret: Uint8Array): string {
  return encrypt(encodeSecret(secret));
}

export function decryptSecret(ciphertext: string): Uint8Array {
  return decodeSecret(decrypt(ciphertext));
}

/** otpauth:// URI, rendered as the QR code an authenticator app scans. */
export function keyUri(secret: Uint8Array, accountName: string): string {
  return createTOTPKeyURI(ISSUER, accountName, secret, INTERVAL_SECONDS, DIGITS);
}

export function verifyCode(secret: Uint8Array, code: string): boolean {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== DIGITS) return false;

  try {
    return verifyTOTPWithGracePeriod(secret, INTERVAL_SECONDS, DIGITS, normalized, 30);
  } catch {
    return false;
  }
}
