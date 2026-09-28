import { daysInMonth, dueDatesUntil, monthKey } from "./format";
import { monthTransactions, summarize } from "./selectors";
import type { Subscription, Transaction } from "./types";

export interface MonthForecast {
  /** Spent so far this month (repayments taken off, like summarize()). */
  spent: number;
  /** Bills and installments still due after today, this month. */
  scheduled: number;
  /** Everyday spending per day so far (entries not logged from a schedule). */
  perDay: number;
  /** Days after today until the month ends. */
  daysLeft: number;
  /** spent + scheduled + perDay × daysLeft. */
  projected: number;
  /** Overall monthly budget, 0 when none is set. */
  budget: number;
  /** Spent by the end of each day so far (index 0 = day 1, last = today). */
  actual: number[];
  /** Projected running total for each day after today. */
  ahead: number[];
}

/** Forecasts show from this day of the month; before that one day's spending says too little. */
export const FORECAST_FROM_DAY = 3;

/**
 * Where this month's spending is heading if the user keeps going as they
 * have: what's spent, plus the bills known to come, plus the everyday daily
 * average for the days left. Current month only; null before
 * FORECAST_FROM_DAY or when nothing has been spent yet.
 */
export function monthForecast(
  txs: Transaction[],
  subs: Subscription[],
  budget: number,
  month: string,
  today: string,
  thb: (s: Subscription) => number = (s) => s.amount,
): MonthForecast | null {
  if (monthKey(today) !== month) return null;
  const day = Number(today.slice(8, 10));
  if (day < FORECAST_FROM_DAY) return null;
  const [y, m] = month.split("-").map(Number);
  const days = daysInMonth(y, m - 1);
  const end = `${month}-${String(days).padStart(2, "0")}`;

  const inMonth = monthTransactions(txs, month).filter((t) => t.date <= today);
  const spent = summarize(inMonth).expense;
  if (spent <= 0) return null;
  const perDay = summarize(inMonth.filter((t) => !t.subscriptionId)).expense / day;

  // Known charges by day of month, after today.
  const dueOn = new Map<number, number>();
  for (const s of subs) {
    if (s.paused || s.entryType !== "out") continue;
    dueDatesUntil(s.startDate, s.cycle, end).forEach((d, i) => {
      if (d <= today || (s.installments && i >= s.installments)) return;
      const n = Number(d.slice(8, 10));
      dueOn.set(n, (dueOn.get(n) ?? 0) + thb(s));
    });
  }
  const scheduled = [...dueOn.values()].reduce((a, v) => a + v, 0);

  const byDay = new Map<number, Transaction[]>();
  for (const t of inMonth) {
    const n = Number(t.date.slice(8, 10));
    byDay.set(n, [...(byDay.get(n) ?? []), t]);
  }
  const actual: number[] = [];
  let run: Transaction[] = [];
  for (let d = 1; d <= day; d++) {
    run = run.concat(byDay.get(d) ?? []);
    actual.push(summarize(run).expense);
  }

  const ahead: number[] = [];
  let total = spent;
  for (let d = day + 1; d <= days; d++) {
    total += perDay + (dueOn.get(d) ?? 0);
    ahead.push(total);
  }

  const daysLeft = days - day;
  return { spent, scheduled, perDay, daysLeft, projected: spent + scheduled + perDay * daysLeft, budget: Math.max(0, budget), actual, ahead };
}
