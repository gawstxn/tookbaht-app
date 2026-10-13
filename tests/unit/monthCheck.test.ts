import { describe, expect, it } from "vitest"
import { checkDue, checkEntries, checkMonth } from "@/lib/monthCheck"
import type { Account, Transaction } from "@/lib/types"

const account = (id: string, openingBalance = 0): Account => ({
  id,
  name: id,
  kind: "bank",
  openingBalance,
  mono: "",
  tone: "",
  fxFeePct: 0,
})
const out = (accountId: string, amount: number): Transaction => ({
  id: `t${accountId}${amount}`,
  type: "out",
  amount,
  date: "2026-10-05",
  title: "",
  createdAt: 0,
  accountId,
})

describe("checkMonth", () => {
  it("covers the last 3 days of a month", () => {
    expect(checkMonth("2026-10-28")).toBeNull()
    expect(checkMonth("2026-10-29")).toBe("2026-10")
    expect(checkMonth("2026-10-31")).toBe("2026-10")
  })

  it("covers the first 3 days of the next month, back to the one before", () => {
    expect(checkMonth("2026-11-01")).toBe("2026-10")
    expect(checkMonth("2026-11-03")).toBe("2026-10")
    expect(checkMonth("2026-11-04")).toBeNull()
  })

  it("handles short months and the new year", () => {
    expect(checkMonth("2026-02-25")).toBeNull()
    expect(checkMonth("2026-02-26")).toBe("2026-02")
    // 2024 is a leap year: February ends on the 29th.
    expect(checkMonth("2024-02-26")).toBeNull()
    expect(checkMonth("2024-02-27")).toBe("2024-02")
    expect(checkMonth("2027-01-02")).toBe("2026-12")
  })
})

describe("checkDue", () => {
  it("is due until that month is checked or dismissed", () => {
    expect(checkDue("2026-10-30", undefined)).toBe(true)
    expect(checkDue("2026-10-30", "2026-09")).toBe(true)
    expect(checkDue("2026-10-30", "2026-10")).toBe(false)
    expect(checkDue("2026-11-02", "2026-10")).toBe(false)
  })

  it("is never due mid-month", () => {
    expect(checkDue("2026-10-15", undefined)).toBe(false)
  })
})

describe("checkEntries", () => {
  const accounts = [account("a", 1000), account("b", 500), account("c", 0)]
  const txs = [out("a", 250)]

  it("logs the difference for each account that was filled in", () => {
    const list = checkEntries(accounts, txs, { a: "600", b: "520.5" }, "2026-10-31", "Adjust")
    expect(list).toEqual([
      { type: "out", amount: 150, date: "2026-10-31", title: "Adjust", category: "other", accountId: "a" },
      { type: "in", amount: 20.5, date: "2026-10-31", title: "Adjust", category: "other-in", accountId: "b" },
    ])
  })

  it("skips blank rows, accounts that match and unreadable text", () => {
    expect(checkEntries(accounts, txs, { a: "750", b: "", c: "." }, "2026-10-31", "Adjust")).toEqual([])
  })

  it("treats a typed 0 as a real balance", () => {
    expect(checkEntries(accounts, txs, { b: "0" }, "2026-10-31", "Adjust")).toMatchObject([
      { type: "out", amount: 500, accountId: "b" },
    ])
  })
})
