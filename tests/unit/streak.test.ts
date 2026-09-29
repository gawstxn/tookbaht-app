import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/format";
import { budgetBonus, restoreQuota, streakLogs, streakStatus, tierFor, weekStart, type NoSpend } from "@/lib/streak";
import type { Transaction } from "@/lib/types";

const T = "2026-09-28";
/** Entries made on each of `n` days ending `end` (on time). */
const run = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, -i)).map((d) => ({ at: d, d }));
const status = (logs: { at: string; d: string }[], noSpend: NoSpend[] = [], today = T) => streakStatus({ logs, noSpend, today });

describe("streak", () => {
  it("counts consecutive days and keeps going until today ends", () => {
    expect(status(run(T, 5))).toMatchObject({ current: 5, doneToday: true, missed: [] });
    // Nothing yet today: yesterday's streak still stands.
    expect(status(run(addDays(T, -1), 4))).toMatchObject({ current: 4, doneToday: false, missed: [] });
    expect(status([])).toMatchObject({ current: 0, best: 0, total: 0 });
  });

  it("counts a no-spend day like a logged one", () => {
    const logs = run(addDays(T, -1), 3);
    expect(status(logs, [{ d: T, at: T }])).toMatchObject({ current: 4, doneToday: true });
  });

  it("holds the streak while a missed day can still be restored, and restores it with a late entry", () => {
    const logs = run(addDays(T, -2), 10);
    const held = status([...logs, { at: T, d: T }]);
    expect(held).toMatchObject({ current: 11, missed: [addDays(T, -1)], quotaLeft: 1 });

    const back = status([...logs, { at: T, d: T }, { at: T, d: addDays(T, -1) }]);
    expect(back).toMatchObject({ current: 12, missed: [], quotaLeft: 0 });
    expect(back.restored.has(addDays(T, -1))).toBe(true);
  });

  it("restores with a no-spend confirmation for the missed day", () => {
    const logs = run(addDays(T, -2), 10);
    expect(status(logs, [{ d: addDays(T, -1), at: T }])).toMatchObject({ current: 11, missed: [] });
  });

  it("breaks once the restore window has passed", () => {
    const logs = run(addDays(T, -4), 10);
    // Missed T-3 (too old to restore) and T-2, T-1.
    expect(status([...logs, { at: T, d: T }])).toMatchObject({ current: 1, best: 10, missed: [] });
    // A late entry after the window doesn't bring it back.
    expect(status([...logs, { at: T, d: addDays(T, -3) }]).current).toBe(1);
  });

  it("allows one restore a month under 30 days, two from 30, three from 100", () => {
    expect([restoreQuota(29), restoreQuota(30), restoreQuota(99), restoreQuota(100)]).toEqual([1, 2, 2, 3]);
    // Short streak: a second miss in the same month breaks it.
    const logs = [...run("2026-09-10", 5), { at: "2026-09-12", d: "2026-09-11" }, ...run("2026-09-20", 8), { at: "2026-09-22", d: "2026-09-21" }, ...run("2026-09-25", 3)];
    expect(status(logs, [], "2026-09-25")).toMatchObject({ current: 4 });
  });

  it("starts a new month with a fresh quota", () => {
    const logs = [...run("2026-08-30", 5), { at: "2026-09-01", d: "2026-08-31" }, ...run("2026-09-03", 3), { at: "2026-09-05", d: "2026-09-04" }, ...run("2026-09-05", 1)];
    expect(status(logs, [], "2026-09-05")).toMatchObject({ current: 11 });
  });

  it("counts total days on time and restored for the tier", () => {
    const logs = run(addDays(T, -2), 10);
    expect(status([...logs, { at: T, d: addDays(T, -1) }]).total).toBe(12);
  });

  it("ignores auto-logged charges", () => {
    const tx = (p: Partial<Transaction>) => ({ id: "x", type: "out", amount: 1, title: "", category: "food", accountId: "a", date: T, createdAt: new Date(2026, 8, 28, 9).getTime(), ...p }) as Transaction;
    expect(streakLogs([tx({}), tx({ subscriptionId: "s" })])).toEqual([{ at: T, d: T }]);
  });
});

describe("perfect weeks", () => {
  // 2026-09-27 is a Sunday.
  it("starts weeks on Sunday", () => {
    expect(weekStart("2026-09-29")).toBe("2026-09-27");
    expect(weekStart("2026-09-27")).toBe("2026-09-27");
    expect(status([], [], "2026-09-29").week).toEqual(["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("counts a week with every day logged on the day, no-spend days included", () => {
    const logs = run("2026-09-25", 6); // Sun 20 – Fri 25
    expect(status(logs, [], "2026-09-26").perfectWeeks.size).toBe(0);
    const s = status(logs, [{ d: "2026-09-26", at: "2026-09-26" }], "2026-09-26");
    expect([...s.perfectWeeks]).toEqual(["2026-09-20"]);
  });

  it("doesn't count a week with a restored day", () => {
    const logs = [...run("2026-09-22", 3), { at: "2026-09-24", d: "2026-09-23" }, ...run("2026-09-26", 3)];
    const s = status(logs, [], "2026-09-26");
    expect(s.restored.has("2026-09-23")).toBe(true);
    expect(s.perfectWeeks.size).toBe(0);
  });
});

describe("budget bonus", () => {
  const tx = (date: string, amount: number, p: Partial<Transaction> = {}) => ({ id: date + amount, type: "out", amount, title: "", category: "food", accountId: "a", date, ...p }) as Transaction;

  it("gives the month after one kept within the overall budget an extra restore", () => {
    const txs = [tx("2026-07-05", 900), tx("2026-08-05", 1200), tx("2026-09-05", 100)];
    expect([...budgetBonus(1000, txs, 1, "2026-09-28")]).toEqual(["2026-08"]);
    // No overall budget, no bonus; the month in progress earns nothing yet.
    expect(budgetBonus(0, txs, 1, "2026-09-28").size).toBe(0);
    expect(budgetBonus(5000, txs, 1, "2026-09-28")).toEqual(new Set(["2026-08", "2026-09"]));
  });

  it("follows the payday month", () => {
    // Start day 25: "2026-09" runs 25 Aug – 24 Sep.
    const txs = [tx("2026-08-26", 500), tx("2026-09-20", 400)];
    expect([...budgetBonus(1000, txs, 25, "2026-09-28")]).toEqual(["2026-10"]);
  });

  it("allows one more restore in a bonus month", () => {
    // Short streak: two misses in September would break it, unless September has a bonus.
    const logs = [...run("2026-09-10", 5), { at: "2026-09-12", d: "2026-09-11" }, ...run("2026-09-20", 8), { at: "2026-09-22", d: "2026-09-21" }, ...run("2026-09-25", 3)];
    expect(streakStatus({ logs, noSpend: [], today: "2026-09-25", bonus: new Set(["2026-09"]) })).toMatchObject({ current: 20, quota: 2, quotaLeft: 0, bonus: true });
  });
});

describe("tiers", () => {
  it("climbs with counted days", () => {
    expect(tierFor(0)).toMatchObject({ tier: { key: "coin" }, next: { key: "note", days: 7 } });
    expect(tierFor(30).tier.key).toBe("wad");
    expect(tierFor(400)).toMatchObject({ tier: { key: "safe" }, next: null });
  });
});
