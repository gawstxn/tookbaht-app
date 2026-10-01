import { describe, expect, it } from "vitest"
import { parseQuickText } from "@/lib/quickText"
import type { Transaction } from "@/lib/types"

const TODAY = "2026-09-28"
let seq = 0
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
  type: "out",
  amount: 1,
  date: "2026-09-01",
  title: "x",
  createdAt: ++seq,
  ...p,
})

describe("one-line entries", () => {
  it("takes the last number as the amount and the rest as the name", () => {
    expect(parseQuickText("ข้าวมันไก่ 50", TODAY)).toMatchObject({
      type: "out",
      amount: 50,
      title: "ข้าวมันไก่",
      date: TODAY,
      category: "food",
    })
    expect(parseQuickText("7-11 85.50", TODAY)).toMatchObject({ amount: 85.5, title: "7-11", category: "food" })
    expect(parseQuickText("ข้าว 2 จาน 120 บาท", TODAY)).toMatchObject({ amount: 120, title: "ข้าว 2 จาน" })
    expect(parseQuickText("ค่าหอ 6,500", TODAY)).toMatchObject({ amount: 6500, title: "ค่าหอ", category: "bill" })
    expect(parseQuickText("iphone 1.2k", TODAY).amount).toBe(1200)
    expect(parseQuickText("฿99 netflix", TODAY)).toMatchObject({ amount: 99, title: "netflix" })
  })

  it("reads the day", () => {
    expect(parseQuickText("grab 120 เมื่อวาน", TODAY)).toMatchObject({
      amount: 120,
      title: "grab",
      date: "2026-09-27",
      category: "travel",
    })
    expect(parseQuickText("เมื่อวานซืน ชาบู 399", TODAY)).toMatchObject({
      date: "2026-09-26",
      title: "ชาบู",
      category: "food",
    })
    expect(parseQuickText("coffee 65 yesterday", TODAY).date).toBe("2026-09-27")
  })

  it("treats + and salary as income", () => {
    expect(parseQuickText("+ขายของ 500", TODAY)).toMatchObject({ type: "in", amount: 500, title: "ขายของ" })
    expect(parseQuickText("เงินเดือน 30000", TODAY)).toMatchObject({ type: "in", category: "salary" })
  })

  it("uses the user's own past entry for the category and account", () => {
    const history = [
      tx({ title: "อาหาร", note: "ร้านป้าแดง", category: "food", accountId: "cash", createdAt: 5 }),
      tx({ title: "ค่าจอดรถ", category: "travel", accountId: "bank", createdAt: 6 }),
      tx({ title: "ร้านป้าแดง", category: "shop", accountId: "bank", createdAt: 1 }),
    ]
    expect(parseQuickText("ร้านป้าแดง 45", TODAY, history)).toMatchObject({ category: "food", accountId: "cash" })
    expect(parseQuickText("จอดรถ 40", TODAY, history)).toMatchObject({ category: "travel", accountId: "bank" })
  })

  it("leaves the amount empty when there's no number", () => {
    expect(parseQuickText("ข้าวเย็น", TODAY)).toMatchObject({ amount: undefined, title: "ข้าวเย็น" })
    expect(parseQuickText("", TODAY)).toMatchObject({ amount: undefined, title: "", category: undefined })
  })

  it("doesn't mistake water bills for drinks", () => {
    expect(parseQuickText("ค่าน้ำ 300", TODAY).category).toBe("bill")
    expect(parseQuickText("น้ำเปล่า 10", TODAY).category).toBe("food")
  })
})
