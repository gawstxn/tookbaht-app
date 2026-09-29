import type { Period } from "./period";
import { monthTransactions, summarize } from "./selectors";
import { categoryBreakdown } from "./insights";
import { heldBack } from "./wishes";
import type { Transaction, Wish } from "./types";

export interface MonthCard {
  month: string;
  income: number;
  expense: number;
  /** Income minus spending (negative when over). */
  net: number;
  /** Share of income kept (net ÷ income); null without income. */
  keptPct: number | null;
  /** Share of income spent; null without income. */
  spentPct: number | null;
  /** The biggest spending category and its share of spending. */
  top: { key: string; amount: number; share: number } | null;
  /** Wishlist items decided against this month. */
  heldBack: { amount: number; count: number };
}

/** A month in numbers for the shareable summary image; null for a month with nothing logged. */
export function monthCard(txs: Transaction[], wishes: Wish[], period: Period): MonthCard | null {
  const month = period.key;
  const list = monthTransactions(txs, period);
  if (!list.length) return null;
  const { income, expense, net } = summarize(list);
  return {
    month,
    income,
    expense,
    net,
    keptPct: income > 0 ? net / income : null,
    spentPct: income > 0 ? expense / income : null,
    top: categoryBreakdown(txs, period)[0] ?? null,
    heldBack: heldBack(wishes, period),
  };
}

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "฿12,340" for the image, which always shows real numbers (it's only made on request). */
export const cardBaht = (n: number) => "฿" + nf.format(Math.round(Math.abs(n)));

/** "23%", rounded, never "-0%". */
export const cardPct = (p: number) => `${Math.round(Math.abs(p) * 100)}%`;
