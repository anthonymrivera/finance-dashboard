"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";

/**
 * Masthead navigation.
 *
 * A single horizontal row sitting opposite the brand, the way a masthead sets
 * its sections. Sign-out is folded in at the end behind a separator rather than
 * given its own block — it is the least-used control on the page and does not
 * deserve standing furniture.
 *
 * Underlines wipe in from the left rather than fading (`.wipe` in globals.css).
 */
const LINKS = [
  { href: "/dashboard", label: "Position" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Entries" },
  { href: "/settings", label: "Settings" },
];

export function LedgerNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-wrap items-baseline gap-x-6 gap-y-2.5">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="wipe font-[family-name:var(--font-sans)] text-[12.5px] tracking-[0.05em] transition-colors"
            style={{ color: active ? "var(--ink)" : "var(--muted)" }}
          >
            {label}
          </Link>
        );
      })}

      {/* Hidden once the row wraps, where it would orphan at a line end. */}
      <span
        aria-hidden="true"
        className="hidden h-3 w-px sm:block"
        style={{ background: "var(--rule)" }}
      />

      <form action={logout}>
        <button
          type="submit"
          title={email}
          className="wipe font-[family-name:var(--font-sans)] text-[12.5px] tracking-[0.05em] transition-colors"
          style={{ color: "var(--faint)" }}
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
