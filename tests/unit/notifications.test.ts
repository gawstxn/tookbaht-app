import { describe, expect, it } from "vitest"
import { buildNotifications } from "@/lib/notifications"
import type { Goals, Subscription, Transaction } from "@/lib/types"

const goals: Goals = { incomeTarget: 0, expenseBudget: 0, categoryBudgets: {}, alertAt80: true }
const sub: Subscription = {
  id: "s1",
  kind: "subscription",
  entryType: "out",
  name: "Netflix",
  amount: 469,
  currency: "THB",
  cycle: "month",
  startDate: "2026-07-05",
  accountId: "a",
  category: "fun",
  remind: true,
  autoLog: true,
  paused: false,
  tone: "#000",
}
let n = 0
const charge = (date: string, amount: number, p: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  type: "out",
  amount,
  date,
  title: "Netflix",
  category: "sub",
  accountId: "a",
  subscriptionId: "s1",
  createdAt: Date.parse(`${date}T02:00:00Z`),
  ...p,
})
const build = (transactions: Transaction[]) =>
  buildNotifications({
    accounts: [],
    transactions,
    subscriptions: [sub],
    goals,
    today: "2026-09-20",
    now: Date.parse("2026-09-20T12:00:00Z"),
  })

describe("price rises", () => {
  it("flags a service that charged more than last time", () => {
    const list = build([charge("2026-08-05", 419), charge("2026-09-05", 469)]).filter((x) => x.kind === "price")
    expect(list).toHaveLength(1)
    expect(list[0].body).toContain("469")
  })

  it("ignores the same price and exchange-rate swings on dollar prices", () => {
    expect(build([charge("2026-08-05", 419), charge("2026-09-05", 419)]).some((x) => x.kind === "price")).toBe(false)
    const usd = (date: string, thb: number) =>
      charge(date, thb, { origAmount: 20, origCurrency: "USD", fxRate: thb / 20 })
    expect(build([usd("2026-08-05", 700), usd("2026-09-05", 730)]).some((x) => x.kind === "price")).toBe(false)
  })
})

describe("bills whose amount changes", () => {
  const bill = (startDate: string): Subscription => ({
    ...sub,
    id: "b1",
    kind: "recurring",
    name: "ค่าไฟ",
    amount: 1290,
    startDate,
    category: "bill",
    autoLog: false,
    variable: true,
  })
  const paid = (date: string, amount: number) => charge(date, amount, { title: "ค่าไฟ", subscriptionId: "b1" })
  const list = (startDate: string, transactions: Transaction[], billSkipped?: string[]) =>
    buildNotifications({
      accounts: [],
      transactions,
      subscriptions: [bill(startDate)],
      goals,
      today: "2026-09-20",
      now: Date.parse("2026-09-20T12:00:00Z"),
      billSkipped,
    })

  it("ask the day before the due date", () => {
    const due = list("2026-07-21", [paid("2026-08-21", 1180)]).filter((x) => x.kind === "due")
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ id: "bill:b1:2026-09-21", href: "/subscriptions/b1" })
    expect(due[0].title).toBe("ค่าไฟ ครบกำหนดจ่ายพรุ่งนี้")
    expect(due[0].body).toContain("1,290")
    // Three days ahead it is on Home only, not in the notification list yet.
    expect(list("2026-07-23", [paid("2026-08-23", 1180)]).some((x) => x.kind === "due")).toBe(false)
  })

  it("keep asking while the round is unpaid", () => {
    const due = list("2026-07-10", [paid("2026-08-10", 1180)]).filter((x) => x.kind === "due")
    expect(due.map((x) => x.id)).toEqual(["bill:b1:2026-09-10"])
    expect(due[0].title).toBe("ค่าไฟ เลยกำหนดมา 10 วันแล้ว")
  })

  it("stop once paid or skipped", () => {
    const txs = [paid("2026-08-10", 1180), paid("2026-09-12", 1420)]
    expect(list("2026-07-10", txs).some((x) => x.kind === "due")).toBe(false)
    expect(list("2026-07-10", [paid("2026-08-10", 1180)], ["b1:2026-09-10"]).some((x) => x.kind === "due")).toBe(false)
  })

  it("aren't reported as auto-logged or as a price rise", () => {
    const kinds = list("2026-07-10", [paid("2026-08-10", 1180), paid("2026-09-12", 1420)]).map((x) => x.kind)
    expect(kinds).not.toContain("autolog")
    expect(kinds).not.toContain("price")
  })
})

describe("monthly summary in the notification center", () => {
  it("sums up last month on the 1st", () => {
    const tx = (date: string, type: "in" | "out", amount: number): Transaction => ({
      id: date + type,
      type,
      amount,
      date,
      title: "",
      category: type === "in" ? "salary" : "food",
      accountId: "a",
      createdAt: 1,
    })
    const list = buildNotifications({
      accounts: [],
      transactions: [tx("2026-08-01", "in", 30000), tx("2026-08-10", "out", 1200)],
      subscriptions: [],
      goals,
      today: "2026-09-02",
      now: Date.parse("2026-09-02T12:00:00Z"),
    })
    const summary = list.find((x) => x.kind === "summary")!
    expect(summary.id).toBe("summary:2026-08")
    expect(summary.body).toContain("28,800")
  })
})
