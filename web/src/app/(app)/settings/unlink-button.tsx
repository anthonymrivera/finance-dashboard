"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Unlinking is destructive and irreversible — it revokes the token at Plaid and
 * cascades the synced accounts and transactions away — so it takes a deliberate
 * second click rather than firing on the first.
 */
export function UnlinkButton({ itemId, name }: { itemId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlink() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/plaid/item/${itemId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Could not unlink");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Unlink
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.75rem] text-[var(--ink-secondary)]">Remove {name}?</span>
      <Button variant="danger" size="sm" onClick={unlink} loading={busy}>
        Yes, unlink
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
        Cancel
      </Button>
      {error ? (
        <span role="alert" className="text-[0.75rem] text-[var(--negative)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
