import { describe, expect, it } from "vitest"
import { monthForecast } from "@/lib/forecast"
import type { Subscription, Transaction } from "@/lib/types"
import { periodFor } from "@/lib/period"

/** A calendar month as a period (start day 1). */
const cal = (key: string) => periodFor(key, 1)

let n = 0
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${n++}`,
  type: "out",
  amount: 100,
  date: "2026-09-01",
  title: "",
  category: "food",
  accountId: "a",
  createdAt: n,
  ...p,
})
const sub = (p: Partial<Subscription>): Subscription => ({
  id: "s",
  kind: "subscription",
  entryType: "out",
  name: "Netflix",
  amount: 419,
  currency: "THB",
  cycle: "month",
  startDate: "2026-01-25",
  accountId: "a",
  category: "fun",
  remind: true,
  autoLog: true,
  paused: false,
  tone: "#000",
  ...p,
})
const TODAY = "2026-09-10" // day 10 of 30

describe("month-end forecast", () => {
  it("adds spending so far, bills still to come and the daily pace for the days left", () => {
    const txs = [tx({ amount: 3000, date: "2026-09-02" }), tx({ amount: 2000, date: "2026-09-10" })]
    const f = monthForecast(txs, [sub({})], 20000, cal("2026-09"), TODAY)!
    expect(f).toMatchObject({ spent: 5000, scheduled: 419, perDay: 500, daysLeft: 20, budget: 20000 })
    expect(f.projected).toBe(5000 + 419 + 500 * 20)
    expect(f.actual).toHaveLength(10)
    expect(f.actual[0]).toBe(0)
    expect(f.actual[1]).toBe(3000)
    expect(f.actual[9]).toBe(5000)
    expect(f.ahead).toHaveLength(20)
    expect(f.ahead[19]).toBeCloseTo(f.projected)
    // The bill lands on the 25th (index 14 = day 25).
    expect(f.ahead[14] - f.ahead[13]).toBeCloseTo(500 + 419)
  })

  it("keeps entries logged from a schedule out of the daily pace", () => {
    const txs = [
      tx({ amount: 1000, date: "2026-09-05" }),
      tx({ amount: 9000, date: "2026-09-01", subscriptionId: "rent" }),
    ]
    const f = monthForecast(txs, [], 0, cal("2026-09"), TODAY)!
    expect(f.spent).toBe(10000)
    expect(f.perDay).toBe(100)
    expect(f.projected).toBe(10000 + 100 * 20)
  })

  it("takes repayments off spending and ignores income, moves and later entries", () => {
    const txs = [
      tx({ amount: 1000 }),
      tx({ type: "in", category: "repay", amount: 400 }),
      tx({ type: "in", category: "salary", amount: 50000 }),
      tx({ type: "move", amount: 5000, category: undefined, fromId: "a", toId: "b" }),
      tx({ amount: 700, date: "2026-09-20" }),
      tx({ amount: 900, date: "2026-08-31" }),
    ]
    expect(monthForecast(txs, [], 0, cal("2026-09"), TODAY)).toMatchObject({ spent: 600, perDay: 60 })
  })

  it("counts every charge left this month, only once each, and skips paused, income and finished plans", () => {
    const subs = [
      sub({ id: "gym", cycle: "week", startDate: "2026-09-04", amount: 100 }), // 11, 18, 25
      sub({ id: "paused", paused: true }),
      sub({ id: "salary", entryType: "in", amount: 30000 }),
      sub({ id: "done", kind: "recurring", startDate: "2026-05-15", installments: 4, amount: 1000 }), // May–Aug
      sub({ id: "last", kind: "recurring", startDate: "2026-06-15", installments: 4, amount: 1000 }), // Jun–Sep
      sub({ id: "today", startDate: "2026-08-10", amount: 50 }), // due today: already counted as spent
    ]
    const f = monthForecast([tx({ amount: 1000 })], subs, 0, cal("2026-09"), TODAY)!
    expect(f.scheduled).toBe(300 + 1000)
  })

  it("uses the converted price for foreign subscriptions", () => {
    const f = monthForecast(
      [tx({})],
      [sub({ currency: "USD", amount: 10 })],
      0,
      cal("2026-09"),
      TODAY,
      (s) => s.amount * 35,
    )!
    expect(f.scheduled).toBe(350)
  })

  it("shows only for the current month, from day 3, once something was spent", () => {
    const txs = [tx({ date: "2026-09-01" })]
    expect(monthForecast(txs, [], 0, cal("2026-08"), TODAY)).toBeNull()
    expect(monthForecast(txs, [], 0, cal("2026-09"), "2026-09-02")).toBeNull()
    expect(monthForecast(txs, [], 0, cal("2026-09"), "2026-09-03")).not.toBeNull()
    expect(monthForecast([], [], 0, cal("2026-09"), TODAY)).toBeNull()
  })
})
