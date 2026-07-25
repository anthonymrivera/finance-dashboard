"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

export type ActionState = { error?: string; success?: string } | undefined;

const manualAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["depository", "credit", "loan", "investment", "other"]),
  subtype: z.string().max(50).optional(),
  balance: z
    .string()
    .regex(/^-?\d+(\.\d{1,4})?$/, "Enter a valid amount, e.g. 1250.00"),
});

/**
 * Manual accounts cover what Plaid cannot reach — cash, a car, property, a
 * pension that will not link. They participate in net worth exactly like synced
 * accounts; the only difference is that nothing updates them automatically.
 */
export async function createManualAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = manualAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    subtype: formData.get("subtype") || undefined,
    balance: formData.get("balance"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, type, subtype, balance } = parsed.data;

  await db.insert(accounts).values({
    userId: user.id,
    name,
    type,
    subtype: subtype ?? null,
    currentBalance: balance,
    isLiability: type === "credit" || type === "loan",
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return { success: `Added ${name}` };
}

export async function updateManualAccountBalance(
  accountId: string,
  balance: string,
): Promise<ActionState> {
  const user = await requireUser();

  if (!/^-?\d+(\.\d{1,4})?$/.test(balance)) {
    return { error: "Enter a valid amount" };
  }

  const updated = await db
    .update(accounts)
    .set({ currentBalance: balance, updatedAt: new Date() })
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, user.id),
        // Synced balances are the bank's to report. Allowing an edit here would
        // silently produce a number the next sync overwrites.
        isNull(accounts.plaidItemId),
      ),
    )
    .returning({ id: accounts.id });

  if (updated.length === 0) return { error: "Account not found, or it is bank-synced" };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: "Balance updated" };
}

export async function deleteManualAccount(accountId: string): Promise<ActionState> {
  const user = await requireUser();

  const deleted = await db
    .delete(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, user.id),
        isNull(accounts.plaidItemId),
      ),
    )
    .returning({ id: accounts.id });

  if (deleted.length === 0) {
    return { error: "Account not found, or it is bank-synced — unlink the institution instead" };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: "Account removed" };
}

/** Hide an account from totals without losing its transaction history. */
export async function toggleAccountHidden(accountId: string): Promise<ActionState> {
  const user = await requireUser();

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.userId, user.id)),
  });

  if (!account) return { error: "Account not found" };

  await db
    .update(accounts)
    .set({ isHidden: !account.isHidden, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: account.isHidden ? "Account shown" : "Account hidden" };
}

/** Recategorize a transaction. Stored separately so a re-sync never clobbers it. */
export async function setTransactionCategory(
  transactionId: string,
  category: string | null,
): Promise<ActionState> {
  const user = await requireUser();

  const updated = await db
    .update(transactions)
    .set({ userCategory: category, updatedAt: new Date() })
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, user.id)))
    .returning({ id: transactions.id });

  if (updated.length === 0) return { error: "Transaction not found" };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: "Category updated" };
}
