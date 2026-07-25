"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Opens Plaid Link and completes the connection.
 *
 * Credentials are entered inside Plaid's own iframe and never touch this app —
 * we only ever receive a short-lived public token, which the server immediately
 * trades for an access token it stores encrypted.
 *
 * Pass `itemId` to run Link in update mode and repair a broken connection.
 */
export function PlaidLinkButton({
  itemId,
  label = "Link an account",
  variant = "primary",
  size = "md",
  onLinked,
}: {
  itemId?: string;
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  onLinked?: () => void;
}) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = itemId ? `/api/plaid/link-token?itemId=${itemId}` : "/api/plaid/link-token";
      const response = await fetch(url, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not start");
        return;
      }
      setLinkToken(data.linkToken);
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setLoading(true);
      try {
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
          setError(data.error ?? "Could not link account");
          return;
        }

        onLinked?.();
        router.refresh();
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    [router, onLinked],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  // Link tokens are minted on demand, so opening waits for the token to arrive
  // rather than pre-fetching one on every page load that may never be used.
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <Button variant={variant} size={size} onClick={fetchLinkToken} loading={loading}>
        {!loading && !itemId ? <Plus className="size-4" aria-hidden="true" /> : null}
        {label}
      </Button>
      {error ? (
        <span role="alert" className="text-[0.75rem] text-[var(--negative)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
