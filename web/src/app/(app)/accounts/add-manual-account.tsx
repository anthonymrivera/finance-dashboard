"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createManualAccount, type ActionState } from "@/lib/accounts/actions";
import { Button } from "@/components/ui/button";

const TYPES = [
  { value: "depository", label: "Cash / bank" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other asset" },
  { value: "credit", label: "Credit card" },
  { value: "loan", label: "Loan" },
];

const FIELD =
  "h-10 w-full rounded-lg border bg-[var(--surface-raised)] px-3 text-sm outline-none focus-visible:border-[var(--accent)]";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending}>
      Add account
    </Button>
  );
}

export function AddManualAccount() {
  const [state, formAction] = useActionState<ActionState, FormData>(createManualAccount, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="ma-name" className="mb-1.5 block text-[0.8125rem] font-medium">
            Name
          </label>
          <input id="ma-name" name="name" required maxLength={100} placeholder="e.g. Emergency cash" className={FIELD} />
        </div>

        <div>
          <label htmlFor="ma-type" className="mb-1.5 block text-[0.8125rem] font-medium">
            Type
          </label>
          <select id="ma-type" name="type" defaultValue="depository" className={FIELD}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ma-balance" className="mb-1.5 block text-[0.8125rem] font-medium">
            Balance
          </label>
          <input
            id="ma-balance"
            name="balance"
            required
            // inputMode surfaces the numeric keypad on mobile; the pattern keeps
            // the value parseable as a decimal.
            inputMode="decimal"
            pattern="-?\d+(\.\d{1,4})?"
            placeholder="0.00"
            defaultValue=""
            className={`${FIELD} tabular`}
          />
        </div>
      </div>

      <p className="text-[0.75rem] text-[var(--ink-secondary)]">
        For credit cards and loans, enter the amount owed as a positive number — it is
        subtracted from net worth automatically.
      </p>

      {state?.error ? (
        <p role="alert" className="text-[0.8125rem] text-[var(--negative)]">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="text-[0.8125rem] text-[var(--positive)]">
          {state.success}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
