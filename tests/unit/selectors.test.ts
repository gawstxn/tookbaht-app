import { describe, expect, it } from "vitest";
import { accountBalance, accountDeleteBlock, accountDue, chargesSoFar, creditSummary, daysLeftInMonth, planInterest, planReserved, filterTransactions, monthPace, nextCharge, reconcileEntry, spendByCategory, subscriptionTotals, summarize, upcomingSubscriptions } from "@/lib/selectors";
import type { Account, Subscription, Transaction } from "@/lib/types";
import { periodFor } from "@/lib/period";

/** A calendar month as a period (start day 1). */
const cal = (key: string) => periodFor(key, 1);

let n = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, "type" | "amount">): Transaction => ({ id: `t${n++}`, date: "2026-09-10", title: "", createdAt: 0, ...p });
const account = (id: string, openingBalance = 0): Account => ({ id, name: id, kind: "bank", openingBalance, mono: "", tone: "", fxFeePct: 0 });
const sub = (p: Partial<Subscription> & Pick<Subscription, "amount" | "cycle">): Subscription => ({
  id: `s${n++}`, kind: "subscription", entryType: "out", name: "", currency: "THB", startDate: "2026-09-01", accountId: "a", category: "fun", remind: true, autoLog: true, paused: false, tone: "", ...p,
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
    expect(monthPace(cal("2026-09"), "2026-09-15")).toBe(0.5);
    expect(monthPace(cal("2026-08"), "2026-09-15")).toBe(1);
    expect(monthPace(cal("2026-10"), "2026-09-15")).toBe(0);
    expect(daysLeftInMonth(cal("2026-09"), "2026-09-25")).toBe(5);
    expect(daysLeftInMonth(cal("2026-08"), "2026-09-25")).toBe(0);
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

describe("recurring schedules and installments", () => {
  const plan = { startDate: "2026-07-10", cycle: "month" as const, installments: 3 };

  it("numbers the next charge", () => {
    expect(nextCharge(plan, "2026-07-10")).toEqual({ due: "2026-07-10", n: 1 });
    expect(nextCharge(plan, "2026-08-11")).toEqual({ due: "2026-09-10", n: 3 });
  });

  it("ends an installment plan after its last charge", () => {
    expect(nextCharge(plan, "2026-09-11")).toBeNull();
    expect(nextCharge({ ...plan, installments: null }, "2026-09-11")).toEqual({ due: "2026-10-10", n: 4 });
  });

  it("counts charges so far, capped at the plan length", () => {
    expect(chargesSoFar(plan, "2026-07-09")).toBe(0);
    expect(chargesSoFar(plan, "2026-08-10")).toBe(2);
    expect(chargesSoFar(plan, "2027-01-01")).toBe(3);
  });

  it("drops paid-off plans and paused entries from what's coming up", () => {
    const subs = [
      sub({ amount: 1000, cycle: "month", startDate: "2026-06-01", installments: 2, kind: "recurring" }),
      sub({ amount: 149, cycle: "month", startDate: "2026-09-30" }),
      sub({ amount: 419, cycle: "month", startDate: "2026-09-26", paused: true }),
    ];
    expect(upcomingSubscriptions(subs, "2026-09-25").map((u) => [u.sub.amount, u.due, u.n])).toEqual([[149, "2026-09-30", 1]]);
  });

  it("keeps salary, rent and installments out of the subscription totals", () => {
    const subs = [sub({ amount: 149, cycle: "month" }), sub({ amount: 45000, cycle: "month", kind: "recurring", entryType: "in" })];
    expect(subscriptionTotals(subs, "2026-09-25").perMonth).toBe(149);
  });
});

describe("pay-later due date", () => {
  const paylater: Account = { ...account("p", 10000), kind: "credit", dueDay: 5 };
  const spent = [tx({ type: "out", amount: 1500, accountId: "p" }), tx({ type: "move", amount: 500, fromId: "a", toId: "p" })];

  it("finds the next due date and what is owed", () => {
    expect(accountDue(paylater, spent, "2026-09-03")).toEqual({ due: "2026-09-05", days: 2, owed: 1000 });
    expect(accountDue(paylater, spent, "2026-09-06")).toEqual({ due: "2026-10-05", days: 29, owed: 1000 });
    expect(accountDue(paylater, spent, "2026-12-20")?.due).toBe("2027-01-05");
  });

  it("clamps day 31 to the end of short months", () => {
    expect(accountDue({ ...paylater, dueDay: 31 }, [], "2026-02-10")?.due).toBe("2026-02-28");
  });

  it("only applies to cards with a due day", () => {
    expect(accountDue(account("a"), spent, "2026-09-03")).toBeNull();
    expect(accountDue({ ...paylater, dueDay: null }, spent, "2026-09-03")).toBeNull();
  });
});

describe("pay-later purchases", () => {
  // Limit 20,000; a phone at 7,000 over 6 monthly installments of 1,250 (500 interest), first one 5 Oct.
  const paylater: Account = { ...account("p", 20000), kind: "credit", dueDay: 5 };
  const phone = sub({ kind: "recurring", amount: 1250, cycle: "month", startDate: "2026-10-05", accountId: "p", installments: 6, principal: 7000 });

  it("takes the full price off the limit at purchase", () => {
    expect(creditSummary(paylater, [], [phone], "2026-09-25")).toEqual({ limit: 20000, available: 13000, used: 7000 });
  });

  it("gives an installment's share back once it is charged and paid", () => {
    const charged = [tx({ type: "out", amount: 1250, accountId: "p", date: "2026-10-05" })];
    const paid = [...charged, tx({ type: "move", amount: 1250, fromId: "a", toId: "p", date: "2026-10-05" })];
    expect(creditSummary(paylater, charged, [phone], "2026-10-05").available).toBeCloseTo(20000 - 1250 - 7000 * (5 / 6), 2);
    expect(creditSummary(paylater, paid, [phone], "2026-10-05").available).toBeCloseTo(20000 - 7000 * (5 / 6), 2);
  });

  it("puts installments due by the due date into the bill", () => {
    const shopping = [tx({ type: "out", amount: 300, accountId: "p", date: "2026-09-20" })];
    expect(accountDue(paylater, shopping, "2026-10-01", [phone])).toEqual({ due: "2026-10-05", days: 4, owed: 1550 });
    // Without the plans (old callers) only logged spending counts.
    expect(accountDue(paylater, shopping, "2026-10-01")?.owed).toBe(300);
  });

  it("reports interest and its flat monthly rate", () => {
    expect(planInterest(phone)).toEqual({ total: 500, monthlyPct: 1.19 });
    expect(planInterest({ amount: 1000, installments: 3, principal: 3000 })).toEqual({ total: 0, monthlyPct: 0 });
    expect(planInterest({ amount: 1000, installments: 3, principal: null })).toBeNull();
  });

  it("holds the remaining installments for plans without a price", () => {
    const old = sub({ kind: "recurring", amount: 1000, cycle: "month", startDate: "2026-09-01", accountId: "p", installments: 3 });
    expect(planReserved(old, "2026-09-25")).toBe(2000);
  });
});

describe("deleting an account", () => {
  const a = account("a"), b = account("b");

  it("refuses the last account", () => {
    expect(accountDeleteBlock("a", [a], [], [])).toEqual({ reason: "last" });
  });

  it("refuses an account that transactions or scheduled entries use, counting them", () => {
    const txs = [tx({ type: "out", amount: 1, accountId: "a" }), tx({ type: "move", amount: 1, fromId: "b", toId: "a" })];
    expect(accountDeleteBlock("a", [a, b], txs, [])).toEqual({ reason: "used", transactions: 2, schedules: 0 });
    const saving = sub({ kind: "recurring", entryType: "move", amount: 100, cycle: "month", accountId: "b", toAccountId: "a" });
    expect(accountDeleteBlock("a", [a, b], [], [saving])).toEqual({ reason: "used", transactions: 0, schedules: 1 });
  });

  it("allows an unused account when others remain", () => {
    expect(accountDeleteBlock("b", [a, b], [tx({ type: "out", amount: 1, accountId: "a" })], [])).toBeNull();
  });
});

describe("money paid back", () => {
  const base = { id: "x", date: "2026-09-10", title: "", accountId: "a", createdAt: 1 };
  it("lowers spending instead of adding income", () => {
    const txs = [
      { ...base, type: "out" as const, amount: 1200, category: "food" },
      { ...base, type: "in" as const, amount: 900, category: "repay" },
      { ...base, type: "in" as const, amount: 30000, category: "salary" },
    ];
    expect(summarize(txs)).toEqual({ income: 30000, expense: 300, moved: 0, net: 29700 });
  });
  it("never shows negative spending", () => {
    expect(summarize([{ ...base, type: "in" as const, amount: 500, category: "repay" }]).expense).toBe(0);
  });
});
