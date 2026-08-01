"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

/**
 * Buttons speak the ledger's machine-voice: square, uppercase sans, tracked —
 * the register of a stamp, not a pill. Primary is solid ink on paper (inverting
 * naturally in dark mode); secondary is an inked border; ghost is bare text.
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--ink)] text-[var(--paper)] hover:opacity-85",
  secondary:
    "border border-[var(--heavy)] text-[var(--ink)] hover:bg-[color-mix(in_oklab,var(--wash)_60%,transparent)]",
  ghost: "text-[var(--muted)] hover:text-[var(--ink)]",
  danger: "border border-[var(--loss)] text-[var(--loss)] hover:bg-[var(--loss)]/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[10.5px] gap-1.5",
  md: "h-10 px-5 text-[11px] gap-2",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  loading = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      // aria-busy tells assistive tech the control is working; the spinner alone
      // is a purely visual signal.
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-[family-name:var(--font-sans)] font-semibold tracking-[0.14em] uppercase",
        "transition-[background-color,color,opacity] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
