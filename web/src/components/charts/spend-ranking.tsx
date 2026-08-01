import type { CategorySpend } from "@/lib/queries";
import * as money from "@/lib/money";
import { humanizeCategory } from "@/lib/utils";

/**
 * Where it went, ranked.
 *
 * Sequential, not categorical — the data is ordered by magnitude, so a single
 * hue stepping light to dark encodes it correctly. An eight-hue categorical set
 * was the wrong encoding *and* failed validation: muted earthy tones read as
 * grey and adjacent pairs were indistinguishable. This ramp is validated
 * against both surfaces — monotone lightness, >=0.06 step gaps, single hue, and
 * a light end that clears its own paper.
 *
 * Every row carries its figure, so nothing depends on reading the colour.
 */
/**
 * Indexed by emphasis, not by lightness. `--e1` is the most prominent step for
 * whichever surface is live — the darkest on paper, the lightest in the dark
 * theme — so rank 1 always reads as the heaviest mark. Indexing the raw
 * `--r*` ramp painted the largest category near-invisibly in dark mode.
 */
const RAMP = ["var(--e1)", "var(--e2)", "var(--e3)", "var(--e4)", "var(--e5)", "var(--e6)", "var(--e7)", "var(--e8)"];

const MAX_ROWS = 8;

export function SpendRanking({ data }: { data: CategorySpend[] }) {
  const top = data.slice(0, MAX_ROWS);
  const rest = data.slice(MAX_ROWS);

  const rows = [...top];
  if (rest.length > 0) {
    rows.push({
      category: "OTHER",
      total: money.add(...rest.map((r) => r.total)),
      count: rest.reduce((sum, r) => sum + r.count, 0),
    });
  }

  const largest = rows.reduce((m, r) => (money.compare(r.total, m) > 0 ? r.total : m), "0");
  const all = money.add(...rows.map((r) => r.total));

  return (
    <div className="border-t-[1.5px]" style={{ borderColor: "var(--heavy)" }}>
      {rows.map((row, i) => {
        const width =
          money.toNumber(largest) > 0
            ? (money.toNumber(row.total) / money.toNumber(largest)) * 100
            : 0;
        const share =
          money.toNumber(all) > 0
            ? Math.round((money.toNumber(row.total) / money.toNumber(all)) * 100)
            : 0;

        return (
          <div key={row.category} className="border-b py-4" style={{ borderColor: "var(--rule)" }}>
            <div className="mb-2.5 flex items-baseline justify-between gap-4">
              <span className="truncate text-[17px]">{humanizeCategory(row.category)}</span>
              <span className="tabular shrink-0 text-[16px]">
                {money.display(row.total)}
                <span className="meta ml-2">{share}%</span>
              </span>
            </div>
            <div
              role="img"
              aria-label={`${humanizeCategory(row.category)}: ${money.display(row.total)}, ${share} percent of spending`}
              className="h-[4px] w-full"
              style={{ background: "var(--rule)" }}
            >
              <div
                className="h-full transition-[width] duration-700"
                style={{
                  width: `${Math.max(width, 1.5)}%`,
                  background: row.category === "OTHER" ? "var(--faint)" : RAMP[Math.min(i, RAMP.length - 1)],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
