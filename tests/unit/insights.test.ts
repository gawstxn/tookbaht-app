import { describe, expect, it } from "vitest";
import { categoryBreakdown, compact, monthlySeries, niceTicks } from "@/lib/insights";
import type { Transaction } from "@/lib/types";

let n = 0;
const tx = (type: Transaction["type"], amount: number, date: string, category?: string): Transaction => ({
  id: `t${n++}`, type, amount, date, title: "", category, accountId: type === "move" ? undefined : "a", fromId: type === "move" ? "a" : undefined, toId: type === "move" ? "b" : undefined, createdAt: 0,
});

const txs = [
  tx("in", 45000, "2026-09-01", "salary"),
  tx("out", 8500, "2026-09-03", "bill"),
  tx("out", 1500, "2026-09-10", "food"),
  tx("move", 5000, "2026-09-02"),
  tx("in", 45000, "2026-07-01", "salary"),
  tx("out", 2000, "2026-04-30", "food"),
  tx("out", 999, "2026-03-31", "food"),
];

describe("insights", () => {
  it("builds six months of income and expense, oldest first, without transfers", () => {
    expect(monthlySeries(txs, "2026-09")).toEqual([
      { month: "2026-04", income: 0, expense: 2000 },
      { month: "2026-05", income: 0, expense: 0 },
      { month: "2026-06", income: 0, expense: 0 },
      { month: "2026-07", income: 45000, expense: 0 },
      { month: "2026-08", income: 0, expense: 0 },
      { month: "2026-09", income: 45000, expense: 10000 },
    ]);
  });

  it("crosses year boundaries", () => {
    expect(monthlySeries([], "2026-02", 3).map((m) => m.month)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("ranks a month's spending by category with shares", () => {
    expect(categoryBreakdown(txs, "2026-09")).toEqual([
      { key: "bill", amount: 8500, share: 0.85 },
      { key: "food", amount: 1500, share: 0.15 },
    ]);
    expect(categoryBreakdown(txs, "2026-05")).toEqual([]);
  });

  it("picks clean axis ticks", () => {
    expect(niceTicks(45000)).toEqual([0, 20000, 40000, 60000]);
    expect(niceTicks(10000)).toEqual([0, 5000, 10000]);
    expect(niceTicks(0)).toEqual([0]);
  });

  it("shortens axis numbers", () => {
    expect([compact(45000), compact(2500), compact(1_250_000), compact(800)]).toEqual(["45K", "2.5K", "1.3M", "800"]);
  });
});
