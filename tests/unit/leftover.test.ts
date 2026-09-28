import { describe, expect, it } from "vitest";
import { leftoverOffer, leftoverSource } from "@/lib/leftover";
import type { Account, Goals, Transaction } from "@/lib/types";

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, type: "out", amount: 100, date: "2026-08-15", title: "", category: "food", accountId: "bank", createdAt: n, ...p,
});
const acc = (id: string, kind: Account["kind"]): Account => ({ id, name: id, kind, openingBalance: 0, mono: "", tone: "", fxFeePct: 0 });
const goals = (expenseBudget: number): Goals => ({ incomeTarget: 0, expenseBudget, categoryBudgets: {}, alertAt80: false });
const TODAY = "2026-09-01";

describe("leftover offer", () => {
  it("offers last month's unspent budget", () => {
    const txs = [tx({ amount: 17660 })];
    expect(leftoverOffer(goals(20000), txs, TODAY, undefined, true)).toEqual({ month: "2026-08", amount: 2340, fromBudget: true });
  });

  it("never offers more than income minus spending when income was logged", () => {
    const txs = [tx({ amount: 15000 }), tx({ type: "in", category: "salary", amount: 16000 })];
    expect(leftoverOffer(goals(20000), txs, TODAY, undefined, true)?.amount).toBe(1000);
  });

  it("uses income minus spending without a budget, rounded down", () => {
    const txs = [tx({ amount: 20000.5 }), tx({ type: "in", category: "salary", amount: 25000 })];
    expect(leftoverOffer(goals(0), txs, TODAY, undefined, true)).toEqual({ month: "2026-08", amount: 4999, fromBudget: false });
  });

  it("stays quiet when over budget, little is left, or last month is empty", () => {
    expect(leftoverOffer(goals(10000), [tx({ amount: 12000 })], TODAY, undefined, true)).toBeNull();
    expect(leftoverOffer(goals(10000), [tx({ amount: 9950 })], TODAY, undefined, true)).toBeNull();
    expect(leftoverOffer(goals(10000), [tx({ date: "2026-07-10" })], TODAY, undefined, true)).toBeNull();
  });

  it("shows on the first week only, once per month, and only with a goal to save into", () => {
    const txs = [tx({ amount: 5000 })];
    expect(leftoverOffer(goals(10000), txs, "2026-09-07", undefined, true)).not.toBeNull();
    expect(leftoverOffer(goals(10000), txs, "2026-09-08", undefined, true)).toBeNull();
    expect(leftoverOffer(goals(10000), txs, TODAY, "2026-08", true)).toBeNull();
    expect(leftoverOffer(goals(10000), txs, TODAY, "2026-07", true)).not.toBeNull();
    expect(leftoverOffer(goals(10000), txs, TODAY, undefined, false)).toBeNull();
  });
});

describe("leftover source account", () => {
  const accounts = [acc("card", "credit"), acc("cash", "cash"), acc("bank", "bank"), acc("pay", "bank"), acc("jar", "saving")];

  it("picks the account last month's income went into most", () => {
    const txs = [tx({ type: "in", accountId: "pay", amount: 30000 }), tx({ type: "in", accountId: "bank", amount: 500 })];
    expect(leftoverSource(accounts, txs, "2026-08", "jar")).toBe("pay");
  });

  it("falls back to a bank account, never a card or the goal's own account", () => {
    expect(leftoverSource(accounts, [], "2026-08", "jar")).toBe("bank");
    expect(leftoverSource(accounts, [tx({ type: "in", accountId: "jar", amount: 9 })], "2026-08", "jar")).toBe("bank");
    expect(leftoverSource([acc("card", "credit")], [], "2026-08")).toBeNull();
  });
});
