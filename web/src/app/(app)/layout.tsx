import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isDemoEmail } from "@/lib/env";
import { getNetWorth } from "@/lib/queries";
import * as money from "@/lib/money";
import { Grain } from "@/components/ledger";
import { StandingFigure } from "@/components/standing-figure";
import { LedgerNav } from "@/components/nav";

/**
 * The page.
 *
 * One measured column, set like a broadsheet: a masthead rule across the top,
 * the standing figure as the lede, then the movements. Section labels sit out in
 * the left margin as marginal notes rather than as headings in the text block —
 * that margin is what gives the page its asymmetry, without splitting the screen
 * into two competing halves.
 *
 * The figure scrolls away with everything else. Pinning it cost a third of the
 * viewport and made the page feel like a frame around a scroller.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isDemo = isDemoEmail(user.email);
  const net = await getNetWorth(user.id);

  return (
    <>
      <Grain />

      <div className="mx-auto min-h-dvh w-full max-w-[1680px] px-[clamp(20px,4vw,72px)] pb-[clamp(80px,14vh,160px)]">
        <header className="pt-[clamp(24px,4vh,44px)]">
          <div
            className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4 border-b pb-4"
            style={{ borderColor: "var(--rule)" }}
          >
            <div className="flex items-baseline gap-3">
              <Link href="/dashboard" className="text-[19px] tracking-[0.01em]">
                AMR Finance
              </Link>
              {isDemo ? (
                <span
                  title="Sandbox data — not real accounts"
                  className="font-[family-name:var(--font-sans)] text-[9px] font-semibold tracking-[0.18em] uppercase"
                  style={{ color: "var(--muted)" }}
                >
                  Demo
                </span>
              ) : null}
            </div>

            <LedgerNav email={user.email} />
          </div>

          {/* The lede. */}
          <div
            className="grid gap-x-[clamp(24px,3vw,56px)] gap-y-3 border-b py-[clamp(28px,5vh,52px)] md:grid-cols-[minmax(120px,15%)_1fr]"
            style={{ borderColor: "var(--heavy)" }}
          >
            <div className="label md:pt-[0.7em] md:text-right">Net position</div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-12 gap-y-3">
              <StandingFigure value={net.netWorth} />
              <p className="meta tabular">
                {money.display(net.assets)} held · {money.display(net.liabilities)} owed
              </p>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
