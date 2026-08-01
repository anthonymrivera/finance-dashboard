import * as money from "@/lib/money";

/**
 * The lede figure.
 *
 * Editorial scale, not billboard scale — large enough to be the first thing read
 * and small enough that the page still looks like a page. Two typographic
 * decisions carry it:
 *
 *  - The sign hangs into the left margin (`text-indent`), so the *digits* align
 *    with the rules below rather than the punctuation. An optical correction,
 *    not a mathematical one.
 *  - Cents step down in size and colour. Nobody scanning their net worth reads
 *    to the cent, and demoting them lets the thousands land first.
 *
 * The serif's U+2212 is nearly em-dash length at display size and stops reading
 * as a sign, so the sign borrows the sans glyph.
 */
export function StandingFigure({ value }: { value: string }) {
  const negative = money.isNegative(value);
  const formatted = money.display(money.abs(value));
  const whole = formatted.replace(/\.\d+$/, "");
  const cents = formatted.match(/\.(\d+)$/)?.[1] ?? "00";

  return (
    <div
      className="tabular text-[clamp(38px,4.6vw,58px)] leading-[0.92] tracking-[-0.03em]"
      style={{ textIndent: negative ? "-0.05em" : undefined }}
    >
      {negative ? (
        <span className="font-[family-name:var(--font-sans)] font-extralight">−</span>
      ) : null}
      {whole}
      <span className="text-[0.36em]" style={{ color: "var(--muted)" }}>
        .{cents}
      </span>
    </div>
  );
}
