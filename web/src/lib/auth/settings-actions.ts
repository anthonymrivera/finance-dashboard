"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import QRCode from "qrcode";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser, destroyAllSessions, createSession } from "./session";
import { createInvite, revokeInvite } from "./invites";
import {
  decryptSecret,
  encryptSecret,
  encodeSecret,
  generateSecret,
  keyUri,
  verifyCode,
} from "./totp";

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

export type TotpSetup = { secretBase32: string; qrDataUri: string };

/**
 * Generate a secret and store it, but leave `totpEnabledAt` null.
 *
 * Enrolment is only complete once a code round-trips. Setting the flag here
 * would lock out anyone who closed the page mid-setup.
 */
export async function beginTotpSetup(): Promise<TotpSetup> {
  const user = await requireUser();

  const secret = generateSecret();

  await db
    .update(users)
    .set({ totpSecretEncrypted: encryptSecret(secret), totpEnabledAt: null })
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
  if (!stored?.totpSecretEncrypted) return { error: "Start the setup again" };

  const code = String(formData.get("code") ?? "");
  if (!verifyCode(decryptSecret(stored.totpSecretEncrypted), code)) {
    return { error: "That code is not valid. Check your authenticator app." };
  }

  await db.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, user.id));

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
  if (!verifyCode(decryptSecret(stored.totpSecretEncrypted), code)) {
    return { error: "That code is not valid" };
  }

  await db
    .update(users)
    .set({ totpSecretEncrypted: null, totpEnabledAt: null })
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
