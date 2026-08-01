import { AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getLinkedItems } from "@/lib/queries";
import { listInvites } from "@/lib/auth/invites";
import { relativeTime } from "@/lib/utils";
import { env } from "@/lib/env";
import { Movement, Empty } from "@/components/ledger";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { UnlinkButton } from "./unlink-button";
import { SecuritySection } from "./security-section";
import { InvitesSection } from "./invites-section";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [items, invites] = await Promise.all([getLinkedItems(user.id), listInvites()]);

  return (
    <>
      <Movement
        label="Linked institutions"
        first
        action={<PlaidLinkButton label="Link bank" size="sm" variant="secondary" />}
      >
        <p className="mb-8 max-w-[52ch] text-[17px]" style={{ color: "var(--muted)" }}>
          Unlinking revokes access at Plaid and deletes the accounts and transactions it synced.
        </p>

        {items.length === 0 ? (
          <Empty
            title="Nothing linked yet"
            hint="Connect a bank to start syncing balances and transactions."
          />
        ) : (
          <div className="border-t-[1.5px]" style={{ borderColor: "var(--heavy)" }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-5"
                style={{ borderColor: "var(--rule)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[18px]">{item.institutionName ?? "Linked bank"}</div>
                  <div className="meta mt-1.5">
                    {item.accountCount} account{item.accountCount === 1 ? "" : "s"} · synced{" "}
                    {relativeTime(item.lastSyncedAt)}
                  </div>
                </div>

                {item.errorCode ? (
                  <span
                    className="inline-flex items-center gap-1.5 font-[family-name:var(--font-sans)] text-[11.5px]"
                    style={{ color: "var(--warn)" }}
                  >
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    Needs attention
                  </span>
                ) : null}

                <div className="flex items-center gap-3">
                  {item.errorCode ? (
                    <PlaidLinkButton itemId={item.id} label="Reconnect" variant="secondary" size="sm" />
                  ) : null}
                  <UnlinkButton itemId={item.id} name={item.institutionName ?? "this bank"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Movement>

      <Movement label="Security" offset={1}>
        <p className="mb-8 max-w-[52ch] text-[17px]" style={{ color: "var(--muted)" }}>
          Protects every account linked to this dashboard.
        </p>
        <div className="border-t-[1.5px] pt-7" style={{ borderColor: "var(--heavy)" }}>
          <SecuritySection enabled={Boolean(user.totpEnabledAt)} />
        </div>
      </Movement>

      <Movement label="People" offset={2}>
        <p className="mb-8 max-w-[52ch] text-[17px]" style={{ color: "var(--muted)" }}>
          Sign-up is invite-only. Only these addresses can create an account.
        </p>
        <div className="border-t-[1.5px] pt-7" style={{ borderColor: "var(--heavy)" }}>
          <InvitesSection invites={invites} />
        </div>
      </Movement>

      <Movement label="Account">
        <div className="border-t-[1.5px]" style={{ borderColor: "var(--heavy)" }}>
          <Row label="Email" value={user.email} />
          <Row
            label="Sign-in method"
            value={
              user.googleId && user.passwordHash
                ? "Google and password"
                : user.googleId
                  ? "Google"
                  : "Password"
            }
          />
          <Row label="Member since" value={new Date(user.createdAt).toLocaleDateString()} />
          <Row label="Last sign-in" value={relativeTime(user.lastLoginAt)} />
        </div>
      </Movement>

      <Movement label="Environment" offset={1}>
        <p className="mb-8 max-w-[52ch] text-[17px]" style={{ color: "var(--muted)" }}>
          How this instance is configured.
        </p>
        <div className="border-t-[1.5px]" style={{ borderColor: "var(--heavy)" }}>
          <Row
            label="Plaid environment"
            value={
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2"
                  style={{
                    background: env.PLAID_ENV === "production" ? "var(--gain)" : "var(--r3)",
                  }}
                />
                {env.PLAID_ENV === "production" ? "Production — real accounts" : "Sandbox — test data"}
              </span>
            }
          />
          <Row
            label="Webhooks"
            value={env.APP_URL.startsWith("https://") ? "Enabled" : "Disabled (needs HTTPS)"}
          />
        </div>
      </Movement>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-6 border-b py-4"
      style={{ borderColor: "var(--rule)" }}
    >
      <span className="label">{label}</span>
      <span className="text-right text-[17px]">{value}</span>
    </div>
  );
}
