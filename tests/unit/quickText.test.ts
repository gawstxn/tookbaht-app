import { describe, expect, it } from "vitest"
import { parseQuickText, parseTransferText, quickTextEntry, splitQuickText, transferRoute } from "@/lib/quickText"
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
  it("saves with the user's usual category and account when the line doesn't settle them", () => {
    const known = {
      categories: [
        { key: "food", label: "อาหาร" },
        { key: "other", label: "อื่นๆ" },
      ],
      accountIds: ["cash", "bank"],
    }
    const usual = { category: "other", accountId: "bank" }
    expect(quickTextEntry(parseQuickText("ค่าข้าว 50", TODAY), known, usual)).toEqual({
      type: "out",
      amount: 50,
      date: TODAY,
      title: "ค่าข้าว",
      note: "ค่าข้าว",
      category: "food",
      accountId: "bank",
    })
    // An account or category that has since been deleted isn't used.
    const history = [tx({ title: "ของฝาก", category: "c-gone", accountId: "closed", createdAt: 9 })]
    expect(quickTextEntry(parseQuickText("ของฝาก 200", TODAY, history), known, usual)).toMatchObject({
      category: "other",
      accountId: "bank",
    })
    // Only a number: named after its category.
    expect(quickTextEntry(parseQuickText("120", TODAY), known, usual)).toMatchObject({
      title: "อื่นๆ",
      note: undefined,
    })
  })

  it("saves nothing without an amount or an account", () => {
    const known = { categories: [{ key: "food", label: "อาหาร" }], accountIds: [] }
    expect(quickTextEntry(parseQuickText("ค่าข้าว", TODAY), known, { category: "food", accountId: "cash" })).toBeNull()
    expect(quickTextEntry(parseQuickText("ค่าข้าว 50", TODAY), known, { category: "food", accountId: "" })).toBeNull()
  })
})

describe("typed transfers", () => {
  const accounts = [
    { id: "pay", name: "บัญชีเงินเดือน" },
    { id: "kbank", name: "กสิกร ออมทรัพย์" },
    { id: "cash", name: "เงินสด" },
    { id: "trip", name: "Trip fund 2" },
  ]
  const ids = accounts.map((a) => a.id)

  it("is only for lines that start with โอน or transfer", () => {
    expect(parseTransferText("ค่าข้าว 50", TODAY, accounts)).toBeNull()
    expect(parseTransferText("transferwise 50", TODAY, accounts)).toBeNull()
    expect(parseTransferText("โอน 500 ไป เงินสด", TODAY, accounts)).not.toBeNull()
  })

  it("finds the amount and both accounts, by part of their names", () => {
    expect(parseTransferText("โอน 500 ไป ออมทรัพย์", TODAY, accounts)).toMatchObject({
      amount: 500,
      toId: "kbank",
      fromId: undefined,
      fromGiven: false,
      date: TODAY,
    })
    expect(parseTransferText("โอน 1,500 จาก เงินเดือน ไป กสิกร", TODAY, accounts)).toMatchObject({
      amount: 1500,
      fromId: "pay",
      toId: "kbank",
    })
    expect(parseTransferText("โอนเงินเข้าเงินสด 300 จากกสิกร เมื่อวาน", TODAY, accounts)).toMatchObject({
      amount: 300,
      fromId: "kbank",
      toId: "cash",
      date: "2026-09-27",
    })
    expect(parseTransferText("transfer 2k from trip to เงินสด", TODAY, accounts)).toMatchObject({
      amount: 2000,
      fromId: "trip",
      toId: "cash",
    })
  })

  it("reads the destination without ไป, and keeps a number that belongs to an account name", () => {
    expect(parseTransferText("โอน 500 เงินสด", TODAY, accounts)).toMatchObject({ amount: 500, toId: "cash" })
    expect(parseTransferText("โอน เงินสด 500", TODAY, accounts)).toMatchObject({ amount: 500, toId: "cash" })
    expect(parseTransferText("transfer 800 to trip fund 2", TODAY, accounts)).toMatchObject({
      amount: 800,
      toId: "trip",
    })
  })

  it("fills the side the line didn't name from the usual transfer, then any other account", () => {
    const to = parseTransferText("โอน 500 ไป เงินสด", TODAY, accounts)!
    expect(transferRoute(to, { fromId: "kbank", toId: "trip" }, ids)).toEqual({ fromId: "kbank", toId: "cash" })
    expect(transferRoute(to, {}, ids)).toEqual({ fromId: "pay", toId: "cash" })
    // The usual source is where this one goes: take another account.
    expect(transferRoute(to, { fromId: "cash", toId: "trip" }, ids)).toEqual({ fromId: "pay", toId: "cash" })
    const bare = parseTransferText("โอน 500", TODAY, accounts)!
    expect(transferRoute(bare, { fromId: "pay", toId: "kbank" }, ids)).toEqual({ fromId: "pay", toId: "kbank" })
    expect(transferRoute(bare, {}, ids)).toBe("to")
  })

  it("guesses nothing for an account it can't find", () => {
    expect(transferRoute(parseTransferText("โอน 500 ไป กรุงไทย", TODAY, accounts)!, { toId: "cash" }, ids)).toBe("to")
    expect(transferRoute(parseTransferText("โอน 500 จาก กรุงไทย ไป เงินสด", TODAY, accounts)!, {}, ids)).toBe("from")
    expect(transferRoute(parseTransferText("โอน 500 จาก เงินสด ไป เงินสด", TODAY, accounts)!, {}, ids)).toBe("same")
    expect(transferRoute(parseTransferText("โอน 500 ไป เงินสด", TODAY, accounts)!, {}, ["cash"])).toBe("from")
  })

  it("leaves the amount empty when there's no number", () => {
    expect(parseTransferText("โอน ไป เงินสด", TODAY, accounts)).toMatchObject({ amount: undefined, toId: "cash" })
  })
})

