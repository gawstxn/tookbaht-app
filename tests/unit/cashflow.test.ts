import { describe, expect, it } from "vitest"
import { cashFlow, firstShortfall } from "@/lib/cashflow"
import type { Account, Subscription, Transaction } from "@/lib/types"

const acc = (p: Partial<Account>): Account => ({
  id: "pay",
  name: "บัญชีเงินเดือน",
  kind: "bank",
  openingBalance: 4000,
  mono: "",
  tone: "",
  fxFeePct: 0,
  ...p,
})
const sub = (p: Partial<Subscription>): Subscription => ({
  id: "s",
  kind: "recurring",
  entryType: "out",
  name: "",
  amount: 100,
  currency: "THB",
  cycle: "month",
  startDate: "2026-01-22",
  accountId: "pay",
  category: "bills",
  remind: true,
  autoLog: true,
  paused: false,
  tone: "",
  ...p,
})
let n = 0
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${n++}`,
  type: "out",
  amount: 100,
  date: "2026-01-05",
  title: "",
  category: "food",
  accountId: "pay",
  createdAt: n,
  ...p,
})
const TODAY = "2026-01-20"

describe("cash flow", () => {
  const card = acc({ id: "ktc", name: "KTC", kind: "credit", openingBalance: 50000, dueDay: 24, billFromId: "pay" })
  const subs = [
    sub({ id: "net", name: "ค่าเน็ต", amount: 599, startDate: "2026-01-22" }),
    sub({ id: "phone", name: "ผ่อน iPhone", amount: 2500, startDate: "2025-10-23", installments: 10 }),
    sub({
      id: "salary",
      name: "เงินเดือน",
      entryType: "in",
      amount: 30000,
      startDate: "2025-12-25",
      category: "salary",
    }),
  ]
  const txs = [tx({ accountId: "ktc", amount: 3200 })]

  it("walks each account day by day and finds the first shortfall", () => {
    const [pay] = cashFlow([acc({}), card], txs, subs, TODAY)
    expect(pay.start).toBe(4000)
    // The next month's bills fall after the 30-day window (19 Feb).
    expect(pay.events.map((e) => [e.date, e.label, e.amount, e.balance])).toEqual([
      ["2026-01-22", "ค่าเน็ต", -599, 3401],
      ["2026-01-23", "ผ่อน iPhone", -2500, 901],
      ["2026-01-24", "KTC", -3200, -2299],
      ["2026-01-25", "เงินเดือน", 30000, 27701],
    ])
    expect(pay.short).toMatchObject({ by: 2299, event: { date: "2026-01-24", kind: "card", cardId: "ktc" } })
    expect(firstShortfall([pay])).toMatchObject({ account: { id: "pay" }, by: 2299 })
  })

  it("counts income before bills on the same day and stops installments when the plan ends", () => {
    const flows = cashFlow(
      [acc({ openingBalance: 0 })],
      [],
      [
        sub({ id: "in", entryType: "in", amount: 500, startDate: "2026-01-22" }),
        sub({ amount: 400, startDate: "2026-01-22" }),
        sub({ id: "done", amount: 9, startDate: "2025-11-21", installments: 2 }),
      ],
      TODAY,
    )
    expect(flows[0].events.map((e) => e.amount)).toEqual([500, -400])
    expect(flows[0].short).toBeNull()
  })

  it("leaves out today's scheduled entries, paused ones and card charges, and accounts with nothing coming", () => {
    const flows = cashFlow(
      [acc({}), acc({ id: "idle", name: "idle" }), card],
      [],
      [
        sub({ startDate: "2025-12-20" }),
        sub({ id: "late", startDate: "2025-12-30" }),
        sub({ id: "p", paused: true, startDate: "2026-01-21" }),
        sub({ id: "c", accountId: "ktc", startDate: "2026-01-21" }),
      ],
      TODAY,
    )
    expect(flows.map((f) => f.account.id)).toEqual(["pay"])
    expect(flows[0].events.map((e) => [e.subscriptionId, e.date])).toEqual([["late", "2026-01-30"]])
  })

  it("moves money between accounts and doesn't count a card twice when a transfer already pays it", () => {
    const flows = cashFlow(
      [acc({}), acc({ id: "jar", name: "ออม", kind: "saving", openingBalance: 0 }), card],
      txs,
      [
        sub({ id: "save", entryType: "move", amount: 1000, toAccountId: "jar", startDate: "2026-01-21" }),
        sub({ id: "paycard", entryType: "move", amount: 3200, toAccountId: "ktc", startDate: "2026-01-24" }),
      ],
      TODAY,
    )
    const pay = flows.find((f) => f.account.id === "pay")!
    expect(pay.events.filter((e) => e.kind === "card")).toEqual([])
    expect(pay.events.slice(0, 2).map((e) => [e.label, e.amount])).toEqual([
      ["", -1000],
      ["", -3200],
    ])
    expect(flows.find((f) => f.account.id === "jar")!.events[0]).toMatchObject({ amount: 1000, balance: 1000 })
  })

  it("doesn't warn about an account that is below zero already", () => {
    const [f] = cashFlow([acc({ openingBalance: -500 })], [], [sub({ startDate: "2026-01-22" })], TODAY)
    expect(f.start).toBe(-500)
    expect(f.short).toBeNull()
  })

  it("uses the converted price for foreign schedules", () => {
    const [f] = cashFlow(
      [acc({})],
      [],
      [sub({ currency: "USD", amount: 10, startDate: "2026-01-22" })],
      TODAY,
      (s) => s.amount * 34,
    )
    expect(f.events[0].amount).toBe(-340)
  })
})
