"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { ShieldCheck, ShieldOff } from "lucide-react";
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
  signOutEverywhere,
  type SettingsState,
  type TotpSetup,
} from "@/lib/auth/settings-actions";
import { Button } from "@/components/ui/button";

const CODE_FIELD =
  "h-10 w-40 rounded-lg border bg-[var(--surface-raised)] px-3 text-center text-lg tracking-[0.3em] tabular outline-none focus-visible:border-[var(--accent)]";

function Submit({ label, variant = "primary" }: { label: string; variant?: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" loading={pending}>
      {label}
    </Button>
  );
}

type ActiveSetup = { secretBase32: string; qrDataUri: string };

export function SecuritySection({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<ActiveSetup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [confirmState, confirmAction] = useActionState<SettingsState, FormData>(
    confirmTotpSetup,
    undefined,
  );
  const [disableState, disableAction] = useActionState<SettingsState, FormData>(
    disableTotp,
    undefined,
  );

  async function start(formData?: FormData) {
    setStarting(true);
    setSetupError(null);
    try {
      const result: TotpSetup = await beginTotpSetup(formData);
      if ("error" in result) setSetupError(result.error);
      else setSetup(result);
    } finally {
      setStarting(false);
    }
  }

  if (enabled && !confirmState?.success) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-[0.875rem]">
          <ShieldCheck className="size-4 text-[var(--positive)]" aria-hidden="true" />
          Two-factor authentication is on.
        </p>

        <form action={disableAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="disable-code" className="mb-1.5 block text-[0.8125rem] font-medium">
              Enter a current code to turn it off
            </label>
            <input
              id="disable-code"
              name="code"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="000000"
              className={CODE_FIELD}
            />
          </div>
          <Submit label="Turn off" variant="danger" />
        </form>

        <Feedback state={disableState} />

        {/* Re-enrolling a new device also needs a current code — the server
            enforces it, so the form collects one rather than failing after. */}
        <form action={start} className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div>
            <label htmlFor="reenrol-code" className="mb-1.5 block text-[0.8125rem] font-medium">
              Moving to a new phone? Enter a current code
            </label>
            <input
              id="reenrol-code"
              name="code"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="000000"
              className={CODE_FIELD}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" loading={starting}>
            Set up a new device
          </Button>
        </form>

        {setupError ? (
          <p role="alert" className="text-[0.8125rem] text-[var(--negative)]">
            {setupError}
          </p>
        ) : null}

        <SignOutEverywhere />
      </div>
    );
  }

  if (confirmState?.success) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-[0.875rem]">
          <ShieldCheck className="size-4 text-[var(--positive)]" aria-hidden="true" />
          {confirmState.success}. You will be asked for a code next time you sign in.
        </p>
        <SignOutEverywhere />
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-[0.875rem] text-[var(--ink-secondary)]">
          <ShieldOff className="size-4" aria-hidden="true" />
          Two-factor authentication is off.
        </p>
        <p className="max-w-prose text-[0.8125rem] text-[var(--ink-secondary)]">
          A password alone is thin protection for a view of every account you own. With
          two-factor on, someone who learns your password still cannot get in.
        </p>
        <Button variant="primary" size="sm" onClick={() => start()} loading={starting}>
          Set up two-factor
        </Button>
        {setupError ? (
          <p role="alert" className="text-[0.8125rem] text-[var(--negative)]">
            {setupError}
          </p>
        ) : null}
        <SignOutEverywhere />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[0.875rem]">
        Scan this with Google Authenticator, 1Password, Authy, or any TOTP app.
      </p>

      <div className="flex flex-wrap items-start gap-5">
        <Image
          src={setup.qrDataUri}
          alt="Two-factor setup QR code"
          width={180}
          height={180}
          unoptimized
          className="rounded-xl border bg-white p-2"
        />

        <div className="min-w-0">
          <p className="text-[0.8125rem] text-[var(--ink-secondary)]">
            Or enter this key by hand:
          </p>
          <code className="mt-1.5 block break-all rounded-lg border bg-[var(--page)] px-3 py-2 text-[0.8125rem]">
            {setup.secretBase32}
          </code>
        </div>
      </div>

      <form action={confirmAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="confirm-code" className="mb-1.5 block text-[0.8125rem] font-medium">
            Enter the code it shows
          </label>
          <input
            id="confirm-code"
            name="code"
            inputMode="numeric"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className={CODE_FIELD}
          />
        </div>
        <Submit label="Confirm" />
      </form>

      <Feedback state={confirmState} />
    </div>
  );
}

function SignOutEverywhere() {
  const [state, action] = useActionState<SettingsState, FormData>(
    async () => signOutEverywhere(),
    undefined,
  );

  return (
    <form action={action} className="border-t pt-4">
      <p className="mb-2 text-[0.8125rem] text-[var(--ink-secondary)]">
        Signs out every other browser and device. This one stays signed in.
      </p>
      <Submit label="Sign out everywhere else" variant="danger" />
      <Feedback state={state} />
    </form>
  );
}

function Feedback({ state }: { state: SettingsState }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-[0.8125rem] text-[var(--negative)]">
        {state.error}
      </p>
    );
  }
  if (state?.success) {
    return (
      <p role="status" className="mt-2 text-[0.8125rem] text-[var(--positive)]">
        {state.success}
      </p>
    );
  }
  return null;
}
