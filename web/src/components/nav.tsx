"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Landmark, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-0.5" : "flex items-center justify-around",
      )}
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            // aria-current is the semantic signal; the styling below is the
            // visual one. Screen readers get the state without relying on color.
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
              orientation === "vertical" ? "px-3 py-2" : "flex-1 flex-col gap-1 py-2 text-[0.6875rem]",
              active
                ? "bg-[var(--surface-raised)] text-[var(--ink-primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--ink-secondary)] hover:bg-[var(--surface)] hover:text-[var(--ink-primary)]",
            )}
          >
            <Icon className={orientation === "vertical" ? "size-4" : "size-5"} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
