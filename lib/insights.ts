import { shiftMonth } from "./format";
import { monthTransactions, spendByCategory, summarize } from "./selectors";
import type { Transaction } from "./types";

export interface MonthTotals {
  month: string;
  income: number;
  expense: number;
}

/** Income and expense for the `count` months ending with `lastMonth`, oldest first. Transfers are left out. */
export function monthlySeries(txs: Transaction[], lastMonth: string, count = 6): MonthTotals[] {
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(lastMonth, i - count + 1);
    const { income, expense } = summarize(monthTransactions(txs, month));
    return { month, income, expense };
  });
}

/** A month's spending by category, largest first, with each one's share of the total. */
export function categoryBreakdown(txs: Transaction[], month: string): { key: string; amount: number; share: number }[] {
  const byCat = spendByCategory(monthTransactions(txs, month));
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  return Object.entries(byCat)
    .map(([key, amount]) => ({ key, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Clean axis ticks from 0 past `max`: steps of 1, 2 or 5 × a power of ten, about `target` of them. */
export function niceTicks(max: number, target = 3): number[] {
  if (max <= 0) return [0];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Short axis label: 45000 → "45K", 1250000 → "1.3M". */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}