describe("accounts named in a line", () => {
  const accounts = [
    { id: "pay", name: "บัญชีเงินเดือน" },
    { id: "save", name: "บัญชีออม" },
    { id: "card", name: "บัตรเครดิต" },
    { id: "cash", name: "เงินสด" },
    { id: "spl", name: "SPayLater" },
  ]
  const parse = (line: string, history: Transaction[] = []) => parseQuickText(line, TODAY, history, accounts)

  it("takes the account from the end of the line and leaves it out of the name", () => {
    expect(parse("ค่าข้าว 50 เงินสด")).toMatchObject({
      title: "ค่าข้าว",
      amount: 50,
      accountId: "cash",
      category: "food",
    })
    expect(parse("กาแฟ เงินสด 65")).toMatchObject({ title: "กาแฟ", accountId: "cash" })
    expect(parse("รองเท้า 1,290 spaylater")).toMatchObject({ title: "รองเท้า", amount: 1290, accountId: "spl" })
    expect(parse("ค่าไฟ 800 บัตร เครดิต")).toMatchObject({ title: "ค่าไฟ", accountId: "card" })
    // Part of the name is enough.
    expect(parse("grab 120 ออม")).toMatchObject({ title: "grab", accountId: "save" })
  })

  it("takes it after a word like ด้วย or จาก", () => {
    expect(parse("ค่าข้าว 50 จ่ายด้วยเงินสด")).toMatchObject({ title: "ค่าข้าว", accountId: "cash" })
    expect(parse("shopee 399 จาก บัตรเครดิต เมื่อวาน")).toMatchObject({
      title: "shopee",
      accountId: "card",
      date: "2026-09-27",
    })
    expect(parse("+ขายของ 500 เข้า เงินเดือน")).toMatchObject({ type: "in", title: "ขายของ", accountId: "pay" })
  })

  it("keeps a name that only looks like an account", () => {
    // Nothing would be left to name the entry.
    expect(parse("เงินเดือน 30000")).toMatchObject({ type: "in", title: "เงินเดือน", accountId: undefined })
    expect(parse("ของฝากจากญี่ปุ่น 500")).toMatchObject({ title: "ของฝากจากญี่ปุ่น", accountId: undefined })
    expect(parse("ค่าเข้าชม 200")).toMatchObject({ title: "ค่าเข้าชม", accountId: undefined })
    expect(parse("ข้าว 2 จาน 120")).toMatchObject({ title: "ข้าว 2 จาน", accountId: undefined })
  })

  it("prefers the account in the line to the one used last time", () => {
    const history = [tx({ title: "ค่าข้าว", category: "food", accountId: "pay", createdAt: 9 })]
    expect(parse("ค่าข้าว 50", history).accountId).toBe("pay")
    expect(parse("ค่าข้าว 50 เงินสด", history)).toMatchObject({ accountId: "cash", category: "food" })
  })
})

