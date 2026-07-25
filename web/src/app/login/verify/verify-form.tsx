"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { verifyTwoFactor, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} className="w-full">
      {pending ? "Verifying…" : "Verify"}
    </Button>
  );
}

export function VerifyForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(verifyTwoFactor, undefined);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <div
          aria-hidden="true"
          className="mb-5 flex size-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white"
        >
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Two-factor code</h1>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          Enter the six-digit code from your authenticator app.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="code" className="mb-1.5 block text-[0.8125rem] font-medium">
            Code
          </label>
          <input
            id="code"
            name="code"
            // one-time-code lets iOS and Android offer the code from the keyboard.
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className="h-12 w-full rounded-lg border bg-[var(--surface)] px-3 text-center text-xl tracking-[0.4em] tabular outline-none placeholder:text-[var(--ink-muted)] placeholder:tracking-[0.4em] focus-visible:border-[var(--accent)]"
          />
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative)]/10 px-3 py-2.5 text-[0.8125rem] text-[var(--negative)]"
          >
            {state.error}
          </p>
        ) : null}

        <Submit />
      </form>

      <p className="mt-6 text-center text-[0.8125rem] text-[var(--ink-secondary)]">
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
