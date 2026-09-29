import { describe, expect, it } from "vitest";
import { recurringCandidates, runway, unusualCategories } from "@/lib/habits";
import type { Account, Subscription, Transaction } from "@/lib/types";
import { periodFor } from "@/lib/period";

/** A calendar month as a period (start day 1). */
const cal = (key: string) => periodFor(key, 1);

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({ id: `t${++seq}`, type: "out", amount: 100, date: "2026-09-01", title: "x", category: "food", accountId: "a1", createdAt: seq, ...p });
const acc = (p: Partial<Account>): Account => ({ id: "a1", name: "Bank", kind: "bank", openingBalance: 0, mono: "B", tone: "#000", fxFeePct: 0, ...p });
const TODAY = "2026-09-20";

describe("bills paid by hand every month", () => {
  const rent = (date: string, amount = 6500) => tx({ title: "ค่าหอ", amount, date, category: "bill" });

  it("finds an expense paid once a month for three months running", () => {
    const c = recurringCandidates([rent("2026-07-03"), rent("2026-08-02"), rent("2026-09-04")], [], TODAY);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ title: "ค่าหอ", amount: 6500, day: 3, next: "2026-10-03", months: 3, category: "bill" });
  });

  it("allows the latest one to be last month", () => {
    expect(recurringCandidates([rent("2026-06-03"), rent("2026-07-03"), rent("2026-08-03")], [], TODAY)).toHaveLength(1);
    expect(recurringCandidates([rent("2026-05-03"), rent("2026-06-03"), rent("2026-07-03")], [], TODAY)).toEqual([]);
  });

  it("skips habits, gaps, drifting days, known subscriptions and dismissed ones", () => {
    const coffee = ["2026-07-01", "2026-07-15", "2026-08-01", "2026-09-01"].map((date) => tx({ title: "กาแฟ", amount: 65, date }));
    expect(recurringCandidates(coffee, [], TODAY)).toEqual([]);
    expect(recurringCandidates([rent("2026-06-03"), rent("2026-08-03"), rent("2026-09-03")], [], TODAY)).toEqual([]);
    expect(recurringCandidates([rent("2026-07-01"), rent("2026-08-15"), rent("2026-09-03")], [], TODAY)).toEqual([]);
    const three = [rent("2026-07-03"), rent("2026-08-03"), rent("2026-09-03")];
    expect(recurringCandidates(three, [{ name: " ค่าหอ" } as Subscription], TODAY)).toEqual([]);
    expect(recurringCandidates(three, [], TODAY, ["ค่าหอ|6500"])).toEqual([]);
    // A different amount is a different bill.
    expect(recurringCandidates([rent("2026-07-03"), rent("2026-08-03", 7000), rent("2026-09-03")], [], TODAY)).toEqual([]);
  });

  it("ignores auto-logged charges", () => {
    const auto = ["2026-07-03", "2026-08-03", "2026-09-03"].map((date) => tx({ title: "Netflix", amount: 419, date, subscriptionId: "s1" }));
    expect(recurringCandidates(auto, [], TODAY)).toEqual([]);
  });
});

describe("how long savings last", () => {
  it("divides money on hand by average monthly spending of the last full months", () => {
    const txs = [tx({ amount: 20000, date: "2026-06-10" }), tx({ amount: 10000, date: "2026-07-10" }), tx({ amount: 30000, date: "2026-08-10" }), tx({ amount: 99999, date: "2026-09-10" })];
    const r = runway([acc({ openingBalance: 200000 }), acc({ id: "c1", kind: "credit", openingBalance: 50000 })], txs, TODAY)!;
    // 200,000 − all four expenses (they're on a1) = 40,001 on hand; average of Jun–Aug = 20,000.
    expect(r).toEqual({ cash: 40001, monthly: 20000, months: 2, basis: 3 });
  });

  it("needs spending history and money on hand", () => {
    expect(runway([acc({ openingBalance: 1000 })], [], TODAY)).toBeNull();
    expect(runway([acc({ openingBalance: 0 })], [tx({ amount: 500, date: "2026-08-10" })], TODAY)).toBeNull();
  });
});

describe("categories above usual", () => {
  const hist = [tx({ amount: 3000, date: "2026-06-05" }), tx({ amount: 3000, date: "2026-07-05" }), tx({ amount: 3000, date: "2026-08-05" })];

  it("compares with the earlier months scaled to the days gone", () => {
    // 20 of 30 days → usual so far 2,000; spent 3,000 = 50% more.
    const u = unusualCategories([...hist, tx({ amount: 3000, date: "2026-09-12" })], cal("2026-09"), TODAY);
    expect(u).toEqual([{ key: "food", spent: 3000, usual: 2000, over: 0.5 }]);
  });

  it("stays quiet for small or early differences and thin history", () => {
    expect(unusualCategories([...hist, tx({ amount: 2200, date: "2026-09-12" })], cal("2026-09"), TODAY)).toEqual([]);
    expect(unusualCategories([...hist, tx({ amount: 3000, date: "2026-09-02" })], cal("2026-09"), "2026-09-05")).toEqual([]);
    expect(unusualCategories([hist[2], tx({ amount: 9000, date: "2026-09-12" })], cal("2026-09"), TODAY)).toEqual([]);
  });

  it("uses the whole month for past months", () => {
    const u = unusualCategories([tx({ amount: 1000, date: "2026-05-05" }), ...hist, tx({ amount: 5000, date: "2026-08-20" })], cal("2026-08"), TODAY);
    // Aug = 3,000 + 5,000 against the May–Jul average of (1,000 + 3,000 + 3,000) / 3.
    expect(u[0]).toMatchObject({ key: "food", spent: 8000, usual: 2333.33 });
  });
});