describe("income without the +", () => {
  it("reads common income names", () => {
    expect(parseQuickText("ขายของ 500", TODAY)).toMatchObject({ type: "in", category: "sell" })
    expect(parseQuickText("ได้โบนัส 3000", TODAY)).toMatchObject({ type: "in", category: "salary" })
    expect(parseQuickText("ได้เงินคืน 200", TODAY)).toMatchObject({ type: "in", category: "repay" })
    expect(parseQuickText("เพื่อนคืนเงิน 200", TODAY)).toMatchObject({ type: "in", category: "repay" })
    expect(parseQuickText("แม่คืน 500", TODAY).type).toBe("in")
    expect(parseQuickText("refund 150", TODAY).type).toBe("in")
  })

  it("keeps spending as spending", () => {
    expect(parseQuickText("จ่ายคืนเพื่อน 200", TODAY).type).toBe("out")
    expect(parseQuickText("คืนเงินเพื่อน 200", TODAY).type).toBe("out")
    expect(parseQuickText("ที่พัก 2 คืน 3000", TODAY)).toMatchObject({ type: "out", amount: 3000 })
    expect(parseQuickText("ค้างคืน 800", TODAY).type).toBe("out")
    expect(parseQuickText("ดอกเบี้ยบัตรเครดิต 300", TODAY).type).toBe("out")
    expect(parseQuickText("ซื้อของขาย 900", TODAY).type).toBe("out")
  })

  it("lets + and - decide", () => {
    expect(parseQuickText("-ขายของ 500", TODAY)).toMatchObject({ type: "out", title: "ขายของ" })
    expect(parseQuickText("+จ่ายคืน 200", TODAY).type).toBe("in")
  })

  it("treats โอนให้… as paying someone, not a transfer between accounts", () => {
    const accounts = [{ id: "cash", name: "เงินสด" }]
    expect(parseTransferText("โอนให้แม่ 500", TODAY, accounts)).toBeNull()
    expect(parseTransferText("โอนค่าเช่า 6,000", TODAY, accounts)).toBeNull()
    expect(parseQuickText("โอนให้แม่ 500", TODAY)).toMatchObject({ type: "out", title: "โอนให้แม่", amount: 500 })
    expect(parseTransferText("โอน 500 ไป เงินสด", TODAY, accounts)).not.toBeNull()
  })
})

describe("several entries in one message", () => {
  it("cuts at each name with its own price", () => {
    expect(splitQuickText("ค่าข้าว 50 กาแฟ 65")).toEqual(["ค่าข้าว 50", "กาแฟ 65"])
    expect(splitQuickText("ค่าข้าว 50 กาแฟ 65 ขนม 20บาท")).toEqual(["ค่าข้าว 50", "กาแฟ 65", "ขนม 20บาท"])
    expect(splitQuickText("ค่าข้าว 50 +ขายของ 200")).toEqual(["ค่าข้าว 50", "+ขายของ 200"])
  })

  it("cuts at commas, semicolons and new lines", () => {
    expect(splitQuickText("ค่าข้าว 50, กาแฟ 65")).toEqual(["ค่าข้าว 50", "กาแฟ 65"])
    expect(splitQuickText("ค่าข้าว 50\nกาแฟ 65\n\n")).toEqual(["ค่าข้าว 50", "กาแฟ 65"])
    expect(splitQuickText("ค่าหอ 6,500; ค่าไฟ 1,200")).toEqual(["ค่าหอ 6,500", "ค่าไฟ 1,200"])
  })

  it("leaves a single entry exactly as typed", () => {
    for (const line of [
      "ค่าข้าว 50",
      "ข้าว 2 จาน 120 บาท",
      "กาแฟ 2 แก้ว 130",
      "ค่าหอ 6,500",
      "7-11 85.50",
      "฿99 netflix",
      "iphone 15 pro 32000",
      "grab 120 เมื่อวาน",
      "ค่าข้าว 50 เงินสด",
      "120",
      "ข้าวเย็น",
    ])
      expect(splitQuickText(line)).toEqual([line])
    expect(splitQuickText("   ")).toEqual([])
  })

  it("gives every entry the day the message names", () => {
    expect(splitQuickText("ค่าข้าว 50 กาแฟ 65 เมื่อวาน")).toEqual(["ค่าข้าว 50 เมื่อวาน", "กาแฟ 65 เมื่อวาน"])
  })

  it("never cuts up a transfer, and stops at ten entries", () => {
    expect(splitQuickText("โอน 500 จาก ออม 2 ไป เงินสด")).toEqual(["โอน 500 จาก ออม 2 ไป เงินสด"])
    expect(splitQuickText(Array.from({ length: 14 }, (_, i) => `ของ ${i + 1}0`).join(", "))).toHaveLength(10)
  })
})
