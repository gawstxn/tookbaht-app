import { reconcileEntry } from "./selectors"
import type { Account, Transaction } from "./types"

/** How many days either side of a month's end the "check your balances" reminder shows. */
export const CHECK_WINDOW_DAYS = 3

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/**
 * The month ("YYYY-MM") to check balances for, when `today` is in its last
 * CHECK_WINDOW_DAYS days or the first CHECK_WINDOW_DAYS days of the next; else null.
 */
export function checkMonth(today: string): string | null {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const day = Number(today.slice(8, 10))
  if (day > daysIn(year, month) - CHECK_WINDOW_DAYS) return today.slice(0, 7)
  if (day <= CHECK_WINDOW_DAYS) {
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`
    return prev
  }
  return null
}

/** Whether to show the reminder: inside the window and that month isn't checked (or dismissed) yet. */
export function checkDue(today: string, checked: string | undefined): boolean {
  const m = checkMonth(today)
  return m !== null && m !== checked
}

/**
 * One entry per account whose real balance was typed in (blank rows are
 * skipped, so are accounts that already match): what the app logs on save.
 */
export function checkEntries(
  accounts: Account[],
  txs: Transaction[],
  actuals: Record<string, string>,
  date: string,
  title: string,
): Omit<Transaction, "id" | "createdAt">[] {
  const out: Omit<Transaction, "id" | "createdAt">[] = []
  for (const a of accounts) {
    const text = actuals[a.id]?.trim()
    if (!text) continue
    const actual = parseFloat(text)
    if (!Number.isFinite(actual)) continue
    const entry = reconcileEntry(a, txs, actual, date, title)
    if (entry) out.push(entry)
  }
  return out
}
