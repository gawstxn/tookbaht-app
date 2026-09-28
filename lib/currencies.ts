import { MASK, isMasked } from "./money";

/**
 * Currencies an entry can be logged in abroad (a trip in Japan: yen). Only
 * ones the ECB publishes against THB, so there's always a day's rate; the
 * database allows the same list (exchange_rates, transactions.orig_currency).
 */
export const FX_CURRENCIES = ["JPY", "KRW", "CNY", "HKD", "SGD", "MYR", "IDR", "PHP", "INR", "USD", "EUR", "GBP", "AUD", "NZD", "CHF", "CAD"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

/** Symbol and whether the currency uses decimals (yen, won and rupiah don't). */
const META: Record<FxCurrency, { symbol: string; decimals: boolean }> = {
  JPY: { symbol: "¥", decimals: false },
  KRW: { symbol: "₩", decimals: false },
  CNY: { symbol: "CN¥", decimals: true },
  HKD: { symbol: "HK$", decimals: true },
  SGD: { symbol: "S$", decimals: true },
  MYR: { symbol: "RM", decimals: true },
  IDR: { symbol: "Rp", decimals: false },
  PHP: { symbol: "₱", decimals: true },
  INR: { symbol: "₹", decimals: true },
  USD: { symbol: "US$", decimals: true },
  EUR: { symbol: "€", decimals: true },
  GBP: { symbol: "£", decimals: true },
  AUD: { symbol: "A$", decimals: true },
  NZD: { symbol: "NZ$", decimals: true },
  CHF: { symbol: "CHF ", decimals: true },
  CAD: { symbol: "C$", decimals: true },
};

export const isFxCurrency = (c: unknown): c is FxCurrency => typeof c === "string" && (FX_CURRENCIES as readonly string[]).includes(c);

export const currencySymbol = (c: FxCurrency) => META[c].symbol;

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "¥3,000", "₩45,000", "€12.50"; "¥•••" while amounts are hidden. */
export function formatForeign(amount: number, c: FxCurrency): string {
  if (isMasked()) return META[c].symbol + MASK;
  return META[c].symbol + (META[c].decimals ? cents : whole).format(amount);
}

/** Baht for a foreign amount: the day's rate plus the card's foreign-transaction fee, to the satang. */
export function fxToBaht(amount: number, rate: number, feePct = 0): number {
  return Math.round(amount * rate * (1 + feePct / 100) * 100) / 100;
}
