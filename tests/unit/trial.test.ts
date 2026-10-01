import { describe, expect, it } from "vitest"
import { parseBackup } from "@/lib/backup"
import { buildNotifications } from "@/lib/notifications"
import { chargeText, renewText, type PendingReminder } from "@/lib/pushText"
import { upcomingRenewal } from "@/lib/renewals"
import { chargesSoFar, subscriptionTotals } from "@/lib/selectors"
import { inTrial, trialDaysLeft, trialEnd, trialLengthOf } from "@/lib/trial"
import type { Goals, Subscription } from "@/lib/types"

/** Google AI Pro: free from 1 Oct 2026 for a year, then ฿750 a month. */
const sub = (p: Partial<Subscription> = {}): Subscription => ({
  id: "ai",
  kind: "subscription",
  entryType: "out",
  name: "Google AI Pro",
  amount: 750,
  currency: "THB",
  cycle: "month",
  startDate: "2027-10-01",
  trialFrom: "2026-10-01",
  accountId: "a",
  category: "tools",
  remind: true,
  autoLog: true,
  paused: false,
  tone: "#000",
  ...p,
})
const goals: Goals = { incomeTarget: 0, expenseBudget: 0, categoryBudgets: {}, alertAt80: true }

describe("free trial lengths", () => {
  it("ends a week, 1 or 3 months, or a year after it starts", () => {
    expect(trialEnd("2026-10-01", "7d")).toBe("2026-10-08")
    expect(trialEnd("2026-10-01", "1m")).toBe("2026-11-01")
    expect(trialEnd("2026-10-01", "3m")).toBe("2027-01-01")
    expect(trialEnd("2026-10-01", "1y")).toBe("2027-10-01")
    // Month ends clamp like billing dates.
    expect(trialEnd("2027-01-31", "1m")).toBe("2027-02-28")
  })

  it("recognises a preset from its dates, or a custom end", () => {
    expect(trialLengthOf("2026-10-01", "2027-01-01")).toBe("3m")
    expect(trialLengthOf("2026-10-01", "2026-10-20")).toBeNull()
  })

  it("counts the days left until the first charge", () => {
    expect(trialDaysLeft(sub(), "2026-09-30")).toBe(366)
    expect(trialDaysLeft(sub(), "2027-09-30")).toBe(1)
    expect(trialDaysLeft(sub(), "2027-10-01")).toBeNull()
    expect(inTrial(sub({ trialFrom: null }), "2026-12-01")).toBe(false)
    expect(chargesSoFar(sub(), "2027-09-30")).toBe(0)
  })
})

describe("free trials in totals", () => {
  it("leaves trials out of what's paid now and shows what they'll add", () => {
    const netflix = sub({
      id: "n",
      name: "Netflix",
      amount: 419,
      startDate: "2026-09-05",
      trialFrom: null,
      category: "fun",
    })
    const yearly = sub({ id: "y", amount: 1200, cycle: "year", startDate: "2027-01-01", trialFrom: "2026-10-01" })
    const totals = subscriptionTotals([sub(), yearly, netflix], "2026-10-15")
    expect(totals.perMonth).toBe(419)
    expect(totals.perYearExtra).toBe(0)
    expect(totals.byCategory).toEqual({ fun: 419 })
    expect(totals.count).toBe(3)
    expect(totals.trialCount).toBe(2)
    expect(totals.trialPerMonth).toBeCloseTo(750 + 100)
  })

  it("counts a service normally once its trial is over", () => {
    const totals = subscriptionTotals([sub()], "2027-10-01")
    expect(totals.perMonth).toBe(750)
    expect(totals.trialCount).toBe(0)
  })
})

describe("free trial reviews", () => {
  it("asks 3 days to 1 day before a trial ends, in any cycle", () => {
    expect(upcomingRenewal(sub(), "2027-09-27")).toBeNull()
    expect(upcomingRenewal(sub(), "2027-09-28")).toMatchObject({ due: "2027-10-01", days: 3, trial: true })
    expect(upcomingRenewal(sub({ cycle: "week" }), "2027-09-30")).toMatchObject({ days: 1, trial: true })
    expect(upcomingRenewal(sub({ paused: true }), "2027-09-28")).toBeNull()
  })

  it("goes back to yearly renewals after a yearly trial", () => {
    const y = sub({ cycle: "year" })
    expect(upcomingRenewal(y, "2027-09-26")).toBeNull()
    expect(upcomingRenewal(y, "2028-09-24")).toMatchObject({ due: "2028-10-01", days: 7, trial: false })
  })

  it("shows in the notification center at 09:00, 3 days before", () => {
    const list = buildNotifications({
      accounts: [],
      transactions: [],
      subscriptions: [sub()],
      goals,
      today: "2027-09-29",
      now: Date.parse("2027-09-29T12:00:00Z"),
    })
    const review = list.find((n) => n.kind === "renew")
    expect(review?.id).toBe("renew:ai:2027-10-01")
    expect(review?.title).toBe("ช่วงทดลองฟรี Google AI Pro จะหมดในอีก 2 วัน")
    expect(new Date(review!.at).toISOString()).toBe("2027-09-28T02:00:00.000Z")
  })

  it("says so in the pushes", () => {
    const r = {
      subscription_id: "ai",
      user_id: "u",
      name: "Google AI Pro",
      amount: "750.00",
      currency: "THB" as const,
      due_date: "2027-10-01",
      days: 3,
      trial: true,
    }
    expect(renewText("th", r)).toEqual({
      title: "ช่วงทดลองฟรี Google AI Pro จะหมดในอีก 3 วัน",
      body: "จากนั้นจะเริ่มตัด ฿750 ยังใช้ต่อไหม",
    })
    expect(renewText("en", r).title).toBe("Google AI Pro free trial ends in 3 days")
    const c: PendingReminder = {
      subscription_id: "ai",
      user_id: "u",
      name: "Google AI Pro",
      amount: "750.00",
      currency: "THB",
      due_date: "2027-10-01",
      account_name: "บัตรเครดิต",
      kind: "subscription",
      installment_no: 1,
      installments: null,
      trial: true,
    }
    expect(chargeText("th", c)).toEqual({
      title: "ช่วงทดลองฟรี Google AI Pro หมดพรุ่งนี้",
      body: "จะเริ่มตัด ฿750 จากบัตรเครดิต",
    })
    expect(chargeText("th", { ...c, trial: false }).title).toBe("Google AI Pro ตัดบัญชีพรุ่งนี้")
  })
})

describe("free trials in backups", () => {
  const file = (s: Partial<Subscription>) =>
    JSON.stringify({
      app: "tookbaht",
      version: 1,
      accounts: [{ id: "a", name: "บัตร", kind: "bank", openingBalance: 0 }],
      transactions: [],
      subscriptions: [sub(s)],
    })

  it("keeps a trial and rejects one that ends before it starts", () => {
    expect(parseBackup(file({})).subscriptions[0].trialFrom).toBe("2026-10-01")
    expect(() => parseBackup(file({ trialFrom: "2027-10-01" }))).toThrow()
  })
})
