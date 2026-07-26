import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import { decodeSecret, encodeSecret } from "./totp";

/**
 * At-rest handling for TOTP secrets, kept apart from the algorithm in totp.ts.
 *
 * A readable secret is a mintable code, so it never touches the database in the
 * clear — it goes through the same AES-256-GCM envelope as Plaid access tokens.
 */

export function encryptSecret(secret: Uint8Array): string {
  return encrypt(encodeSecret(secret));
}

export function decryptSecret(ciphertext: string): Uint8Array {
  return decodeSecret(decrypt(ciphertext));
}
