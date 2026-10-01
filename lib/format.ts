import { currentLang, t } from "./i18n"
import type { Cycle, ISODate } from "./types"

const TH_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
]
const TH_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
]
const TH_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"]
const TH_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]
const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const EN_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const EN_WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const en = () => currentLang() === "en"
export const monthNames = () => (en() ? EN_MONTHS : TH_MONTHS)
export const monthNamesShort = () => (en() ? EN_MONTHS_SHORT : TH_MONTHS_SHORT)
export const weekdayNames = () => (en() ? EN_WEEKDAYS : TH_WEEKDAYS)
export const weekdayNamesShort = () => (en() ? EN_WEEKDAYS_SHORT : TH_WEEKDAYS_SHORT)
/** Buddhist-era year in Thai, Gregorian in English. */
export const displayYear = (y: number) => (en() ? y : y + 543)

export { baht, baht2, baht2Exact, num, splitDecimals } from "./money"

/* ---------- dates (all local time, no timezone drift) ---------- */

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
export function todayISO(): ISODate {
  return toISO(new Date())
}
export function monthKey(s: ISODate): string {
  return s.slice(0, 7)
}
export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86_400_000)
}
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}
export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** "กันยายน 2569" / "September 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return `${monthNames()[m - 1]} ${displayYear(y)}`
}
/** "3 ต.ค. 2569" / "3 Oct 2026" (year omitted when `withYear` is false) */
export function shortDate(s: ISODate, withYear = true): string {
  const d = fromISO(s)
  return `${d.getDate()} ${monthNamesShort()[d.getMonth()]}${withYear ? " " + displayYear(d.getFullYear()) : ""}`
}
/** "วันนี้ · 3 ต.ค.", "เมื่อวาน · …", or "พุธ 23 ก.ย." */
export function dayHeading(s: ISODate, today: ISODate): string {
  const diff = diffDays(today, s)
  const d = fromISO(s)
  const base = `${d.getDate()} ${monthNamesShort()[d.getMonth()]}`
  if (diff === 0) return `${t("common.today")} · ${base}`
  if (diff === 1) return `${t("common.yesterday")} · ${base}`
  return `${weekdayNames()[d.getDay()]} ${base}`
}
export function relativeDue(days: number): string {
  if (days <= 0) return t("common.today")
  if (days === 1) return t("common.tomorrow")
  return t("common.inDays", { count: days })
}

/** Next date on/after `from` when a subscription bills. */
export function nextDueDate(startDate: ISODate, cycle: Cycle, from: ISODate): ISODate {
  let d = startDate
  let i = 0
  while (d < from && i < 2000) {
    i++
    d = stepCycle(startDate, cycle, i)
  }
  return d
}
/** All billing dates in [startDate, until], oldest first. */
export function dueDatesUntil(startDate: ISODate, cycle: Cycle, until: ISODate): ISODate[] {
  const out: ISODate[] = []
  let i = 0
  let d = startDate
  while (d <= until && i < 2000) {
    out.push(d)
    i++
    d = stepCycle(startDate, cycle, i)
  }
  return out
}
/** The i-th billing date, clamping day-of-month (e.g. 31 → 30 in short months). */
export function stepCycle(startDate: ISODate, cycle: Cycle, i: number): ISODate {
  const s = fromISO(startDate)
  if (cycle === "week") return addDays(startDate, 7 * i)
  const months = cycle === "month" ? i : 12 * i
  const y = s.getFullYear()
  const m = s.getMonth() + months
  const target = new Date(y, m, 1)
  const dim = daysInMonth(target.getFullYear(), target.getMonth())
  target.setDate(Math.min(s.getDate(), dim))
  return toISO(target)
}
export function monthlyEquivalent(amount: number, cycle: Cycle): number {
  if (cycle === "week") return (amount * 52) / 12
  if (cycle === "year") return amount / 12
  return amount
}
export function cycleLabel(c: Cycle): string {
  return t(`cycle.${c}`)
}
export function cyclePer(c: Cycle): string {
  return t(c === "week" ? "cycle.perWeek" : c === "year" ? "cycle.perYear" : "cycle.perMonth")
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
