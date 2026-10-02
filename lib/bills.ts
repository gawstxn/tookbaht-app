import { addDays, diffDays, dueDatesUntil } from "./format"
import type { Cycle, Subscription, Transaction } from "./types"

/*
 * Bills whose amount changes every time (water, electricity, a phone bill).
 * They come due on a schedule like any recurring entry, but nothing is logged
 * until the user enters what they actually paid. Until then the round stays
 * open: Home asks for it, and so does the notification list.
 * The day-before push mirrors this in pending_reminders() (supabase/migrations).
 */

/** How many days before the due date a bill starts asking. */
export const BILL_LEAD_DAYS = 3

/** A payment counts for the due date it is nearest to: from half a cycle before it. */
const HALF_CYCLE: Record<Cycle, number> = { week: 3, month: 15, year: 182 }

export interface OpenBill {
  sub: Subscription
  due: string
  /** Days until it's due; negative once it's late. */
  days: number
}

/** One round of a bill; stored in settings.billSkipped when the user skips it. */
export const billRoundId = (sub: Pick<Subscription, "id">, due: string) => `${sub.id}:${due}`

/** Payments logged for a bill, newest first. */
export function billPayments(sub: Pick<Subscription, "id">, txs: Transaction[]): Transaction[] {
  return txs
    .filter((t) => t.subscriptionId === sub.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}

/**
 * The round waiting to be paid: the latest due date up to BILL_LEAD_DAYS
 * ahead, unless a payment was logged for it or the user skipped it. An unpaid
 * round stays open (late) until the next one comes up.
 */
export function openBill(
  sub: Subscription,
  txs: Transaction[],
  today: string,
  skipped: string[] = [],
): OpenBill | null {
  if (!sub.variable || sub.paused) return null
  const due = dueDatesUntil(sub.startDate, sub.cycle, addDays(today, BILL_LEAD_DAYS)).pop()
  if (!due || skipped.includes(billRoundId(sub, due))) return null
  const from = addDays(due, -HALF_CYCLE[sub.cycle])
  if (txs.some((t) => t.subscriptionId === sub.id && t.date > from)) return null
  return { sub, due, days: diffDays(due, today) }
}

/** Every bill waiting to be paid, the most overdue first. */
export function openBills(subs: Subscription[], txs: Transaction[], today: string, skipped: string[] = []): OpenBill[] {
  return subs.flatMap((s) => openBill(s, txs, today, skipped) ?? []).sort((a, b) => a.due.localeCompare(b.due))
}

/** What the bill usually comes to: the average of its last `n` payments (null before the first one). */
export function billAverage(sub: Pick<Subscription, "id">, txs: Transaction[], n = 6): number | null {
  const last = billPayments(sub, txs).slice(0, n)
  if (!last.length) return null
  return Math.round((last.reduce((a, t) => a + t.amount, 0) / last.length) * 100) / 100
}
