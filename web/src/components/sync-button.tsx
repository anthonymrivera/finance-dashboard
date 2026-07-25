"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSync() {
    setSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Sync failed");
        return;
      }

      const changed = data.added + data.modified + data.removed;
      setMessage(changed > 0 ? `${changed} update${changed === 1 ? "" : "s"}` : "Up to date");

      // The server action revalidated the cache; refresh pulls the new render.
      startTransition(() => router.refresh());
    } catch {
      setMessage("Could not reach the server");
    } finally {
      setSyncing(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  const busy = syncing || isPending;

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span role="status" className="text-[0.75rem] text-[var(--ink-secondary)]">
          {message}
        </span>
      ) : null}
      <button
        onClick={handleSync}
        disabled={busy}
        aria-busy={busy || undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 text-[0.8125rem] font-medium",
          "bg-[var(--surface-raised)] transition-colors hover:bg-[var(--page)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          compact ? "h-8" : "h-9",
        )}
      >
        <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden="true" />
        {compact ? null : busy ? "Syncing" : "Refresh"}
      </button>
    </div>
  );
}
