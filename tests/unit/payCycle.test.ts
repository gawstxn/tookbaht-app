import { describe, expect, it } from "vitest";
import { dailyAllowance, rolloverCarry } from "@/lib/budget";
import { monthForecast } from "@/lib/forecast";
import { leftoverOffer } from "@/lib/leftover";
import { monthlySeries } from "@/lib/insights";
import { buildNotifications } from "@/lib/notifications";
import { periodFor, periodOf } from "@/lib/period";
import { daysLeftInMonth, monthPace, monthTransactions } from "@/lib/selectors";
import type { Goals, Transaction } from "@/lib/types";

// Paid on the 25th: "2026-10" runs 25 Sep – 24 Oct.
const OCT = periodFor("2026-10", 25);

let n = 0;
const out = (amount: number, date: string, category = "food"): Transaction => ({
  id: `t${n++}`, type: "out", amount, date, title: "", category, accountId: "a", createdAt: Date.parse(`${date}T03:00:00Z`),
});
const income = (amount: number, date: string): Transaction => ({ ...out(amount, date), type: "in", category: "salary" });
const goals = (p: Partial<Goals> = {}): Goals => ({ incomeTarget: 0, expenseBudget: 0, categoryBudgets: {}, alertAt80: false, ...p });

describe("months that start on payday", () => {
  it("takes entries from payday to the day before the next one", () => {
    const txs = [out(1, "2026-09-24"), out(2, "2026-09-25"), out(3, "2026-10-24"), out(4, "2026-10-25")];
    expect(monthTransactions(txs, OCT).map((t) => t.amount)).toEqual([2, 3]);
  });

  it("paces budgets over the month's own days", () => {
    expect(monthPace(OCT, "2026-10-09")).toBe(15 / 30);
    expect(daysLeftInMonth(OCT, "2026-10-09")).toBe(15);
    expect(daysLeftInMonth(OCT, "2026-10-25")).toBe(0);
  });

  it("spreads what's left of the budget over the days to the next payday", () => {
    const a = dailyAllowance(goals({ expenseBudget: 17000 }), [out(1000, "2026-09-26")], OCT, "2026-10-09")!;
    // 16,000 left over 16 days (9 Oct to 24 Oct, today included).
    expect(a.perDay).toBe(1000);
  });

  it("carries over what the previous pay month left", () => {
    const g = goals({ categoryBudgets: { food: 3000 }, rolloverKeys: ["food"] });
    // 25 Aug – 24 Sep is the month before; the 25 Sep entry belongs to this one.
    const carry = rolloverCarry(g, [out(1000, "2026-08-25"), out(500, "2026-09-24"), out(900, "2026-09-25")], OCT);
    expect(carry).toEqual({ food: 1500 });
  });

  it("forecasts to the day before the next payday", () => {
    const txs = [out(300, "2026-09-25"), out(300, "2026-09-27")];
    const f = monthForecast(txs, [], 0, OCT, "2026-09-29")!;
    expect(f.actual).toHaveLength(5);
    expect(f.daysLeft).toBe(25);
    expect(f.perDay).toBe(120);
  });

  it("offers last month's leftover in the first days after payday", () => {
    const txs = [income(30000, "2026-08-25"), out(20000, "2026-09-01")];
    expect(leftoverOffer(goals(), txs, "2026-09-26", undefined, true, 25)).toMatchObject({ month: "2026-09", amount: 10000 });
    expect(leftoverOffer(goals(), txs, "2026-10-02", undefined, true, 25)).toBeNull();
  });

  it("charts months by payday", () => {
    const txs = [out(100, "2026-09-24"), out(200, "2026-09-25")];
    expect(monthlySeries(txs, OCT, 2)).toEqual([
      { month: "2026-09", income: 0, expense: 100 },
      { month: "2026-10", income: 0, expense: 200 },
    ]);
  });

  it("sends the monthly summary on payday for the month that just ended", () => {
    const today = "2026-09-25";
    const list = buildNotifications({
      accounts: [], subscriptions: [], goals: goals(), transactions: [out(500, "2026-09-10")],
      today, now: Date.parse(`${today}T12:00:00Z`), startDay: 25,
    }).filter((x) => x.kind === "summary");
    expect(list.map((x) => x.id)).toEqual(["summary:2026-09"]);
    expect(periodOf(today, 25).key).toBe("2026-10");
  });
});
