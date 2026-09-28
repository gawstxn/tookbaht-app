import { monthKey, shiftMonth } from "./format";
import { monthTransactions, summarize } from "./selectors";
import type { Account, Goals, Transaction } from "./types";

/** The offer shows on the first days of a month only. */
export const LEFTOVER_DAYS = 7;
/** Less than this isn't worth a prompt. */
export const LEFTOVER_MIN = 100;

export interface LeftoverOffer {
  /** The month that ended ("YYYY-MM"). */
  month: string;
  /** Whole baht left over. */
  amount: number;
  /** True when it's the budget that was left over (else income minus spending). */
  fromBudget: boolean;
}

/**
 * What last month left over, to offer putting into a savings goal early in
 * the new month: the unspent overall budget, but never more than income
 * minus spending when income was logged (a budget "left" on money never
 * earned isn't there to save). Without a budget, income minus spending.
 * Null once the user saved or skipped that month (`handled`), after the
 * first LEFTOVER_DAYS days, without an open goal, or when little is left.
 */
export function leftoverOffer(goals: Goals, txs: Transaction[], today: string, handled: string | undefined, hasOpenGoal: boolean): LeftoverOffer | null {
  if (!hasOpenGoal || Number(today.slice(8, 10)) > LEFTOVER_DAYS) return null;
  const month = shiftMonth(monthKey(today), -1);
  if (handled && handled >= month) return null;
  const list = monthTransactions(txs, month);
  if (!list.length) return null;
  const { income, expense } = summarize(list);
  const fromBudget = goals.expenseBudget > 0;
  let left = fromBudget ? goals.expenseBudget - expense : income - expense;
  if (fromBudget && income > 0) left = Math.min(left, income - expense);
  const amount = Math.floor(left);
  return amount >= LEFTOVER_MIN ? { month, amount, fromBudget } : null;
}

/**
 * Where to move the money from: the account last month's income went into
 * most, else the first bank or cash account; never credit or the goal's own account.
 */
export function leftoverSource(accounts: Account[], txs: Transaction[], month: string, goalAccountId?: string | null): string | null {
  const ok = accounts.filter((a) => a.kind !== "credit" && a.id !== goalAccountId);
  const byIncome = new Map<string, number>();
  for (const t of monthTransactions(txs, month)) {
    if (t.type === "in" && t.accountId) byIncome.set(t.accountId, (byIncome.get(t.accountId) ?? 0) + t.amount);
  }
  const top = [...ok].sort((a, b) => (byIncome.get(b.id) ?? 0) - (byIncome.get(a.id) ?? 0))[0];
  if (top && byIncome.get(top.id)) return top.id;
  return (ok.find((a) => a.kind === "bank") ?? ok.find((a) => a.kind === "cash") ?? ok[0])?.id ?? null;
}
