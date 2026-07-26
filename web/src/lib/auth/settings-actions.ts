"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import QRCode from "qrcode";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser, destroyAllSessions, createSession } from "./session";
import { createInvite, revokeInvite } from "./invites";
import { encodeSecret, generateSecret, keyUri, verifyCodeWithCounter } from "./totp";
import { decryptSecret, encryptSecret } from "./totp-storage";

export type SettingsState = { error?: string; success?: string } | undefined;

// ─── Invites ─────────────────────────────────────────────────────────────────

const emailSchema = z.string().email("Enter a valid email address").max(254);

export async function inviteUser(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid email" };

  const email = parsed.data.toLowerCase().trim();

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { error: "That person already has an account" };

  await createInvite(email, user.id);

  revalidatePath("/settings");
  return { success: `${email} can now create an account` };
}

export async function revokeUserInvite(email: string): Promise<SettingsState> {
  await requireUser();
  await revokeInvite(email);

  revalidatePath("/settings");
  return { success: "Invite revoked" };
}

// ─── Two-factor ──────────────────────────────────────────────────────────────

export type TotpSetup = { secretBase32: string; qrDataUri: string } | { error: string };

/**
 * Begin enrolment: generate a secret and stage it as *pending*.
 *
 * Two things this must not do, both of which it previously did. It must not
 * touch the live secret or `totpEnabledAt` — a server action is reachable as a
 * direct POST regardless of what the UI renders, so an attacker holding a
 * session could call this to silently strip an existing second factor, then
 * enrol their own device. And it must not proceed at all on an account that
 * already has 2FA on without a current code, for the same reason `disableTotp`
 * demands one.
 */
export async function beginTotpSetup(formData?: FormData): Promise<TotpSetup> {
  const user = await requireUser();

  const stored = await db.query.users.findFirst({ where: eq(users.id, user.id) });

  if (stored?.totpEnabledAt && stored.totpSecretEncrypted) {
    const code = String(formData?.get("code") ?? "");
    const check = verifyCodeWithCounter(
      decryptSecret(stored.totpSecretEncrypted),
      code,
      stored.totpLastUsedCounter,
    );
    if (!check.ok) {
      return { error: "Enter a current code from your authenticator to re-enrol." };
    }
  }

  const secret = generateSecret();

  // Staged separately; the live secret stays untouched until a code confirms
  // the new one, so an abandoned setup cannot lock anyone out.
  await db
    .update(users)
    .set({ totpSecretPendingEncrypted: encryptSecret(secret) })
    .where(eq(users.id, user.id));

  const uri = keyUri(secret, user.email);

  return {
    // Shown as text so a desktop authenticator can be set up without a camera.
    secretBase32: encodeSecret(secret),
    qrDataUri: await QRCode.toDataURL(uri, { margin: 1, width: 220 }),
  };
}

export async function confirmTotpSetup(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  const stored = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!stored?.totpSecretPendingEncrypted) return { error: "Start the setup again" };

  const code = String(formData.get("code") ?? "");
  const result = verifyCodeWithCounter(
    decryptSecret(stored.totpSecretPendingEncrypted),
    code,
    null, // a freshly generated secret has no spent counters
  );

  if (!result.ok) {
    return { error: "That code is not valid. Check your authenticator app." };
  }

  // Promote pending → live only now that a code has round-tripped.
  await db
    .update(users)
    .set({
      totpSecretEncrypted: stored.totpSecretPendingEncrypted,
      totpSecretPendingEncrypted: null,
      totpEnabledAt: new Date(),
      totpLastUsedCounter: result.counter,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { success: "Two-factor authentication is on" };
}

export async function disableTotp(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  const stored = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!stored?.totpSecretEncrypted || !stored.totpEnabledAt) {
    return { error: "Two-factor is not enabled" };
  }

  // Require a current code to turn it off, so someone who walks up to an
  // unlocked laptop cannot quietly remove the second factor.
  const code = String(formData.get("code") ?? "");
  const result = verifyCodeWithCounter(
    decryptSecret(stored.totpSecretEncrypted),
    code,
    stored.totpLastUsedCounter,
  );

  if (!result.ok) return { error: "That code is not valid" };

  await db
    .update(users)
    .set({
      totpSecretEncrypted: null,
      totpSecretPendingEncrypted: null,
      totpEnabledAt: null,
      totpLastUsedCounter: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { success: "Two-factor authentication is off" };
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/** Revoke every session, then re-establish this one so the user stays put. */
export async function signOutEverywhere(): Promise<SettingsState> {
  const user = await requireUser();

  await destroyAllSessions(user.id);
  await createSession(user.id);

  revalidatePath("/settings");
  return { success: "Signed out on all other devices" };
}
