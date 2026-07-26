"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { login, register, type AuthState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const ERRORS: Record<string, string> = {
  oauth_state: "That sign-in link expired. Try again.",
  oauth_failed: "Google sign-in did not complete. Try again.",
  email_unverified: "Your Google email address is not verified.",
  not_invited: "That email has not been invited to this dashboard.",
  account_disabled: "That account has been deactivated.",
  google_unavailable: "Google sign-in is not configured on this instance.",
  link_requires_signin:
    "That email already has a password account with two-factor on. Sign in with your password first, then link Google from Settings.",
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} className="w-full">
      {pending ? "Working…" : label}
    </Button>
  );
}

export function AuthForm({
  firstRun,
  googleEnabled,
  errorCode,
}: {
  firstRun: boolean;
  googleEnabled: boolean;
  errorCode?: string;
}) {
  const [mode, setMode] = useState<"login" | "register">(firstRun ? "register" : "login");
  const action = mode === "login" ? login : register;

  const [state, formAction] = useActionState<AuthState, FormData>(action, undefined);

  const isRegister = mode === "register";
  const message = state?.error ?? (errorCode ? (ERRORS[errorCode] ?? "Sign-in failed.") : null);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <div
          aria-hidden="true"
          className="mb-5 flex size-11 items-center justify-center rounded-xl bg-[var(--accent)] text-lg font-semibold text-white"
        >
          $
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstRun ? "Create your account" : isRegister ? "Create an account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">
          {firstRun
            ? "This is the first account on this instance — it will be yours."
            : isRegister
              ? "Sign-up is invite-only."
              : "Sign in to see every account in one place."}
        </p>
      </div>

      {googleEnabled ? (
        <>
          {/* A plain link, not a form post: this begins a redirect, and a button
              inside the form below would submit the credentials form instead. */}
          <a
            href="/api/auth/google"
            className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border bg-[var(--surface-raised)] text-sm font-medium transition-colors hover:bg-[var(--page)]"
          >
            <GoogleMark />
            Continue with Google
          </a>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--hairline)]" />
            <span className="text-[0.75rem] text-[var(--ink-muted)]">or</span>
            <span className="h-px flex-1 bg-[var(--hairline)]" />
          </div>
        </>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[0.8125rem] font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-10 w-full rounded-lg border bg-[var(--surface)] px-3 text-sm outline-none placeholder:text-[var(--ink-muted)] focus-visible:border-[var(--accent)]"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-[0.8125rem] font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 12 : undefined}
            className="h-10 w-full rounded-lg border bg-[var(--surface)] px-3 text-sm outline-none placeholder:text-[var(--ink-muted)] focus-visible:border-[var(--accent)]"
            placeholder={isRegister ? "At least 12 characters" : "••••••••••••"}
          />
          {isRegister ? (
            <p className="mt-1.5 text-[0.75rem] text-[var(--ink-secondary)]">
              12 characters minimum. Length matters more than symbols — a passphrase works well.
            </p>
          ) : null}
        </div>

        {message ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--negative)]/30 bg-[var(--negative)]/10 px-3 py-2.5 text-[0.8125rem] text-[var(--negative)]"
          >
            {message}
          </p>
        ) : null}

        <SubmitButton label={isRegister ? "Create account" : "Sign in"} />
      </form>

      {!firstRun ? (
        <p className="mt-6 text-center text-[0.8125rem] text-[var(--ink-secondary)]">
          {isRegister ? "Already have an account?" : "Have an invite?"}{" "}
          <button
            type="button"
            onClick={() => setMode(isRegister ? "login" : "register")}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            {isRegister ? "Sign in" : "Create an account"}
          </button>
        </p>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
