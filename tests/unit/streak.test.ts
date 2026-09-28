import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/format";
import { restoreQuota, streakLogs, streakStatus, tierFor, type NoSpend } from "@/lib/streak";
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

describe("tiers", () => {
  it("climbs with counted days", () => {
    expect(tierFor(0)).toMatchObject({ tier: { key: "coin" }, next: { key: "note", days: 7 } });
    expect(tierFor(30).tier.key).toBe("note50");
    expect(tierFor(400)).toMatchObject({ tier: { key: "safe" }, next: null });
  });
});
