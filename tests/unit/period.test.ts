import { describe, expect, it } from "vitest"
import { cycleStartDay, dayOfPeriod, inPeriod, periodDays, periodFor, periodOf, shiftPeriod } from "@/lib/period"

const range = (p: { key: string; start: string; end: string }) => [p.key, p.start, p.end]

describe("pay-day periods", () => {
  it("is the calendar month with a start day of 1", () => {
    expect(range(periodOf("2026-02-14", 1))).toEqual(["2026-02", "2026-02-01", "2026-02-28"])
    expect(range(periodFor("2026-12", 1))).toEqual(["2026-12", "2026-12-01", "2026-12-31"])
  })

  it("runs from the start day to the day before the next one, named by its start month up to the 16th", () => {
    expect(range(periodOf("2026-09-29", 2))).toEqual(["2026-09", "2026-09-02", "2026-10-01"])
    expect(range(periodOf("2026-10-01", 2))).toEqual(["2026-09", "2026-09-02", "2026-10-01"])
    expect(range(periodOf("2026-10-02", 2))).toEqual(["2026-10", "2026-10-02", "2026-11-01"])
    expect(range(periodOf("2026-09-20", 16))).toEqual(["2026-09", "2026-09-16", "2026-10-15"])
  })

  it("is named after the next month when it starts after the 16th", () => {
    expect(range(periodOf("2026-09-25", 20))).toEqual(["2026-10", "2026-09-20", "2026-10-19"])
    expect(range(periodOf("2026-09-10", 20))).toEqual(["2026-09", "2026-08-20", "2026-09-19"])
    expect(range(periodOf("2026-12-25", 25))).toEqual(["2027-01", "2026-12-25", "2027-01-24"])
  })

  it("starts on the last day of short months", () => {
    expect(range(periodOf("2026-02-28", 31))).toEqual(["2026-03", "2026-02-28", "2026-03-30"])
    expect(range(periodOf("2026-02-27", 31))).toEqual(["2026-02", "2026-01-31", "2026-02-27"])
    expect(range(periodOf("2028-02-29", 30))).toEqual(["2028-03", "2028-02-29", "2028-03-29"])
  })

  it("gives every date exactly one period, back to back", () => {
    for (const day of [1, 2, 15, 16, 17, 25, 29, 30, 31]) {
      let p = periodOf("2026-01-05", day)
      for (let i = 0; i < 26; i++) {
        const next = shiftPeriod(p, 1)
        expect(next.start > p.end).toBe(true)
        expect(periodOf(p.start, day).key).toBe(p.key)
        expect(periodOf(p.end, day).key).toBe(p.key)
        expect(periodOf(next.start, day).key).toBe(next.key)
        p = next
      }
    }
  })

  it("counts days in and into a period", () => {
    const p = periodFor("2026-09", 2)
    expect(periodDays(p)).toBe(30)
    expect(dayOfPeriod("2026-09-02", p)).toBe(1)
    expect(dayOfPeriod("2026-10-01", p)).toBe(30)
    expect(inPeriod("2026-10-01", p)).toBe(true)
    expect(inPeriod("2026-09-01", p)).toBe(false)
  })

  it("reads the start day from settings safely", () => {
    expect(cycleStartDay({})).toBe(1)
    expect(cycleStartDay({ cycleStartDay: 25 })).toBe(25)
    expect(cycleStartDay({ cycleStartDay: 0 })).toBe(1)
    expect(cycleStartDay({ cycleStartDay: 32 })).toBe(1)
    expect(cycleStartDay({ cycleStartDay: 2.5 })).toBe(1)
  })
})
