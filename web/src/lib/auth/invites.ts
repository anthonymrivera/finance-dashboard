import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { allowlistActive, isEmailAllowed } from "@/lib/env";

/**
 * Registration allowlist.
 *
 * The app is publicly reachable but sign-up is not open: an address must be
 * invited before it can register by password or by Google. Without this, anyone
 * who found the URL could create an account and start linking banks — which
 * costs money per Item and makes you custodian of their financial data.
 */

/** The very first account bootstraps the instance and needs no invite. */
export async function isFirstRun(): Promise<boolean> {
  const [row] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(users);
  return (row?.count ?? 0) === 0;
}

export async function canRegister(email: string): Promise<boolean> {
  // The env allowlist outranks everything, including first-run bootstrap: if it
  // is set, an address outside it can never create an account.
  if (!isEmailAllowed(email)) return false;

  /**
   * Being named in ALLOWED_EMAILS is itself the authorization.
   *
   * The two mechanisms are alternatives, not a pair to satisfy in sequence.
   * ALLOWED_EMAILS is deployment configuration naming exact addresses — strictly
   * stronger evidence of intent than an invite row, which any signed-in user can
   * create. Demanding both meant an operator could add an address to the
   * allowlist, watch sign-in fail with "not invited", and have nothing in the
   * message to indicate a second step existed.
   *
   * Invites remain the mechanism when no allowlist is configured.
   */
  if (allowlistActive) return true;

  if (await isFirstRun()) return true;

  const invite = await db.query.invites.findFirst({
    where: eq(invites.email, email.toLowerCase().trim()),
  });

  return Boolean(invite);
}

/** Mark the invite consumed. Kept for the audit trail rather than deleted. */
export async function consumeInvite(email: string): Promise<void> {
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.email, email.toLowerCase().trim()));
}

export async function createInvite(email: string, invitedByUserId: string) {
  const normalized = email.toLowerCase().trim();

  const [invite] = await db
    .insert(invites)
    .values({ email: normalized, invitedByUserId })
    // Re-inviting an existing address is a no-op rather than an error — the
    // intent ("this person may register") is already satisfied.
    .onConflictDoNothing({ target: invites.email })
    .returning();

  return invite ?? null;
}

export async function revokeInvite(email: string): Promise<void> {
  await db.delete(invites).where(eq(invites.email, email.toLowerCase().trim()));
}

export async function listInvites() {
  return db
    .select({
      id: invites.id,
      email: invites.email,
      createdAt: invites.createdAt,
      acceptedAt: invites.acceptedAt,
    })
    .from(invites)
    .orderBy(invites.createdAt);
}
