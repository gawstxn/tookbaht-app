import { addDays, daysInMonth, diffDays, shiftMonth, shortDate } from "./format"
import type { ISODate, Settings } from "./types"

/**
 * The user's month ("รอบเดือน"): from their payday to the day before the next
 * one. A start day of 1 is the calendar month. Days past a month's end (31 in
 * February) start on its last day instead. Budgets, the overview, rollover,
 * leftovers, summaries and the insights charts count by it; tax years, the
 * spending calendar and billing dates stay on calendar months.
 *
 * A period is named after the month holding most of its days: 2 Sep – 1 Oct is
 * "2026-09", 20 Sep – 19 Oct is "2026-10". With a fixed cut-off (16) every
 * key names exactly one period whatever the month lengths.
 */
export interface Period {
  /** "YYYY-MM" name of the period. */
  key: string
  startDay: number
  start: ISODate
  /** Last day, inclusive. */
  end: ISODate
}

/** Start days after this name the period after the month they start in. */
const NAMED_BY_START_UNTIL = 16

/** The start day saved in settings, made safe (1 when unset or out of range). */
export function cycleStartDay(settings: Pick<Settings, "cycleStartDay">): number {
  const d = settings.cycleStartDay
  return typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 31 ? d : 1
}

/** The start date within the calendar month `month` ("YYYY-MM"). */
function startIn(month: string, startDay: number): ISODate {
  const [y, m] = month.split("-").map(Number)
  return `${month}-${String(Math.min(startDay, daysInMonth(y, m - 1))).padStart(2, "0")}`
}

/** The period named `key`. */
export function periodFor(key: string, startDay: number): Period {
  const startMonth = startDay > NAMED_BY_START_UNTIL ? shiftMonth(key, -1) : key
  return {
    key,
    startDay,
    start: startIn(startMonth, startDay),
    end: addDays(startIn(shiftMonth(startMonth, 1), startDay), -1),
  }
}

/** The period `date` falls in. */
export function periodOf(date: ISODate, startDay: number): Period {
  const month = date.slice(0, 7)
  const startMonth = date >= startIn(month, startDay) ? month : shiftMonth(month, -1)
  return periodFor(startDay > NAMED_BY_START_UNTIL ? shiftMonth(startMonth, 1) : startMonth, startDay)
}

/** The period `n` periods after (or before, when negative) `p`. */
export const shiftPeriod = (p: Period, n: number): Period => periodFor(shiftMonth(p.key, n), p.startDay)

export const inPeriod = (date: ISODate, p: Period) => date >= p.start && date <= p.end

/** Number of days in the period. */
export const periodDays = (p: Period) => diffDays(p.end, p.start) + 1

/** 1 on the period's first day. */
export const dayOfPeriod = (date: ISODate, p: Period) => diffDays(date, p.start) + 1

/** "2 ก.ย. – 1 ต.ค." / "2 Sep – 1 Oct" */
export const periodRange = (p: Period) => `${shortDate(p.start, false)} – ${shortDate(p.end, false)}`
