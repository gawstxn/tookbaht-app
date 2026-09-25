import { daysInMonth, diffDays, monthKey, monthlyEquivalent, nextDueDate } from "./format";
import { t } from "./i18n";
import type { Account, Subscription, Transaction } from "./types";

export function monthTransactions(txs: Transaction[], key: string) {
  return txs.filter((t) => monthKey(t.date) === key);
}

export function summarize(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  let moved = 0;
  for (const t of txs) {
    if (t.type === "in") income += t.amount;
    else if (t.type === "out") expense += t.amount;
    else moved += t.amount;
  }
  return { income, expense, moved, net: income - expense };
}

export function spendByCategory(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) if (t.type === "out" && t.category) out[t.category] = (out[t.category] ?? 0) + t.amount;
  return out;
}

export function accountBalance(a: Account, txs: Transaction[]): number {
  let bal = a.openingBalance;
  for (const t of txs) {
    if (t.type === "in" && t.accountId === a.id) bal += t.amount;
    if (t.type === "out" && t.accountId === a.id) bal -= t.amount;
    if (t.type === "move") {
      if (t.fromId === a.id) bal -= t.amount;
      if (t.toId === a.id) bal += t.amount;
    }
  }
  return bal;
}

export function accountSubtitle(a: Account, txs: Transaction[]): string {
  const bal = accountBalance(a, txs);
  const f = "฿" + Math.round(bal).toLocaleString("en-US");
  return t(a.kind === "credit" ? "balance.creditLeft" : "balance.left", { amount: f });
}

export interface UpcomingSub {
  sub: Subscription;
  due: string;
  days: number;
}
export function upcomingSubscriptions(subs: Subscription[], today: string): UpcomingSub[] {
  return subs
    .filter((s) => !s.paused)
    .map((s) => {
      const due = nextDueDate(s.startDate, s.cycle, today);
      return { sub: s, due, days: diffDays(due, today) };
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Totals in baht; `thb` converts a subscription's price (USD ones are estimates, 0 when no rate yet). */
export function subscriptionTotals(subs: Subscription[], today: string, thb: (s: Subscription) => number = (s) => s.amount) {
  const active = subs.filter((s) => !s.paused);
  const monthlyOnly = active.filter((s) => s.cycle !== "year");
  const yearly = active.filter((s) => s.cycle === "year");
  const perMonth = monthlyOnly.reduce((a, s) => a + monthlyEquivalent(thb(s), s.cycle), 0);
  const perYearExtra = yearly.reduce((a, s) => a + thb(s), 0);
  const next7 = upcomingSubscriptions(active, today)
    .filter((u) => u.days <= 7)
    .reduce((a, u) => a + thb(u.sub), 0);
  const byCategory: Record<string, number> = {};
  for (const s of monthlyOnly) byCategory[s.category] = (byCategory[s.category] ?? 0) + monthlyEquivalent(thb(s), s.cycle);
  return { perMonth, perYearExtra, next7, byCategory, count: active.length };
}

/** Fraction of the month elapsed (for "should have spent by now" markers). */
export function monthPace(key: string, today: string): number {
  const [y, m] = key.split("-").map(Number);
  const tk = monthKey(today);
  if (key < tk) return 1;
  if (key > tk) return 0;
  const day = Number(today.slice(8, 10));
  return day / daysInMonth(y, m - 1);
}
export function daysLeftInMonth(key: string, today: string): number {
  const [y, m] = key.split("-").map(Number);
  if (monthKey(today) !== key) return 0;
  return daysInMonth(y, m - 1) - Number(today.slice(8, 10));
}

export interface TxFilter {
  accountId?: string;
  category?: string;
  /** Inclusive date range; either end may be open. */
  from?: string;
  to?: string;
}

/** Transactions matching the list filters. A transfer matches an account on either side. */
export function filterTransactions(txs: Transaction[], f: TxFilter): Transaction[] {
  return txs.filter(
    (t) =>
      (!f.accountId || t.accountId === f.accountId || t.fromId === f.accountId || t.toId === f.accountId) &&
      (!f.category || t.category === f.category) &&
      (!f.from || t.date >= f.from) &&
      (!f.to || t.date <= f.to),
  );
}

/**
 * The entry that brings an account's balance in line with the real one
 * (for cards: the available credit). Null when it already matches.
 */
export function reconcileEntry(account: Account, txs: Transaction[], actual: number, date: string, title: string): Omit<Transaction, "id" | "createdAt"> | null {
  const diff = Math.round((actual - accountBalance(account, txs)) * 100) / 100;
  if (diff === 0) return null;
  return diff > 0
    ? { type: "in", amount: diff, date, title, category: "other-in", accountId: account.id }
    : { type: "out", amount: -diff, date, title, category: "other", accountId: account.id };
}
