import { daysInMonth, diffDays, dueDatesUntil, monthKey, monthlyEquivalent, stepCycle } from "./format";
import { t } from "./i18n";
import type { Account, Subscription, Transaction } from "./types";

export function monthTransactions(txs: Transaction[], key: string) {
  return txs.filter((t) => monthKey(t.date) === key);
}

/** Money friends paid back ("ได้เงินคืน"): it lowers what the user spent rather than counting as income. */
export const REPAY_CATEGORY = "repay";

/**
 * Month totals. A repayment is taken off spending (the bill was logged in
 * full, but only the user's share was really spent), so it doesn't inflate
 * income or the income goal. Account balances still count it as money in.
 */
export function summarize(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  let moved = 0;
  for (const t of txs) {
    if (t.type === "in" && t.category === REPAY_CATEGORY) expense -= t.amount;
    else if (t.type === "in") income += t.amount;
    else if (t.type === "out") expense += t.amount;
    else moved += t.amount;
  }
  expense = Math.max(0, expense);
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

type Schedule = Pick<Subscription, "startDate" | "cycle" | "installments">;

/** The next charge on or after `from` and its number (1 = first), or null once an installment plan is paid off. */
export function nextCharge(s: Schedule, from: string): { due: string; n: number } | null {
  let i = 0;
  let due = s.startDate;
  while (due < from && i < 2000) {
    i++;
    due = stepCycle(s.startDate, s.cycle, i);
  }
  if (s.installments && i >= s.installments) return null;
  return { due, n: i + 1 };
}

/** Charges that have fallen due by `today`, capped at the plan's length. */
export function chargesSoFar(s: Schedule, today: string): number {
  const n = dueDatesUntil(s.startDate, s.cycle, today).length;
  return s.installments ? Math.min(n, s.installments) : n;
}

export interface UpcomingSub {
  sub: Subscription;
  due: string;
  days: number;
  /** Which charge this is (installment number for plans). */
  n: number;
}
/** Active entries by next charge; finished installment plans drop out. */
export function upcomingSubscriptions(subs: Subscription[], today: string): UpcomingSub[] {
  return subs
    .filter((s) => !s.paused)
    .flatMap((s) => {
      const next = nextCharge(s, today);
      return next ? [{ sub: s, due: next.due, days: diffDays(next.due, today), n: next.n }] : [];
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Services (Netflix, Spotify…) as opposed to salary, rent, transfers and installments. */
export const isService = (s: Pick<Subscription, "kind">) => s.kind !== "recurring";

/** Totals in baht; `thb` converts a subscription's price (USD ones are estimates, 0 when no rate yet). */
export function subscriptionTotals(subs: Subscription[], today: string, thb: (s: Subscription) => number = (s) => s.amount) {
  const active = subs.filter((s) => !s.paused && isService(s));
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

/**
 * Cards and pay-later with a due day: the next payment date (today or later,
 * clamped to short months) and what to pay by then — spending not yet paid
 * back, plus installments on this account falling due up to that date.
 */
export function accountDue(a: Account, txs: Transaction[], today: string, subs: Subscription[] = []): { due: string; days: number; owed: number } | null {
  if (a.kind !== "credit" || !a.dueDay) return null;
  const [y, m, d] = today.split("-").map(Number);
  const inMonth = (year: number, month0: number) => {
    const day = Math.min(a.dueDay!, daysInMonth(year, month0));
    const dt = new Date(year, month0, day);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };
  let due = inMonth(y, m - 1);
  if (Number(due.slice(8)) < d) due = inMonth(m === 12 ? y + 1 : y, m % 12);
  const upcoming = subs
    .filter((s) => s.accountId === a.id && s.installments && s.entryType === "out" && s.autoLog && !s.paused)
    .reduce((sum, s) => sum + s.amount * (chargesSoFar(s, due) - chargesSoFar(s, today)), 0);
  const owed = Math.round((a.openingBalance - accountBalance(a, txs) + upcoming) * 100) / 100;
  return { due, days: diffDays(due, today), owed };
}

/**
 * What an installment plan still holds of the credit limit: its price (or,
 * without one, all its installments) shared evenly, less the installments
 * already charged. The limit drops by the price at purchase and comes back
 * as each installment is logged and paid.
 */
export function planReserved(s: Subscription, today: string): number {
  if (!s.installments || s.entryType !== "out") return 0;
  const left = s.installments - chargesSoFar(s, today);
  return ((s.principal ?? s.amount * s.installments) * left) / s.installments;
}

/** A card / pay-later account's limit, what's in use (spending + open plans) and what's left to spend. */
export function creditSummary(a: Account, txs: Transaction[], subs: Subscription[], today: string) {
  const reserved = subs.filter((s) => s.accountId === a.id && !s.paused).reduce((sum, s) => sum + planReserved(s, today), 0);
  const available = Math.round((accountBalance(a, txs) - reserved) * 100) / 100;
  return { limit: a.openingBalance, available, used: Math.round((a.openingBalance - available) * 100) / 100 };
}

/** Interest on a pay-later purchase and its flat monthly rate (% of the price per installment). */
export function planInterest(s: Pick<Subscription, "amount" | "installments" | "principal">): { total: number; monthlyPct: number } | null {
  if (!s.installments || !s.principal) return null;
  const total = Math.round((s.amount * s.installments - s.principal) * 100) / 100;
  return { total, monthlyPct: Math.round((total / s.principal / s.installments) * 10000) / 100 };
}

/**
 * Why an account can't be deleted, or null when it can: it's the last one
 * (the app needs at least one), or transactions / scheduled entries use it.
 * The database refuses these deletes too; this lets the UI explain instead.
 */
export function accountDeleteBlock(id: string, accounts: Account[], txs: Transaction[], subs: Subscription[]): { reason: "last" } | { reason: "used"; transactions: number; schedules: number } | null {
  if (accounts.length <= 1) return { reason: "last" };
  const transactions = txs.filter((t) => t.accountId === id || t.fromId === id || t.toId === id).length;
  const schedules = subs.filter((s) => s.accountId === id || s.toAccountId === id).length;
  return transactions || schedules ? { reason: "used", transactions, schedules } : null;
}
