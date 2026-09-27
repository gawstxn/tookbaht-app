import { describe, expect, it } from "vitest";
import { installmentOutlook } from "@/lib/installments";
import type { Subscription, Transaction } from "@/lib/types";

const plan = (p: Partial<Subscription>): Subscription => ({
  id: "p", kind: "recurring", entryType: "out", name: "iPhone", amount: 1000, currency: "THB", cycle: "month", startDate: "2026-08-05",
  accountId: "spay", installments: 6, category: "shop", remind: true, autoLog: true, paused: false, tone: "#000", ...p,
});
const TODAY = "2026-09-20";

describe("installment outlook", () => {
  it("counts only installments after today, month by month", () => {
    // Aug 5 … Jan 5: Aug and Sep are charged already.
    const o = installmentOutlook([plan({})], [], TODAY)!;
    expect(o.months.map((m) => [m.month, m.amount])).toEqual([
      ["2026-09", 0], ["2026-10", 1000], ["2026-11", 1000], ["2026-12", 1000], ["2027-01", 1000], ["2027-02", 0],
    ]);
    expect(o).toMatchObject({ remaining: 4000, lastDue: "2027-01-05", planCount: 1 });
  });

  it("adds up several plans and counts each once", () => {
    const o = installmentOutlook([plan({}), plan({ id: "q", amount: 450, startDate: "2026-09-25", installments: 3 })], [], TODAY)!;
    expect(o.months[0]).toEqual({ month: "2026-09", amount: 450, plans: 1 });
    expect(o.months[1]).toEqual({ month: "2026-10", amount: 1450, plans: 2 });
    expect(o.planCount).toBe(2);
    expect(o.remaining).toBe(4000 + 1350);
  });

  it("ignores open-ended subscriptions, income, paused and finished plans", () => {
    const subs = [
      plan({ id: "a", installments: null }),
      plan({ id: "b", entryType: "in" }),
      plan({ id: "c", paused: true }),
      plan({ id: "d", startDate: "2026-01-01", installments: 3 }),
    ];
    expect(installmentOutlook(subs, [], TODAY)).toBeNull();
  });

  it("averages income of the last three full months", () => {
    const inc = (date: string, amount: number): Transaction => ({ id: date, type: "in", amount, date, title: "", category: "salary", accountId: "a", createdAt: 0 });
    const o = installmentOutlook([plan({})], [inc("2026-06-25", 30000), inc("2026-07-25", 30000), inc("2026-08-25", 36000), inc("2026-09-01", 99999)], TODAY)!;
    expect(o.income).toBe(32000);
  });
});
