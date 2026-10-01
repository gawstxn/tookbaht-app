import { describe, expect, it } from "vitest"
import {
  categoryBreakdown,
  compact,
  dailySpend,
  monthlySeries,
  netWorthSeries,
  niceTicks,
  yearSummary,
  yearsWithData,
} from "@/lib/insights"
import type { Transaction } from "@/lib/types"
import { periodFor } from "@/lib/period"

/** A calendar month as a period (start day 1). */
const cal = (key: string) => periodFor(key, 1)

let n = 0
const tx = (type: Transaction["type"], amount: number, date: string, category?: string): Transaction => ({
  id: `t${n++}`,
  type,
  amount,
  date,
  title: "",
  category,
  accountId: type === "move" ? undefined : "a",
  fromId: type === "move" ? "a" : undefined,
  toId: type === "move" ? "b" : undefined,
  createdAt: 0,
})

const txs = [
  tx("in", 45000, "2026-09-01", "salary"),
  tx("out", 8500, "2026-09-03", "bill"),
  tx("out", 1500, "2026-09-10", "food"),
  tx("move", 5000, "2026-09-02"),
  tx("in", 45000, "2026-07-01", "salary"),
  tx("out", 2000, "2026-04-30", "food"),
  tx("out", 999, "2026-03-31", "food"),
]

describe("insights", () => {
  it("builds six months of income and expense, oldest first, without transfers", () => {
    expect(monthlySeries(txs, cal("2026-09"))).toEqual([
      { month: "2026-04", income: 0, expense: 2000 },
      { month: "2026-05", income: 0, expense: 0 },
      { month: "2026-06", income: 0, expense: 0 },
      { month: "2026-07", income: 45000, expense: 0 },
      { month: "2026-08", income: 0, expense: 0 },
      { month: "2026-09", income: 45000, expense: 10000 },
    ])
  })

  it("crosses year boundaries", () => {
    expect(monthlySeries([], cal("2026-02"), 3).map((m) => m.month)).toEqual(["2025-12", "2026-01", "2026-02"])
  })

  it("ranks a month's spending by category with shares", () => {
    expect(categoryBreakdown(txs, cal("2026-09"))).toEqual([
      { key: "bill", amount: 8500, share: 0.85 },
      { key: "food", amount: 1500, share: 0.15 },
    ])
    expect(categoryBreakdown(txs, cal("2026-05"))).toEqual([])
  })

  it("picks clean axis ticks", () => {
    expect(niceTicks(45000)).toEqual([0, 20000, 40000, 60000])
    expect(niceTicks(10000)).toEqual([0, 5000, 10000])
    expect(niceTicks(0)).toEqual([0])
  })

  it("shortens axis numbers", () => {
    expect([compact(45000), compact(2500), compact(1_250_000), compact(800)]).toEqual(["45K", "2.5K", "1.3M", "800"])
  })
})

describe("calendar, net worth and the year", () => {
  const acc = (id: string, kind: "bank" | "credit", openingBalance: number) => ({
    id,
    name: id,
    kind,
    openingBalance,
    mono: "",
    tone: "",
    fxFeePct: 0,
  })
  const tx = (p: Partial<import("@/lib/types").Transaction>) => ({
    id: Math.random().toString(),
    type: "out" as const,
    amount: 0,
    date: "2026-09-01",
    title: "",
    accountId: "bank",
    category: "food",
    createdAt: 1,
    ...p,
  })

  it("sums spending per day", () => {
    const d = dailySpend(
      [
        tx({ amount: 50, date: "2026-09-02" }),
        tx({ amount: 25, date: "2026-09-02" }),
        tx({ amount: 9, date: "2026-08-31" }),
      ],
      "2026-09",
    )
    expect(d).toEqual({ "2026-09-02": 75 })
  })

  it("tracks net worth: cash in accounts less what cards owe, at each month end", () => {
    const accounts = [acc("bank", "bank", 10000), acc("card", "credit", 50000)]
    const txs = [
      tx({ amount: 2000, date: "2026-08-05", accountId: "card" }),
      tx({ type: "in", amount: 30000, date: "2026-09-01", category: "salary" }),
      tx({ type: "move", amount: 2000, date: "2026-09-05", accountId: undefined, fromId: "bank", toId: "card" }),
    ]
    expect(netWorthSeries(accounts, txs, "2026-09", 3)).toEqual([
      { month: "2026-07", value: 10000 },
      { month: "2026-08", value: 8000 },
      { month: "2026-09", value: 38000 },
    ])
  })

  it("sums up a year", () => {
    const txs = [
      tx({ type: "in", amount: 30000, date: "2026-01-01", category: "salary" }),
      tx({ amount: 1200, date: "2026-01-10", category: "food" }),
      tx({ amount: 419, date: "2026-02-05", category: "sub", subscriptionId: "s" }),
      tx({ amount: 5000, date: "2025-12-20" }),
    ]
    const y = yearSummary(txs, 2026)
    expect({
      income: y.income,
      expense: y.expense,
      automatic: y.automatic,
      entries: y.entries,
      biggest: y.biggest?.amount,
      best: y.bestMonth?.month,
    }).toEqual({
      income: 30000,
      expense: 1619,
      automatic: 419,
      entries: 3,
      biggest: 1200,
      best: "2026-01",
    })
    expect(y.topCategories[0]).toEqual({ key: "food", amount: 1200 })
    expect(yearsWithData(txs)).toEqual([2026, 2025])
  })
})
