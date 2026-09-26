import { describe, expect, it } from "vitest";
import { entryDefaults, quickEntries, recentDuplicate } from "@/lib/quick";
import type { Transaction } from "@/lib/types";

let seq = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
  type: "out",
  amount: 65,
  date: "2026-09-20",
  title: "กาแฟ",
  category: "food",
  accountId: "cash",
  createdAt: seq,
  ...p,
});
const ACCOUNTS = ["cash", "bank", "save"];

describe("quick entries", () => {
  it("suggests entries repeated at least three times, most frequent first", () => {
    const txs = [
      ...[1, 2, 3].map(() => tx({})),
      ...[1, 2, 3, 4].map(() => tx({ title: "ข้าวมันไก่", amount: 50 })),
      tx({ title: "หนังสือ", amount: 300, category: "shop" }),
    ];
    const q = quickEntries(txs, ACCOUNTS, "2026-09-26");
    expect(q.map((x) => [x.sample.title, x.count])).toEqual([
      ["ข้าวมันไก่", 4],
      ["กาแฟ", 3],
    ]);
  });

  it("treats a different amount or account as a different entry", () => {
    const txs = [tx({}), tx({}), tx({ amount: 70 }), tx({ accountId: "bank" })];
    expect(quickEntries(txs, ACCOUNTS, "2026-09-26")).toEqual([]);
  });

  it("ignores old entries, subscriptions, transfers and deleted accounts", () => {
    const txs = [
      ...[1, 2, 3].map(() => tx({ date: "2026-06-01" })),
      ...[1, 2, 3].map(() => tx({ subscriptionId: "s1", title: "Netflix" })),
      ...[1, 2, 3].map(() => tx({ type: "move", accountId: undefined, fromId: "bank", toId: "save", title: "ออม" })),
      ...[1, 2, 3].map(() => tx({ accountId: "gone" })),
    ];
    expect(quickEntries(txs, ACCOUNTS, "2026-09-26")).toEqual([]);
  });

  it("copies the latest entry of the group", () => {
    const txs = [tx({ note: "old" }), tx({}), tx({ note: "latest" })];
    expect(quickEntries(txs, ACCOUNTS, "2026-09-26")[0].sample.note).toBe("latest");
  });
});

describe("entry defaults", () => {
  it("picks the most used category and account for the type", () => {
    const txs = [tx({ category: "travel", accountId: "bank" }), tx({}), tx({}), tx({ type: "in", category: "salary", accountId: "bank" })];
    expect(entryDefaults(txs, "out", ACCOUNTS)).toEqual({ category: "food", accountId: "cash" });
    expect(entryDefaults(txs, "in", ACCOUNTS)).toEqual({ category: "salary", accountId: "bank" });
  });

  it("breaks ties with the most recent", () => {
    const txs = [tx({ category: "food" }), tx({ category: "travel" })];
    expect(entryDefaults(txs, "out", ACCOUNTS).category).toBe("travel");
  });

  it("remembers the usual transfer route", () => {
    const txs = [
      tx({ type: "move", accountId: undefined, category: undefined, fromId: "bank", toId: "save" }),
      tx({ type: "move", accountId: undefined, category: undefined, fromId: "bank", toId: "save" }),
      tx({ type: "move", accountId: undefined, category: undefined, fromId: "cash", toId: "bank" }),
    ];
    expect(entryDefaults(txs, "move", ACCOUNTS)).toEqual({ fromId: "bank", toId: "save" });
  });

  it("returns nothing without history and skips subscription charges", () => {
    expect(entryDefaults([], "out", ACCOUNTS)).toEqual({ category: undefined, accountId: undefined });
    expect(entryDefaults([tx({ category: "sub", subscriptionId: "s" })], "out", ACCOUNTS)).toEqual({ category: undefined, accountId: undefined });
  });
});

describe("double taps", () => {
  const now = 1_000_000_000;
  const entry = { type: "out" as const, amount: 65, date: "2026-09-20", category: "food", accountId: "cash" };

  it("finds the same entry saved minutes ago", () => {
    const dup = tx({ createdAt: now - 60_000 });
    expect(recentDuplicate([dup], entry, now)?.id).toBe(dup.id);
  });

  it("ignores older, different or auto-logged entries", () => {
    expect(recentDuplicate([tx({ createdAt: now - 20 * 60_000 })], entry, now)).toBeUndefined();
    expect(recentDuplicate([tx({ createdAt: now, amount: 70 })], entry, now)).toBeUndefined();
    expect(recentDuplicate([tx({ createdAt: now, accountId: "bank" })], entry, now)).toBeUndefined();
    expect(recentDuplicate([tx({ createdAt: now, subscriptionId: "s" })], entry, now)).toBeUndefined();
  });
});
