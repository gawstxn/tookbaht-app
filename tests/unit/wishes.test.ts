import { describe, expect, it } from "vitest";
import { daysToDecide, heldBack, sortWishes } from "@/lib/wishes";
import type { Wish } from "@/lib/types";

let seq = 0;
const wish = (p: Partial<Wish>): Wish => ({ id: `w${++seq}`, name: "หูฟัง", price: 3990, note: "", decideOn: "2026-10-06", status: "waiting", decidedOn: null, transactionId: null, createdAt: seq, ...p });

describe("wishlist", () => {
  it("adds up what the user decided not to buy in a year", () => {
    const list = [
      wish({ status: "skipped", decidedOn: "2026-02-01", price: 1200 }),
      wish({ status: "skipped", decidedOn: "2026-09-30", price: 799.5 }),
      wish({ status: "skipped", decidedOn: "2025-12-31", price: 5000 }),
      wish({ status: "bought", decidedOn: "2026-05-01" }),
      wish({}),
    ];
    expect(heldBack(list, "2026")).toEqual({ amount: 1999.5, count: 2 });
  });

  it("counts the days left to decide", () => {
    expect(daysToDecide(wish({ decideOn: "2026-10-06" }), "2026-09-29")).toBe(7);
    expect(daysToDecide(wish({ decideOn: "2026-10-06" }), "2026-10-08")).toBe(-2);
  });

  it("lists waiting ones by the day to decide, then decided ones newest first", () => {
    const a = wish({ decideOn: "2026-10-10" });
    const b = wish({ decideOn: "2026-10-01" });
    const c = wish({ status: "bought", decidedOn: "2026-09-01" });
    const d = wish({ status: "skipped", decidedOn: "2026-09-20" });
    expect(sortWishes([a, b, c, d])).toEqual({ waiting: [b, a], decided: [d, c] });
  });
});
