import { AlertTriangle, Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getLinkedItems } from "@/lib/queries";
import { listInvites } from "@/lib/auth/invites";
import { relativeTime } from "@/lib/utils";
import { env } from "@/lib/env";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader title="Settings" />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Linked institutions"
            description="Unlinking revokes access at Plaid and deletes the accounts and transactions it synced."
            action={<PlaidLinkButton label="Link bank" size="sm" />}
          />

          {items.length === 0 ? (
            <EmptyState
              icon={<Link2 className="size-7" />}
              title="Nothing linked yet"
              description="Connect a bank to start syncing balances and transactions."
            />
          ) : (
            <div className="border-t">
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.875rem] font-medium">
                        {item.institutionName ?? "Linked bank"}
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-[var(--ink-secondary)]">
                        {item.accountCount} account{item.accountCount === 1 ? "" : "s"} · synced{" "}
                        {relativeTime(item.lastSyncedAt)}
                      </p>
                    </div>

                    {item.errorCode ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning)]/15 px-2.5 py-1 text-[0.75rem] font-medium">
                        <AlertTriangle className="size-3 text-[var(--warning)]" aria-hidden="true" />
                        Needs attention
                      </span>
                    ) : null}

                    <div className="flex items-center gap-2">
                      {item.errorCode ? (
                        <PlaidLinkButton itemId={item.id} label="Reconnect" variant="secondary" size="sm" />
                      ) : null}
                      <UnlinkButton itemId={item.id} name={item.institutionName ?? "this bank"} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Security"
            description="Protects every account linked to this dashboard."
          />
          <CardBody>
            <SecuritySection enabled={Boolean(user.totpEnabledAt)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="People"
            description="Sign-up is invite-only. Only these addresses can create an account."
          />
          <CardBody>
            <InvitesSection invites={invites} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Account" />
          <CardBody className="space-y-2 text-[0.875rem]">
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
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Environment" description="How this instance is configured." />
          <CardBody className="space-y-2 text-[0.875rem]">
            <Row
              label="Plaid environment"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{
                      background:
                        env.PLAID_ENV === "production" ? "var(--color-good)" : "var(--color-series-3)",
                    }}
                  />
                  {env.PLAID_ENV === "production" ? "Production — real accounts" : "Sandbox — test data"}
                </span>
              }
            />
            <Row label="Webhooks" value={env.APP_URL.startsWith("https://") ? "Enabled" : "Disabled (needs HTTPS)"} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-[var(--ink-secondary)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
