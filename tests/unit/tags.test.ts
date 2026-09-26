import { describe, expect, it } from "vitest";
import { debtsByPerson, owedTotal } from "@/lib/ious";
import { knownTags, tagSummaries } from "@/lib/tags";
import type { Iou, Transaction } from "@/lib/types";

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({ id: `t${++n}`, type: "out", amount: 100, date: "2026-09-10", title: "", category: "food", accountId: "a", createdAt: n, ...p });

describe("tags", () => {
  it("totals each tag with its date span, most recent first", () => {
    const txs = [
      tx({ tag: "เที่ยวญี่ปุ่น", amount: 5000, date: "2026-09-02" }),
      tx({ tag: "เที่ยวญี่ปุ่น", amount: 1200, date: "2026-09-05" }),
      tx({ tag: "งานแต่งเพื่อน", amount: 2000, date: "2026-08-20" }),
      tx({ amount: 99 }),
    ];
    expect(tagSummaries(txs)).toEqual([
      { tag: "เที่ยวญี่ปุ่น", spent: 6200, income: 0, count: 2, from: "2026-09-02", to: "2026-09-05" },
      { tag: "งานแต่งเพื่อน", spent: 2000, income: 0, count: 1, from: "2026-08-20", to: "2026-08-20" },
    ]);
  });

  it("suggests tags used most recently", () => {
    expect(knownTags([tx({ tag: "A" }), tx({ tag: "B" }), tx({ tag: "A" })])).toEqual(["A", "B"]);
  });
});

describe("debts in both directions", () => {
  const iou = (p: Partial<Iou>): Iou => ({ id: `i${++n}`, person: "บอส", amount: 100, note: "", date: "2026-09-10", createdAt: n, ...p });
  const list = [iou({}), iou({ person: "มิ้นท์", amount: 250, direction: "i_owe" }), iou({ direction: "owed_to_me", amount: 50 })];

  it("keeps what friends owe apart from what the user owes", () => {
    expect(owedTotal(list)).toBe(150);
    expect(owedTotal(list, "i_owe")).toBe(250);
    expect(debtsByPerson(list, "i_owe").map((d) => [d.person, d.total])).toEqual([["มิ้นท์", 250]]);
  });
});
