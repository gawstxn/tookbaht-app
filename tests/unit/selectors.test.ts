import { describe, expect, it } from "vitest";
import { accountBalance, daysLeftInMonth, filterTransactions, monthPace, reconcileEntry, spendByCategory, subscriptionTotals, summarize } from "@/lib/selectors";
import type { Account, Subscription, Transaction } from "@/lib/types";

let n = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, "type" | "amount">): Transaction => ({ id: `t${n++}`, date: "2026-09-10", title: "", createdAt: 0, ...p });
const account = (id: string, openingBalance = 0): Account => ({ id, name: id, kind: "bank", openingBalance, mono: "", tone: "", fxFeePct: 0 });
const sub = (p: Partial<Subscription> & Pick<Subscription, "amount" | "cycle">): Subscription => ({
  id: `s${n++}`, name: "", currency: "THB", startDate: "2026-09-01", accountId: "a", category: "fun", remind: true, autoLog: true, paused: false, tone: "", ...p,
});

describe("totals", () => {
  const txs = [
    tx({ type: "in", amount: 45000, accountId: "a", category: "salary" }),
    tx({ type: "out", amount: 120, accountId: "a", category: "food" }),
    tx({ type: "out", amount: 80, accountId: "b", category: "food" }),
    tx({ type: "out", amount: 500, accountId: "a", category: "shop" }),
    tx({ type: "move", amount: 5000, fromId: "a", toId: "b" }),
  ];

  it("sums income, expense and transfers separately", () => {
    expect(summarize(txs)).toEqual({ income: 45000, expense: 700, moved: 5000, net: 44300 });
  });

  it("groups spending by category", () => {
    expect(spendByCategory(txs)).toEqual({ food: 200, shop: 500 });
  });

  it("moves money between accounts without changing the total", () => {
    const a = accountBalance(account("a", 1000), txs);
    const b = accountBalance(account("b", 0), txs);
    expect(a).toBe(1000 + 45000 - 120 - 500 - 5000);
    expect(b).toBe(-80 + 5000);
    expect(a + b).toBe(1000 + summarize(txs).net);
  });
});

describe("subscription totals", () => {
  it("counts monthly-equivalent spend, keeps yearly apart and skips paused ones", () => {
    const subs = [
      sub({ amount: 149, cycle: "month", category: "music", startDate: "2026-08-30" }),
      sub({ amount: 120, cycle: "week", category: "fit", startDate: "2026-09-21" }),
      sub({ amount: 700, cycle: "year", category: "cloud", startDate: "2026-01-13" }),
      sub({ amount: 419, cycle: "month", paused: true }),
    ];
    const totals = subscriptionTotals(subs, "2026-09-25");
    expect(totals.count).toBe(3);
    expect(totals.perMonth).toBeCloseTo(149 + 520);
    expect(totals.perYearExtra).toBe(700);
    // Spotify bills 30 Sep and the gym 28 Sep; the yearly one not until January.
    expect(totals.next7).toBe(149 + 120);
    expect(totals.byCategory).toEqual({ music: 149, fit: 520 });
  });

  it("uses the converted price for USD subscriptions", () => {
    const totals = subscriptionTotals([sub({ amount: 20, currency: "USD", cycle: "month" })], "2026-09-25", (s) => s.amount * 35);
    expect(totals.perMonth).toBe(700);
  });
});

describe("month progress", () => {
  it("tracks how far into the month we are", () => {
    expect(monthPace("2026-09", "2026-09-15")).toBe(0.5);
    expect(monthPace("2026-08", "2026-09-15")).toBe(1);
    expect(monthPace("2026-10", "2026-09-15")).toBe(0);
    expect(daysLeftInMonth("2026-09", "2026-09-25")).toBe(5);
    expect(daysLeftInMonth("2026-08", "2026-09-25")).toBe(0);
  });
});

describe("list filters", () => {
  const txs = [
    tx({ type: "out", amount: 100, accountId: "a", category: "food", date: "2026-08-31" }),
    tx({ type: "out", amount: 200, accountId: "b", category: "food", date: "2026-09-01" }),
    tx({ type: "in", amount: 300, accountId: "a", category: "salary", date: "2026-09-15" }),
    tx({ type: "move", amount: 400, fromId: "b", toId: "a", date: "2026-09-30" }),
  ];
  const amounts = (f: Parameters<typeof filterTransactions>[1]) => filterTransactions(txs, f).map((t) => t.amount);

  it("keeps everything without filters", () => {
    expect(amounts({})).toEqual([100, 200, 300, 400]);
  });

  it("matches an account on either side of a transfer", () => {
    expect(amounts({ accountId: "a" })).toEqual([100, 300, 400]);
    expect(amounts({ accountId: "b" })).toEqual([200, 400]);
  });

  it("filters by category", () => {
    expect(amounts({ category: "food" })).toEqual([100, 200]);
  });

  it("filters by an inclusive date range, open at either end", () => {
    expect(amounts({ from: "2026-09-01", to: "2026-09-30" })).toEqual([200, 300, 400]);
    expect(amounts({ to: "2026-09-01" })).toEqual([100, 200]);
    expect(amounts({ from: "2026-09-15", accountId: "a" })).toEqual([300, 400]);
  });
});

describe("reconcile", () => {
  const txs = [tx({ type: "out", amount: 250, accountId: "a" })];

  it("logs the missing spend as an expense", () => {
    expect(reconcileEntry(account("a", 1000), txs, 600, "2026-09-25", "Adjust")).toEqual({
      type: "out", amount: 150, date: "2026-09-25", title: "Adjust", category: "other", accountId: "a",
    });
  });

  it("logs extra money as income", () => {
    expect(reconcileEntry(account("a", 1000), txs, 800.5, "2026-09-25", "Adjust")).toMatchObject({ type: "in", amount: 50.5, category: "other-in" });
  });

  it("does nothing when the balance already matches", () => {
    expect(reconcileEntry(account("a", 1000), txs, 750, "2026-09-25", "Adjust")).toBeNull();
  });

  it("brings the balance to exactly the real amount", () => {
    const a = account("a", 1000);
    const entry = reconcileEntry(a, txs, 123.45, "2026-09-25", "Adjust")!;
    expect(accountBalance(a, [...txs, tx(entry)])).toBeCloseTo(123.45, 2);
  });
});
