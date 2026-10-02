import { describe, expect, it } from "vitest"
import {
  addDays,
  daysInMonth,
  diffDays,
  dueDatesUntil,
  monthlyEquivalent,
  nextDueDate,
  numericDate,
  shiftMonth,
  stepCycle,
  timeAgo,
} from "@/lib/format"
import { baht, baht2, splitDecimals } from "@/lib/money"

describe("billing cycles", () => {
  it("clamps the day of month in shorter months", () => {
    expect(stepCycle("2024-01-31", "month", 1)).toBe("2024-02-29")
    expect(stepCycle("2025-01-31", "month", 1)).toBe("2025-02-28")
    expect(stepCycle("2024-01-31", "month", 2)).toBe("2024-03-31")
    expect(stepCycle("2026-08-31", "month", 1)).toBe("2026-09-30")
  })

  it("keeps 29 Feb only in leap years", () => {
    expect(stepCycle("2024-02-29", "year", 1)).toBe("2025-02-28")
    expect(stepCycle("2024-02-29", "year", 4)).toBe("2028-02-29")
  })

  it("steps weeks across month and year ends", () => {
    expect(stepCycle("2026-12-28", "week", 1)).toBe("2027-01-04")
  })

  it("lists every billing date up to a day", () => {
    expect(dueDatesUntil("2026-01-31", "month", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ])
    expect(dueDatesUntil("2026-05-01", "month", "2026-04-30")).toEqual([])
  })

  it("finds the next billing date on or after a day", () => {
    expect(nextDueDate("2026-08-25", "month", "2026-09-25")).toBe("2026-09-25")
    expect(nextDueDate("2026-08-25", "month", "2026-09-26")).toBe("2026-10-25")
    expect(nextDueDate("2026-10-01", "year", "2026-09-25")).toBe("2026-10-01")
  })

  it("converts prices to a monthly amount", () => {
    expect(monthlyEquivalent(120, "week")).toBe(520)
    expect(monthlyEquivalent(1200, "year")).toBe(100)
    expect(monthlyEquivalent(149, "month")).toBe(149)
  })
})

describe("dates", () => {
  it("does day and month arithmetic in local time", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01")
    expect(diffDays("2026-10-01", "2026-09-25")).toBe(6)
    expect(daysInMonth(2024, 1)).toBe(29)
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
  })
})

describe("money formatting", () => {
  it("formats baht", () => {
    expect(baht(1234.5)).toBe("฿1,235")
    expect(baht2(1234.5)).toBe("฿1,234.50")
    expect(splitDecimals(21930)).toEqual(["฿21,930", ".00"])
  })
})

describe("how long ago", () => {
  const now = new Date(2026, 9, 2, 12, 0, 0).getTime()
  const ago = (ms: number) => timeAgo(now - ms, now)
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR

  it("counts minutes, then hours, then days", () => {
    expect(ago(20_000)).toBe("เมื่อสักครู่")
    expect(ago(MIN)).toBe("1 นาทีที่แล้ว")
    expect(ago(59 * MIN + 59_000)).toBe("59 นาทีที่แล้ว")
    expect(ago(HOUR)).toBe("1 ชม.ที่แล้ว")
    expect(ago(23 * HOUR + 59 * MIN)).toBe("23 ชม.ที่แล้ว")
    expect(ago(DAY)).toBe("1 วันที่แล้ว")
    expect(ago(7 * DAY + 23 * HOUR)).toBe("7 วันที่แล้ว")
  })

  it("shows the date once it's more than a week", () => {
    expect(ago(8 * DAY)).toBe("24/09/2569")
    expect(ago(400 * DAY)).toBe(numericDate(new Date(now - 400 * DAY)))
    expect(numericDate(new Date(2026, 0, 5))).toBe("05/01/2569")
  })

  it("treats a clock a little behind the server as just now", () => {
    expect(timeAgo(now + 30_000, now)).toBe("เมื่อสักครู่")
  })
})
