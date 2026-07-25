/**
 * Fixed-point money arithmetic over BigInt.
 *
 * Postgres `numeric` arrives as a string. Parsing it into a JS number to do math
 * reintroduces exactly the floating-point error the numeric column exists to
 * prevent (0.1 + 0.2 === 0.30000000000000004). So amounts stay strings at rest
 * and become scaled BigInts for arithmetic.
 *
 * Everything is scaled to 4 decimal places to match numeric(19,4). Four rather
 * than two because FX rates and per-unit investment prices need the headroom.
 */

const SCALE = 4n;
const SCALE_FACTOR = 10n ** SCALE;

/** Parse a decimal string into a scaled BigInt. "12.34" -> 123400n */
export function parse(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;

  const str = typeof value === "number" ? value.toFixed(Number(SCALE)) : value.trim();

  const negative = str.startsWith("-");
  const unsigned = negative ? str.slice(1) : str;

  const [whole = "0", fraction = ""] = unsigned.split(".");

  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error(`Not a valid decimal amount: ${value}`);
  }

  // Pad or truncate the fraction to exactly SCALE digits.
  const paddedFraction = fraction.padEnd(Number(SCALE), "0").slice(0, Number(SCALE));

  const scaled = BigInt(whole || "0") * SCALE_FACTOR + BigInt(paddedFraction || "0");
  return negative ? -scaled : scaled;
}

/** Render a scaled BigInt back to a string suitable for a numeric column. */
export function format(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const whole = abs / SCALE_FACTOR;
  const fraction = (abs % SCALE_FACTOR).toString().padStart(Number(SCALE), "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function add(...values: (string | null | undefined)[]): string {
  return format(values.reduce<bigint>((sum, v) => sum + parse(v), 0n));
}

export function subtract(a: string, b: string): string {
  return format(parse(a) - parse(b));
}

export function negate(value: string): string {
  return format(-parse(value));
}

export function isNegative(value: string): boolean {
  return parse(value) < 0n;
}

export function abs(value: string): string {
  const v = parse(value);
  return format(v < 0n ? -v : v);
}

export function compare(a: string, b: string): number {
  const diff = parse(a) - parse(b);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

/**
 * Convert to a JS number. Only for display and charting, where a sub-cent
 * rounding error is invisible — never for arithmetic that gets persisted.
 */
export function toNumber(value: string | null | undefined): number {
  return Number(parse(value)) / Number(SCALE_FACTOR);
}

/** Currency formatting for the UI. */
export function display(
  value: string | null | undefined,
  options: { currency?: string; signed?: boolean; compact?: boolean } = {},
): string {
  const { currency = "USD", signed = false, compact = false } = options;
  const n = toNumber(value);

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(Math.abs(n));

  if (signed && n !== 0) return `${n > 0 ? "+" : "−"}${formatted}`;
  return n < 0 ? `−${formatted}` : formatted;
}
