import { describe, expect, it } from "vitest"
import { payItems, payMessage, type PayItem } from "@/lib/payShare"

const items = (n: number): PayItem[] =>
  Array.from({ length: n }, (_, i) => ({ label: `bill ${i + 1}`, amount: (i + 1) * 10 }))
const line = (i: PayItem) => `- ${i.label} ${i.amount}`
const more = (n: number) => `+${n} more`

describe("payItems", () => {
  it("shows everything up to the limit", () => {
    expect(payItems(items(6), 6)).toEqual({ shown: items(6), more: 0 })
  })

  it("cuts a long list to leave room for the count", () => {
    const r = payItems(items(9), 6)
    expect(r.shown.map((i) => i.label)).toEqual(["bill 1", "bill 2", "bill 3", "bill 4", "bill 5"])
    expect(r.more).toBe(4)
  })
})

describe("payMessage", () => {
  it("is just the ask for one debt or none", () => {
    expect(payMessage("Pay 10", items(1), line, more)).toBe("Pay 10")
    expect(payMessage("Pay 0", [], line, more)).toBe("Pay 0")
  })

  it("lists each debt, then how many more", () => {
    expect(payMessage("Pay 30", items(2), line, more)).toBe("Pay 30\n- bill 1 10\n- bill 2 20")
    expect(payMessage("Pay", items(4), line, more, 3).split("\n")).toEqual([
      "Pay",
      "- bill 1 10",
      "- bill 2 20",
      "+2 more",
    ])
  })
})
