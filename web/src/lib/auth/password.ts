import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id — the current password-hashing recommendation, and a step up from the
 * BCrypt defaults the original app used. These parameters follow OWASP guidance:
 * 19 MiB of memory, 2 iterations, 1 degree of parallelism.
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    // A malformed hash in the database should read as "wrong password",
    // not crash the login route.
    return false;
  }
}

/**
 * Deliberately permissive on composition and strict on length. Length is what
 * actually resists offline cracking; mandatory symbol classes mostly push people
 * toward `Password1!`. NIST SP 800-63B says the same.
 */
export function validatePasswordStrength(password: string): { ok: true } | { ok: false; reason: string } {
  if (password.length < 12) {
    return { ok: false, reason: "Password must be at least 12 characters" };
  }
  if (password.length > 256) {
    return { ok: false, reason: "Password must be under 256 characters" };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, reason: "Password cannot be a single repeated character" };
  }
  return { ok: true };
}
