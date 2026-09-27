import { describe, expect, it } from "vitest";
import { taxYear, taxYears } from "@/lib/tax";
import type { Transaction } from "@/lib/types";

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({ id: `t${++seq}`, type: "out", amount: 1000, date: "2026-03-01", title: "x", category: "other", accountId: "a", createdAt: seq, ...p });

describe("tax deductions", () => {
  it("totals marked expenses per kind for the year, in a fixed order", () => {
    const y = taxYear([
      tx({ taxType: "rmf", amount: 50000 }),
      tx({ taxType: "life", amount: 30000 }),
      tx({ taxType: "life", amount: 20000, date: "2026-09-01" }),
      tx({ taxType: "life", amount: 99999, date: "2025-12-31" }),
      tx({ amount: 500 }),
      tx({ type: "in", taxType: "rmf", amount: 1 }),
    ], "2026");
    expect(y.lines.map((l) => [l.key, l.amount, l.cap, l.items.length])).toEqual([
      ["life", 50000, 100000, 2],
      ["rmf", 50000, undefined, 1],
    ]);
    expect(y.total).toBe(100000);
    expect(y.lines[0].items[0].date).toBe("2026-09-01");
  });

  it("warns when life and health insurance together pass 100,000", () => {
    expect(taxYear([tx({ taxType: "life", amount: 90000 }), tx({ taxType: "health", amount: 25000 })], "2026").lifeHealthOver).toBe(15000);
    expect(taxYear([tx({ taxType: "life", amount: 70000 }), tx({ taxType: "health", amount: 40000 })], "2026").lifeHealthOver).toBe(0);
  });

  it("lists years with marked expenses plus the current one", () => {
    expect(taxYears([tx({ taxType: "rmf", date: "2024-05-01" }), tx({ date: "2023-01-01" })], "2026")).toEqual(["2026", "2024"]);
  });
});
