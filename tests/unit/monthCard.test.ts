import { describe, expect, it } from "vitest";
import { cardBaht, cardPct, monthCard } from "@/lib/monthCard";
import type { Transaction, Wish } from "@/lib/types";
import { periodFor } from "@/lib/period";

/** A calendar month as a period (start day 1). */
const cal = (key: string) => periodFor(key, 1);

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, type: "out", amount: 100, date: "2026-09-10", title: "", category: "food", accountId: "a", createdAt: n, ...p,
});
const wish = (p: Partial<Wish>): Wish => ({
  id: `w${n++}`, name: "", price: 1000, note: "", decideOn: "2026-09-01", status: "skipped", decidedOn: "2026-09-05", transactionId: null, createdAt: n, ...p,
});

describe("month summary card", () => {
  const txs = [
    tx({ type: "in", category: "salary", amount: 40000 }),
    tx({ amount: 12000, category: "food" }),
    tx({ amount: 8000, category: "travel" }),
    tx({ amount: 5000, category: "food", date: "2026-08-30" }),
  ];

  it("sums the month, the share kept and the top category", () => {
    const c = monthCard(txs, [], cal("2026-09"))!;
    expect(c).toMatchObject({ income: 40000, expense: 20000, net: 20000, keptPct: 0.5, spentPct: 0.5 });
    expect(c.top).toEqual({ key: "food", amount: 12000, share: 0.6 });
  });

  it("counts wishlist items skipped that month", () => {
    const wishes = [wish({}), wish({ price: 2500 }), wish({ decidedOn: "2026-08-20" }), wish({ status: "bought" })];
    expect(monthCard(txs, wishes, cal("2026-09"))!.heldBack).toEqual({ amount: 3500, count: 2 });
  });

  it("has no percentages without income, and nothing for an empty month", () => {
    const c = monthCard([tx({})], [], cal("2026-09"))!;
    expect(c.keptPct).toBeNull();
    expect(c.spentPct).toBeNull();
    expect(monthCard(txs, [], cal("2026-07"))).toBeNull();
  });

  it("formats whole baht and percentages without signs", () => {
    expect(cardBaht(-12340.6)).toBe("฿12,341");
    expect(cardPct(-0.004)).toBe("0%");
    expect(cardPct(0.234)).toBe("23%");
  });
});
