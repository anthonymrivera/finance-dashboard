"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { inviteUser, revokeUserInvite, type SettingsState } from "@/lib/auth/settings-actions";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";

export type InviteRow = {
  id: string;
  email: string;
  createdAt: Date;
  acceptedAt: Date | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" loading={pending}>
      Send invite
    </Button>
  );
}

export function InvitesSection({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();
  const [state, formAction] = useActionState<SettingsState, FormData>(inviteUser, undefined);
  const [isPending, startTransition] = useTransition();

  function revoke(email: string) {
    startTransition(async () => {
      await revokeUserInvite(email);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="invite-email" className="mb-1.5 block text-[0.8125rem] font-medium">
            Email address
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="friend@example.com"
            className="h-10 w-full rounded-lg border bg-[var(--surface-raised)] px-3 text-sm outline-none focus-visible:border-[var(--accent)]"
          />
        </div>
        <Submit />
      </form>

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

      {invites.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem]">{invite.email}</p>
                <p className="mt-0.5 text-[0.75rem] text-[var(--ink-secondary)]">
                  {invite.acceptedAt
                    ? `Joined ${relativeTime(invite.acceptedAt)}`
                    : `Invited ${relativeTime(invite.createdAt)} · not yet used`}
                </p>
              </div>

              {/* Once accepted there is nothing to revoke — the account exists,
                  and removing the invite row would not remove their access. */}
              {invite.acceptedAt ? (
                <span className="rounded-full bg-[var(--gridline)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--ink-secondary)]">
                  Active
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke(invite.email)}
                  disabled={isPending}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.8125rem] text-[var(--ink-secondary)]">
          Nobody invited yet. Only invited email addresses can create an account.
        </p>
      )}
    </div>
  );
}
