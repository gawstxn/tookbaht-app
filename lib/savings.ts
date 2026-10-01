import { monthKey } from "./format"
import type { ISODate, SavingsGoal } from "./types"

export interface SavingsProgress {
  saved: number
  /** 0–1 (capped). */
  pct: number
  left: number
  done: boolean
  /** Months to go including this one; 0 once the deadline has passed; null without a deadline. */
  months: number | null
  /** What to put aside each month to make the deadline; null without a deadline or when done. */
  perMonth: number | null
  overdue: boolean
}

/** Calendar months from today's month to the deadline's, counting both (Sep → Mar = 7). */
export function monthsUntil(deadline: ISODate, today: ISODate): number {
  const [ty, tm] = monthKey(today).split("-").map(Number)
  const [dy, dm] = monthKey(deadline).split("-").map(Number)
  if (deadline < today) return 0
  return (dy - ty) * 12 + (dm - tm) + 1
}

/**
 * Where a goal stands. `accountBalance` is the linked account's balance
 * (ignored for manual goals).
 */
export function savingsProgress(
  goal: Pick<SavingsGoal, "target" | "saved" | "deadline" | "accountId">,
  today: ISODate,
  accountBalance?: number,
): SavingsProgress {
  const saved = Math.max(0, goal.accountId ? (accountBalance ?? 0) : goal.saved)
  const left = Math.max(0, goal.target - saved)
  const done = left === 0
  const months = goal.deadline ? monthsUntil(goal.deadline, today) : null
  const overdue = !done && months === 0
  const perMonth = done || months === null ? null : Math.ceil(left / Math.max(1, months))
  return { saved, pct: Math.min(1, saved / goal.target), left, done, months, perMonth, overdue }
}

/** Last day of a "YYYY-MM" month: a deadline "by March" means by 31 March. */
export function endOfMonth(key: string): ISODate {
  const [y, m] = key.split("-").map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${key}-${String(last).padStart(2, "0")}`
}
