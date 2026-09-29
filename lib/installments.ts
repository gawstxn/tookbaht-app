import { monthKey, shiftMonth, stepCycle } from "./format";
import { periodFor } from "./period";
import { monthTransactions, summarize } from "./selectors";
import type { Subscription, Transaction } from "./types";

export interface OutlookMonth {
  month: string;
  /** Installments still to be charged in the month. */
  amount: number;
  plans: number;
}

export interface InstallmentOutlook {
  months: OutlookMonth[];
  /** Every installment still to come, beyond the months shown too. */
  remaining: number;
  /** When the last one is charged. */
  lastDue: string | null;
  planCount: number;
  /** Average monthly income of the last 3 full months, to show the share already committed. */
  income: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Money already promised to installment plans (pay-later purchases, ผ่อน 0%)
 * over the coming `count` months, starting with the current one: only
 * charges after today, so this month shows what's still to come.
 */
export function installmentOutlook(subs: Subscription[], txs: Transaction[], today: string, count = 6, thb: (s: Subscription) => number = (s) => s.amount): InstallmentOutlook | null {
  const plans = subs.filter((s) => s.installments && s.entryType === "out" && !s.paused);
  const thisMonth = monthKey(today);
  const months = Array.from({ length: count }, (_, i) => ({ month: shiftMonth(thisMonth, i), amount: 0, plans: 0 }));
  let remaining = 0;
  let lastDue: string | null = null;
  let planCount = 0;
  for (const s of plans) {
    let counted = false;
    for (let i = 0; i < s.installments!; i++) {
      const due = stepCycle(s.startDate, s.cycle, i);
      if (due <= today) continue;
      const amount = thb(s);
      remaining += amount;
      counted = true;
      if (!lastDue || due > lastDue) lastDue = due;
      const m = months.find((x) => x.month === monthKey(due));
      if (m) {
        m.amount += amount;
        m.plans++;
      }
    }
    if (counted) planCount++;
  }
  if (!planCount) return null;
  const past = [1, 2, 3].map((i) => summarize(monthTransactions(txs, periodFor(shiftMonth(thisMonth, -i), 1))).income).filter((v) => v > 0);
  return {
    months: months.map((m) => ({ ...m, amount: round2(m.amount) })),
    remaining: round2(remaining),
    lastDue,
    planCount,
    income: past.length ? round2(past.reduce((a, b) => a + b, 0) / past.length) : 0,
  };
}
