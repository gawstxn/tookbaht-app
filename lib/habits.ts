import { accountBalance, monthTransactions, monthPace, spendByCategory, summarize } from "./selectors"
import { daysInMonth, monthKey, shiftMonth } from "./format"
import { dayOfPeriod, periodOf, shiftPeriod, type Period } from "./period"
import type { Account, Subscription, Transaction } from "./types"

const round2 = (n: number) => Math.round(n * 100) / 100

/* ---------- Bills paid by hand every month ---------- */

export interface RecurringCandidate {
  /** Stable id for "not a bill" dismissals. */
  key: string
  title: string
  amount: number
  category?: string
  accountId?: string
  /** Usual day of the month. */
  day: number
  /** When the next one is expected. */
  next: string
  months: number
  /** The amount differs from month to month (electricity): `amount` is the latest one. */
  variable: boolean
}

const norm = (s: string) => s.trim().toLocaleLowerCase()

/**
 * Expenses logged by hand once a month for at least `minMonths` months running
 * (same title, around the same day) that aren't a subscription or recurring
 * entry yet: the same amount each time (rent paid by transfer), or a bill
 * whose amount changes (electricity). Most months first.
 */
export function recurringCandidates(
  txs: Transaction[],
  subs: Subscription[],
  today: string,
  dismissed: string[] = [],
  minMonths = 3,
): RecurringCandidate[] {
  const known = new Set(subs.map((s) => norm(s.name)))
  const groups = new Map<string, Transaction[]>()
  const byTitle = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (t.type !== "out" || t.subscriptionId) continue
    const key = `${norm(t.title)}|${t.amount}`
    groups.set(key, [...(groups.get(key) ?? []), t])
    if (norm(t.title)) byTitle.set(norm(t.title), [...(byTitle.get(norm(t.title)) ?? []), t])
  }
  const out: RecurringCandidate[] = []
  const thisMonth = monthKey(today)
  const consider = (key: string, list: Transaction[], variable: boolean) => {
    if (dismissed.includes(key) || known.has(norm(list[0].title))) return
    const byMonth = new Map<string, Transaction[]>()
    for (const t of list) byMonth.set(monthKey(t.date), [...(byMonth.get(monthKey(t.date)) ?? []), t])
    // Once a month: a coffee bought every few days isn't a bill.
    if ([...byMonth.values()].some((m) => m.length > 1)) return
    // Count the run of months ending at the latest one, which must be this month or last.
    const months = [...byMonth.keys()].sort()
    const last = months[months.length - 1]
    if (last !== thisMonth && last !== shiftMonth(thisMonth, -1)) return
    let run = 1
    while (byMonth.has(shiftMonth(last, -run))) run++
    if (run < minMonths) return
    const recent = months.slice(-run).map((m) => byMonth.get(m)![0])
    // The same amount every time is a fixed bill, found under its own key.
    if (variable && new Set(recent.map((t) => t.amount)).size < 2) return
    const days = recent.map((t) => Number(t.date.slice(8, 10))).sort((a, b) => a - b)
    // Paid around the same time each month.
    if (days[days.length - 1] - days[0] > 5) return
    const day = days[Math.floor(days.length / 2)]
    const latest = recent[recent.length - 1]
    const nextMonth = shiftMonth(monthKey(latest.date), 1)
    const [y, m] = nextMonth.split("-").map(Number)
    const next = `${nextMonth}-${String(Math.min(day, daysInMonth(y, m - 1))).padStart(2, "0")}`
    out.push({
      key,
      title: latest.title,
      amount: latest.amount,
      category: latest.category,
      accountId: latest.accountId,
      day,
      next,
      months: run,
      variable,
    })
  }
  for (const [key, list] of groups) consider(key, list, false)
  // Same title, different amounts: a bill that changes every month. Dismissed as "title|~".
  const fixed = new Set(out.map((c) => norm(c.title)))
  for (const [title, list] of byTitle) if (!fixed.has(title)) consider(`${title}|~`, list, true)
  return out.sort((a, b) => b.months - a.months || b.amount - a.amount)
}

/* ---------- How long savings would last ---------- */

export interface Runway {
  /** Money in bank, savings and cash accounts. */
  cash: number
  /** Average spending of the last full months with any spending. */
  monthly: number
  months: number
  /** How many months the average is based on. */
  basis: number
}

/** Money on hand divided by average monthly spending over the last `lookback` full months. */
export function runway(
  accounts: Account[],
  txs: Transaction[],
  today: string,
  startDay = 1,
  lookback = 3,
): Runway | null {
  const cash = round2(accounts.filter((a) => a.kind !== "credit").reduce((s, a) => s + accountBalance(a, txs), 0))
  const thisMonth = periodOf(today, startDay)
  const spent = Array.from(
    { length: lookback },
    (_, i) => summarize(monthTransactions(txs, shiftPeriod(thisMonth, -1 - i))).expense,
  ).filter((v) => v > 0)
  if (!spent.length || cash <= 0) return null
  const monthly = round2(spent.reduce((a, b) => a + b, 0) / spent.length)
  return { cash, monthly, months: Math.floor((cash / monthly) * 10) / 10, basis: spent.length }
}

/* ---------- Categories running above usual ---------- */

export interface UnusualCategory {
  key: string
  spent: number
  /** What this point of the month usually looks like (average of earlier months, scaled to the days gone). */
  usual: number
  /** spent / usual − 1, e.g. 0.45 = 45% more. */
  over: number
}

/**
 * Categories where `month` is running clearly above the average of the
 * `lookback` months before it. For the current month the average is scaled to
 * the share of the month gone, and only from the 7th on (too noisy before).
 * Needs at least two earlier months with spending in the category.
 */
export function unusualCategories(
  txs: Transaction[],
  month: Period,
  today: string,
  lookback = 3,
  minRatio = 1.3,
  minDiff = 300,
): UnusualCategory[] {
  const pace = monthPace(month, today)
  if (pace === 0 || (pace < 1 && dayOfPeriod(today, month) < 7)) return []
  const now = spendByCategory(monthTransactions(txs, month))
  const history = Array.from({ length: lookback }, (_, i) =>
    spendByCategory(monthTransactions(txs, shiftPeriod(month, -1 - i))),
  )
  const out: UnusualCategory[] = []
  for (const [key, spent] of Object.entries(now)) {
    const past = history.map((h) => h[key] ?? 0)
    if (past.filter((v) => v > 0).length < 2) continue
    const usual = round2((past.reduce((a, b) => a + b, 0) / lookback) * pace)
    if (usual <= 0 || spent < usual * minRatio || spent - usual < minDiff) continue
    out.push({ key, spent: round2(spent), usual, over: spent / usual - 1 })
  }
  return out.sort((a, b) => b.spent - b.usual - (a.spent - a.usual))
}
