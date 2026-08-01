"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { clearLinkToken, readLinkToken } from "@/lib/plaid/link-storage";

/**
 * Where an OAuth institution returns after its consent screen.
 *
 * Plaid requires resuming the *same* Link session: the link token the session
 * started with (parked in localStorage by the link button) plus the exact URL
 * the bank redirected to, which carries the OAuth state. Link then finishes in
 * place and hands over a public token like any other link.
 *
 * Deliberately outside the (app) layout: this page exists for half a second of
 * plumbing mid-redirect, and should not run the dashboard's queries to render
 * a masthead nobody will read. The exchange endpoint enforces the session.
 */
export default function PlaidOauthPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // localStorage exists only in the browser, so this must run post-mount — a
  // lazy useState initializer would also run during the SSR pass and hydrate
  // mismatched. That makes set-state-in-effect the correct tool here, not the
  // smell the lint rule assumes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = readLinkToken();
    if (stored) {
      setToken(stored);
      setReceivedRedirectUri(window.location.href);
    } else {
      setFailed("This link session has expired or was opened in a different browser.");
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      clearLinkToken();
      const response = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          institutionId: metadata.institution?.institution_id,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setFailed(data.error ?? "Could not finish linking the account.");
        return;
      }
      router.replace("/accounts");
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token,
    receivedRedirectUri: receivedRedirectUri ?? undefined,
    onSuccess,
    onExit: () => {
      clearLinkToken();
      router.replace("/accounts");
    },
  });

  useEffect(() => {
    if (token && receivedRedirectUri && ready) open();
  }, [token, receivedRedirectUri, ready, open]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div
          className="mb-7 border-b-[1.5px] pb-3 text-[19px] tracking-[0.01em]"
          style={{ borderColor: "var(--heavy)" }}
        >
          AMR Finance
        </div>

        {failed ? (
          <>
            <p className="text-[17px]">{failed}</p>
            <p className="mt-2 text-[15px]" style={{ color: "var(--muted)" }}>
              Start the link again from the accounts page.
            </p>
            <Link href="/accounts" className="wipe mt-6 inline-block text-[15px]">
              Back to accounts
            </Link>
          </>
        ) : (
          <>
            <p className="text-[17px]">Finishing the connection…</p>
            <p className="mt-2 text-[15px]" style={{ color: "var(--muted)" }}>
              Completing the hand-off from your bank.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
