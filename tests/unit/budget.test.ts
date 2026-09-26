import { describe, expect, it } from "vitest";
import { budgetBanner, dailyAllowance, rolloverCarry, withCarry } from "@/lib/budget";
import type { Goals, Transaction } from "@/lib/types";

let n = 0;
const spend = (category: string, amount: number): Transaction => ({ id: `t${n++}`, type: "out", amount, date: "2026-09-10", title: category, category, accountId: "a", createdAt: 0 });
const goals = (expenseBudget: number, categoryBudgets: Record<string, number>): Goals => ({ incomeTarget: 0, expenseBudget, categoryBudgets, alertAt80: true });
const banner = (g: Goals, txs: Transaction[]) => budgetBanner(g, txs, "2026-09", "2026-09-24");

describe("budget banner, most urgent first", () => {
  it("asks to set a budget when there is none", () => {
    expect(banner(goals(0, {}), []).tone).toBe("setup");
  });

  it("is calm when everything is within plan", () => {
    expect(banner(goals(30000, { food: 8000 }), [spend("food", 2000)]).tone).toBe("ok");
  });

  it("warns about one category at 80% or more", () => {
    const b = banner(goals(0, { bill: 3520 }), [spend("bill", 3200)]);
    expect(b.tone).toBe("warn");
    expect(b.count).toBeUndefined();
  });

  it("counts several categories near their budget", () => {
    const b = banner(goals(0, { bill: 1000, food: 1000, shop: 1000, fun: 1000 }), [spend("bill", 970), spend("food", 920), spend("shop", 850), spend("fun", 810)]);
    expect(b).toMatchObject({ tone: "warn", count: 4 });
  });

  it("shows how much one category is over", () => {
    const b = banner(goals(0, { shop: 5000, bill: 1000 }), [spend("shop", 5320), spend("bill", 910)]);
    expect(b).toMatchObject({ tone: "danger", amount: "฿320" });
    expect(b.count).toBeUndefined();
  });

  it("counts the over category plus several near ones", () => {
    const b = banner(goals(0, { shop: 5000, bill: 1000, food: 1000, fun: 1000 }), [spend("shop", 5320), spend("bill", 900), spend("food", 850), spend("fun", 820)]);
    expect(b).toMatchObject({ tone: "danger", count: 4 });
  });

  it("adds up several categories over budget", () => {
    const b = banner(goals(0, { shop: 5000, food: 8000, fun: 1000 }), [spend("shop", 6320), spend("food", 8560), spend("fun", 1260)]);
    expect(b).toMatchObject({ tone: "danger", amount: "฿2,140", count: 3 });
  });

  it("puts the overall budget first once it is exceeded", () => {
    const b = banner(goals(30000, { shop: 5000, food: 8000, fun: 1000 }), [spend("shop", 7000), spend("food", 9000), spend("fun", 1500), spend("bill", 14350)]);
    expect(b).toMatchObject({ tone: "critical", amount: "฿1,850", count: 3 });
  });
});

describe("today's allowance", () => {
  const goals = { incomeTarget: 0, expenseBudget: 3000, categoryBudgets: {}, alertAt80: true };
  const out = (amount: number, date: string) => ({ id: date + amount, type: "out" as const, amount, date, title: "", category: "food", accountId: "a", createdAt: 1 });

  it("spreads what's left over the days left, today included", () => {
    // 30-day month, 1,500 spent before the 16th: 1,500 over 15 days.
    const a = dailyAllowance(goals, [out(1500, "2026-09-10"), out(40, "2026-09-16")], "2026-09", "2026-09-16")!;
    expect(a.perDay).toBe(100);
    expect(a.spentToday).toBe(40);
    expect(a.left).toBe(60);
  });

  it("goes negative once today is over its share", () => {
    expect(dailyAllowance(goals, [out(3000, "2026-09-10"), out(50, "2026-09-16")], "2026-09", "2026-09-16")!.left).toBe(-50);
  });

  it("is only for the current month with an overall budget", () => {
    expect(dailyAllowance(goals, [], "2026-08", "2026-09-16")).toBeNull();
    expect(dailyAllowance({ ...goals, expenseBudget: 0 }, [], "2026-09", "2026-09-16")).toBeNull();
  });
});

describe("budget rollover", () => {
  const goals = { incomeTarget: 0, expenseBudget: 0, categoryBudgets: { food: 500, shop: 1000 }, alertAt80: true, rolloverKeys: ["food"] };
  const out = (amount: number, date: string, category = "food") => ({ id: date + amount, type: "out" as const, amount, date, title: "", category, accountId: "a", createdAt: 1 });

  it("carries last month's unused budget for the chosen categories only", () => {
    const carry = rolloverCarry(goals, [out(300, "2026-08-10"), out(200, "2026-08-11", "shop")], "2026-09");
    expect(carry).toEqual({ food: 200 });
    expect(withCarry(goals, carry).categoryBudgets).toEqual({ food: 700, shop: 1000 });
  });

  it("never carries a negative amount", () => {
    expect(rolloverCarry(goals, [out(900, "2026-08-10")], "2026-09")).toEqual({ food: 0 });
  });
});
