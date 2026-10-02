import { describe, expect, it } from "vitest"
import {
  budgetText,
  chargeText,
  dueText,
  logReminderText,
  renewText,
  summaryText,
  type PendingReminder,
} from "@/lib/pushText"

const charge = (p: Partial<PendingReminder>): PendingReminder => ({
  subscription_id: "s",
  user_id: "u",
  name: "Netflix",
  amount: "419.00",
  currency: "THB",
  due_date: "2026-09-26",
  account_name: "บัตรเครดิต",
  kind: "subscription",
  installment_no: 1,
  installments: null,
  ...p,
})

describe("push texts", () => {
  it("announces a subscription charge", () => {
    expect(chargeText("th", charge({}))).toEqual({ title: "Netflix ตัดบัญชีพรุ่งนี้", body: "฿419 จากบัตรเครดิต" })
    expect(chargeText("en", charge({}))).toEqual({ title: "Netflix bills tomorrow", body: "฿419 from บัตรเครดิต" })
  })

  it("asks for the real amount of a bill that changes every time", () => {
    const r = charge({ kind: "recurring", name: "ค่าไฟ", amount: 1290, account_name: "กสิกร", variable: true })
    expect(chargeText("th", r)).toEqual({
      title: "ค่าไฟ ถึงกำหนดจ่ายพรุ่งนี้",
      body: "ครั้งก่อน ฿1,290 · จ่ายแล้วแตะเพื่อจดยอดจริง",
    })
    expect(chargeText("en", r)).toEqual({
      title: "ค่าไฟ is due tomorrow",
      body: "Last time ฿1,290. Once paid, tap to log what it came to",
    })
  })

  it("numbers installments", () => {
    const r = charge({
      kind: "recurring",
      name: "หูฟัง",
      amount: 1290,
      installment_no: 2,
      installments: 3,
      account_name: "SPayLater",
    })
    expect(chargeText("th", r).title).toBe("หูฟัง (งวด 2/3) ถึงกำหนดพรุ่งนี้")
    expect(chargeText("en", r).title).toBe("หูฟัง (2 of 3) is due tomorrow")
  })

  it("asks a week before a yearly renewal", () => {
    const r = {
      subscription_id: "s",
      user_id: "u",
      name: "Cloudflare",
      amount: "350.00",
      currency: "THB" as const,
      due_date: "2026-10-05",
      days: 7,
    }
    expect(renewText("th", r)).toEqual({
      title: "Cloudflare จะต่ออายุในอีก 7 วัน",
      body: "฿350 สำหรับอีก 1 ปี ยังใช้อยู่ไหม",
    })
    expect(renewText("en", r).title).toBe("Cloudflare renews in 7 days")
  })

  it("reminds about a pay-later payment with what is owed", () => {
    expect(
      dueText("th", { account_id: "a", user_id: "u", name: "SPayLater", owed: "2419.00", due_date: "2026-09-26" }),
    ).toEqual({
      title: "ครบกำหนดชำระ SPayLater พรุ่งนี้",
      body: "ยอดค้างจ่าย ฿2,419",
    })
  })

  it("warns at 80% and when over, naming the category", () => {
    const base = { user_id: "u", month: "2026-09", budget_key: "food", budget: "1000" }
    expect(budgetText("th", { ...base, level: 80, spent: "850" }).title).toBe("อาหาร ใช้ไปแล้ว 85% ของงบ")
    expect(budgetText("th", { ...base, level: 100, spent: "1200" })).toEqual({
      title: "อาหาร เกินงบแล้ว ฿200",
      body: "ใช้ไป ฿1,200 จากงบ ฿1,000",
    })
    expect(budgetText("en", { ...base, budget_key: "total", level: 100, spent: "1200" }).title).toBe(
      "Overall budget is over by ฿200",
    )
  })

  it("sums up last month with the budgets that went over", () => {
    const r = { user_id: "u", month: "2026-09", income: "30000.00", expense: "21450.5", over_budget: ["food", "total"] }
    expect(summaryText("th", r)).toEqual({
      title: "สรุปเดือนกันยายน",
      body: "รับ ฿30,000 · จ่าย ฿21,451 · เหลือเก็บ ฿8,550\nเกินงบ: อาหาร, งบรวม",
    })
    expect(summaryText("en", { ...r, over_budget: [] })).toEqual({
      title: "Your September summary",
      body: "In ฿30,000 · Out ฿21,451 · Saved ฿8,550",
    })
    expect(summaryText("th", { ...r, income: 1000, expense: 1500, over_budget: [] }).body).toBe(
      "รับ ฿1,000 · จ่าย ฿1,500 · ขาด −฿500",
    )
  })
  it("nudges in the user's language", () => {
    expect(logReminderText("th").title).toBe("วันนี้จดรายการหรือยัง?")
    expect(logReminderText("en").title).toBe("Anything to log today?")
  })
  it("mentions the streak when there is one, or invites starting one", () => {
    expect(logReminderText("th", 0, null)).toMatchObject({
      body: "จดรายจ่ายของวันนี้ แล้วเริ่มนับวันจดต่อเนื่อง",
      url: "/add",
    })
    expect(logReminderText("th", 12, "keep")).toMatchObject({ title: "จดต่อเนื่องมา 12 วันแล้ว", url: "/add" })
    expect(logReminderText("en", 12, "keep").title).toBe("12-day streak")
    expect(logReminderText("th", 12, "restore")).toMatchObject({
      body: "ย้อนไปจดเพื่อรักษาความต่อเนื่อง 12 วันไว้",
      url: "/streak",
    })
  })
})
