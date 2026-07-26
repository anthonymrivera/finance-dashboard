import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM envelope encryption for Plaid access tokens.
 *
 * These tokens are effectively long-lived bank credentials: anyone holding one
 * can read the linked account's balances and full transaction history. They must
 * never be stored in plaintext, so a database dump alone is not enough to use them.
 *
 * Wire format: v1.<iv>.<authTag>.<ciphertext>, all base64.
 * The version prefix leaves room to rotate algorithms or keys later without
 * having to guess at how existing rows were encoded.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, the GCM standard
const VERSION = "v1";

function key(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, "base64");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed or unsupported ciphertext envelope");
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts;

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  // Throws if the auth tag does not verify, which is what we want: a tampered
  // or wrong-key payload must fail rather than return garbage.
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
