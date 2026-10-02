import { describe, expect, it } from "vitest"
import { billAverage, billPayments, billRoundId, openBill, openBills } from "@/lib/bills"
import type { Subscription, Transaction } from "@/lib/types"

const bill = (p: Partial<Subscription> = {}): Subscription => ({
  id: "power",
  kind: "recurring",
  entryType: "out",
  name: "ค่าไฟ",
  amount: 1200,
  currency: "THB",
  cycle: "month",
  startDate: "2026-08-05",
  accountId: "bank",
  category: "bill",
  remind: true,
  autoLog: false,
  paused: false,
  tone: "#1c1e1b",
  variable: true,
  ...p,
})
let seq = 0
const paid = (date: string, amount = 1300, subscriptionId = "power"): Transaction => ({
  id: `t${++seq}`,
  type: "out",
  amount,
  date,
  title: "ค่าไฟ",
  category: "bill",
  accountId: "bank",
  subscriptionId,
  createdAt: ++seq,
})

describe("openBill", () => {
  it("opens three days before the due date", () => {
    expect(openBill(bill(), [paid("2026-09-05")], "2026-10-01")).toBeNull()
    expect(openBill(bill(), [paid("2026-09-05")], "2026-10-02")).toMatchObject({ due: "2026-10-05", days: 3 })
    expect(openBill(bill(), [paid("2026-09-05")], "2026-10-05")).toMatchObject({ due: "2026-10-05", days: 0 })
  })

  it("stays open, late, until it's paid", () => {
    const txs = [paid("2026-09-05")]
    expect(openBill(bill(), txs, "2026-10-12")).toMatchObject({ due: "2026-10-05", days: -7 })
    expect(openBill(bill(), [...txs, paid("2026-10-12")], "2026-10-12")).toBeNull()
  })

  it("counts a payment made a little early", () => {
    expect(openBill(bill(), [paid("2026-09-28")], "2026-10-03")).toBeNull()
  })

  it("doesn't count last round's payment for this one", () => {
    // Paid a week late in September: still September's bill.
    expect(openBill(bill(), [paid("2026-09-12")], "2026-10-04")).toMatchObject({ due: "2026-10-05" })
  })

  it("moves on to the next round when one was never paid", () => {
    expect(openBill(bill(), [], "2026-11-01")).toMatchObject({ due: "2026-10-05", days: -27 })
    expect(openBill(bill(), [], "2026-11-02")).toMatchObject({ due: "2026-11-05", days: 3 })
  })

  it("stops asking for a skipped round only", () => {
    const skipped = [billRoundId(bill(), "2026-10-05")]
    expect(openBill(bill(), [], "2026-10-06", skipped)).toBeNull()
    expect(openBill(bill(), [], "2026-11-03", skipped)).toMatchObject({ due: "2026-11-05" })
  })

  it("ignores fixed entries, paused bills and bills that haven't started", () => {
    expect(openBill(bill({ variable: false }), [], "2026-10-05")).toBeNull()
    expect(openBill(bill({ paused: true }), [], "2026-10-05")).toBeNull()
    expect(openBill(bill({ startDate: "2026-12-01" }), [], "2026-10-05")).toBeNull()
  })

  it("ignores payments of other bills", () => {
    expect(openBill(bill(), [paid("2026-10-04", 300, "water")], "2026-10-05")).not.toBeNull()
  })

  it("uses a shorter window for weekly bills", () => {
    const weekly = bill({ cycle: "week", startDate: "2026-10-01" })
    expect(openBill(weekly, [paid("2026-10-01")], "2026-10-07")).toMatchObject({ due: "2026-10-08", days: 1 })
    expect(openBill(weekly, [paid("2026-10-06")], "2026-10-07")).toBeNull()
  })
})

describe("openBills", () => {
  it("lists the most overdue first", () => {
    const water = bill({ id: "water", name: "ค่าน้ำ", startDate: "2026-09-28" })
    expect(
      openBills([bill(), water, bill({ id: "rent", variable: false })], [], "2026-10-05").map((b) => b.sub.id),
    ).toEqual(["water", "power"])
  })
})

describe("billAverage", () => {
  it("averages the latest payments", () => {
    const txs = [
      paid("2026-08-05", 1000),
      paid("2026-09-05", 1500),
      paid("2026-10-05", 1100),
      paid("2026-10-05", 50, "water"),
    ]
    expect(billPayments(bill(), txs).map((t) => t.amount)).toEqual([1100, 1500, 1000])
    expect(billAverage(bill(), txs)).toBe(1200)
    expect(billAverage(bill(), txs, 2)).toBe(1300)
    expect(billAverage(bill(), [])).toBeNull()
  })
})
