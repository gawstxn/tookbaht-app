import { daysInMonth, shiftMonth } from "./format";
import { periodFor, shiftPeriod, type Period } from "./period";
import { MASK, isMasked } from "./money";
import { monthTransactions, spendByCategory, summarize } from "./selectors";
import type { Account, Transaction } from "./types";

export interface MonthTotals {
  month: string;
  income: number;
  expense: number;
}

/** Income and expense for the `count` months ending with `lastMonth`, oldest first. Transfers are left out. */
export function monthlySeries(txs: Transaction[], lastMonth: Period, count = 6): MonthTotals[] {
  return Array.from({ length: count }, (_, i) => {
    const p = shiftPeriod(lastMonth, i - count + 1);
    const { income, expense } = summarize(monthTransactions(txs, p));
    return { month: p.key, income, expense };
  });
}

/** A month's spending by category, largest first, with each one's share of the total. */
export function categoryBreakdown(txs: Transaction[], month: Period): { key: string; amount: number; share: number }[] {
  const byCat = spendByCategory(monthTransactions(txs, month));
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  return Object.entries(byCat)
    .map(([key, amount]) => ({ key, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Spending per day of a calendar month ("YYYY-MM-DD" → amount), repayments taken off like summarize(). */
export function dailySpend(txs: Transaction[], month: string): Record<string, number> {
  const byDay = new Map<string, Transaction[]>();
  for (const t of monthTransactions(txs, periodFor(month, 1))) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
  const out: Record<string, number> = {};
  for (const [day, list] of byDay) {
    const spent = summarize(list).expense;
    if (spent > 0) out[day] = spent;
  }
  return out;
}

/** Last day of a "YYYY-MM" month. */
const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(daysInMonth(y, m - 1)).padStart(2, "0")}`;
};

/**
 * What the user is worth at the end of each of the last `count` months: money
 * in bank, savings and cash accounts, less what cards and pay-later owe.
 */
export function netWorthSeries(accounts: Account[], txs: Transaction[], lastMonth: string, count = 12): { month: string; value: number }[] {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const kindOf = new Map(accounts.map((a) => [a.id, a]));
  const flow = new Map<string, number>(accounts.map((a) => [a.id, 0]));
  const add = (id: string | undefined, v: number) => {
    if (id && flow.has(id)) flow.set(id, flow.get(id)! + v);
  };
  const out: { month: string; value: number }[] = [];
  let i = 0;
  for (let k = count - 1; k >= 0; k--) {
    const month = shiftMonth(lastMonth, -k);
    const end = monthEnd(month);
    for (; i < sorted.length && sorted[i].date <= end; i++) {
      const t = sorted[i];
      if (t.type === "in") add(t.accountId, t.amount);
      else if (t.type === "out") add(t.accountId, -t.amount);
      else {
        add(t.fromId, -t.amount);
        add(t.toId, t.amount);
      }
    }
    let value = 0;
    for (const [id, f] of flow) {
      const a = kindOf.get(id)!;
      // A card's opening balance is its limit, so what it owes is −flow.
      value += a.kind === "credit" ? f : a.openingBalance + f;
    }
    out.push({ month, value });
  }
  return out;
}

export interface YearSummary {
  year: number;
  income: number;
  expense: number;
  net: number;
  /** Share of income kept; null without income. */
  savingRate: number | null;
  months: MonthTotals[];
  topCategories: { key: string; amount: number }[];
  bestMonth: MonthTotals | null;
  worstMonth: MonthTotals | null;
  /** Subscriptions and other automatic charges. */
  automatic: number;
  entries: number;
  biggest: Transaction | null;
}

/** Years that have entries, newest first. */
export function yearsWithData(txs: Transaction[]): number[] {
  return [...new Set(txs.map((t) => Number(t.date.slice(0, 4))))].sort((a, b) => b - a);
}

/** A calendar year in numbers. */
export function yearSummary(txs: Transaction[], year: number): YearSummary {
  const inYear = txs.filter((t) => t.date.startsWith(`${year}-`));
  const { income, expense } = summarize(inYear);
  const months = monthlySeries(txs, periodFor(`${year}-12`, 1), 12);
  const active = months.filter((m) => m.income || m.expense);
  const byNet = [...active].sort((a, b) => b.income - b.expense - (a.income - a.expense));
  const cats = spendByCategory(inYear);
  const outs = inYear.filter((t) => t.type === "out");
  return {
    year,
    income,
    expense,
    net: income - expense,
    savingRate: income > 0 ? (income - expense) / income : null,
    months,
    topCategories: Object.entries(cats).map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5),
    bestMonth: byNet[0] ?? null,
    worstMonth: byNet.length > 1 ? byNet[byNet.length - 1] : null,
    automatic: outs.filter((t) => t.subscriptionId).reduce((a, t) => a + t.amount, 0),
    entries: inYear.length,
    biggest: outs.reduce<Transaction | null>((b, t) => (!b || t.amount > b.amount ? t : b), null),
  };
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

/** Short axis label: 45000 → "45K", 1250000 → "1.3M"; "•••" while amounts are hidden (0 stays). */
export function compact(n: number): string {
  if (isMasked() && n !== 0) return MASK;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}
