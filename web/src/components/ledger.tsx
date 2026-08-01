import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The Ledger's shared parts.
 *
 * There are deliberately no cards here. Sections are separated by the weight of
 * a rule — 1.5px opens a movement, a hairline separates rows inside it — which
 * is how a ledger page is set and why the layout reads as continuous rather
 * than as a grid of panels.
 */

/** Fine paper grain over the whole viewport. */
export function Grain() {
  return (
    <svg className="grain" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <filter id="paper-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-grain)" opacity="0.5" />
    </svg>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("label", className)}>{children}</div>;
}

/**
 * A movement — one section of the page.
 *
 * The label sits out in the left margin as a marginal note, set right-aligned
 * against the text block so the two columns share a spine. That margin is the
 * page's asymmetry: the text block never centres, and the labels read as
 * apparatus rather than as headings competing with the figures.
 *
 * `offset` is retained for the rare section that wants extra air above it.
 * Amounts inside stay right-aligned in a strict column, so they remain
 * comparable.
 */
export function Movement({
  label,
  action,
  offset = 0,
  first = false,
  children,
}: {
  label: string;
  action?: ReactNode;
  offset?: 0 | 1 | 2;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "movement grid gap-x-[clamp(24px,3vw,56px)] gap-y-4 md:grid-cols-[minmax(120px,15%)_1fr]",
        first ? "pt-[clamp(44px,7vh,84px)]" : "mt-[clamp(56px,9vh,112px)]",
        offset === 1 && "mt-[clamp(64px,11vh,140px)]",
        offset === 2 && "mt-[clamp(72px,13vh,160px)]",
      )}
    >
      <div className="md:pt-1 md:text-right">
        <Label>{label}</Label>
      </div>

      <div className="min-w-0">
        {action ? <div className="mb-6 flex items-baseline gap-4">{action}</div> : null}
        {children}
      </div>
    </section>
  );
}

/** A ruled row: name and detail on the left, figure right-aligned. */
export function Line({
  name,
  meta,
  amount,
  under,
  tone,
  first = false,
}: {
  name: ReactNode;
  meta?: ReactNode;
  amount: string;
  under?: string;
  tone?: "gain" | "loss";
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] items-baseline gap-x-8 border-b py-5",
        // Once there is room, the detail moves out of the stack and into its own
        // column. Across a wide page a two-column row leaves the eye to jump an
        // empty gulf from name to figure; a middle column gives it a step.
        "lg:grid-cols-[minmax(0,1fr)_minmax(0,28%)_minmax(150px,15%)]",
        first && "border-t-[1.5px]",
      )}
      style={{ borderColor: "var(--rule)", borderTopColor: first ? "var(--heavy)" : undefined }}
    >
      <div className="min-w-0">
        <div className="text-[18px]">{name}</div>
        {meta ? <div className="meta mt-1.5 lg:hidden">{meta}</div> : null}
      </div>

      <div className="meta hidden min-w-0 truncate lg:block">{meta}</div>

      <div className="text-right whitespace-nowrap">
        <div
          className="tabular text-[18px]"
          style={{ color: tone === "gain" ? "var(--gain)" : tone === "loss" ? "var(--loss)" : undefined }}
        >
          {amount}
        </div>
        {under ? (
          <div
            className="mt-1.5 font-[family-name:var(--font-sans)] text-[10px] tracking-[0.16em] uppercase"
            style={{ color: "var(--faint)" }}
          >
            {under}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="border-t-[1.5px] py-16 text-center" style={{ borderColor: "var(--heavy)" }}>
      <p className="text-[18px]">{title}</p>
      {hint ? (
        <p className="mx-auto mt-2 max-w-sm text-[14px]" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-7 flex justify-center">{action}</div> : null}
    </div>
  );
}
