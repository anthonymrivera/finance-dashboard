import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";
import { Nav } from "@/components/nav";
import { SyncButton } from "@/components/sync-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Every page in this group is behind the same check, enforced once here
  // rather than repeated (and eventually forgotten) in each page.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-5 md:flex">
        <div className="mb-7 flex items-center gap-2.5 px-3">
          <div
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-semibold text-white"
          >
            $
          </div>
          <span className="text-[0.9375rem] font-semibold tracking-tight">Finance</span>
        </div>

        <Nav />

        <div className="mt-auto border-t pt-4">
          <p className="truncate px-3 text-[0.75rem] text-[var(--ink-secondary)]" title={user.email}>
            {user.email}
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1.5 w-full rounded-lg px-3 py-1.5 text-left text-[0.8125rem] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink-primary)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-[var(--page)]/85 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[0.8125rem] font-semibold text-white"
            >
              $
            </div>
            <span className="text-sm font-semibold">Finance</span>
          </div>
          <SyncButton compact />
        </header>

        {/* pb-24 clears the fixed mobile nav bar below. */}
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">{children}</main>

        {/* Mobile bottom nav */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-[var(--page)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <Nav orientation="horizontal" />
        </div>
      </div>
    </div>
  );
}
