import { describe, expect, it } from "vitest";
import { endOfMonth, monthsUntil, savingsProgress } from "@/lib/savings";

const goal = { target: 40000, saved: 10000, deadline: "2027-03-31", accountId: null };

describe("savings goals", () => {
  it("counts months including this one and the deadline's", () => {
    expect(monthsUntil("2027-03-31", "2026-09-26")).toBe(7);
    expect(monthsUntil("2026-09-30", "2026-09-26")).toBe(1);
    expect(monthsUntil("2026-09-01", "2026-09-26")).toBe(0);
  });

  it("works out the monthly amount to reach the target", () => {
    const p = savingsProgress(goal, "2026-09-26");
    expect(p).toMatchObject({ saved: 10000, left: 30000, months: 7, perMonth: 4286, done: false, overdue: false });
    expect(p.pct).toBe(0.25);
  });

  it("uses the linked account's balance", () => {
    expect(savingsProgress({ ...goal, accountId: "save" }, "2026-09-26", 25000).saved).toBe(25000);
    expect(savingsProgress({ ...goal, accountId: "save" }, "2026-09-26", -500).saved).toBe(0);
  });

  it("is done once the target is reached", () => {
    expect(savingsProgress({ ...goal, saved: 45000 }, "2026-09-26")).toMatchObject({ pct: 1, left: 0, done: true, perMonth: null });
  });

  it("flags a missed deadline and asks for the rest now", () => {
    expect(savingsProgress(goal, "2027-04-02")).toMatchObject({ overdue: true, months: 0, perMonth: 30000 });
  });

  it("has no monthly amount without a deadline", () => {
    expect(savingsProgress({ ...goal, deadline: null }, "2026-09-26")).toMatchObject({ months: null, perMonth: null });
  });

  it("finds the end of a month", () => {
    expect(endOfMonth("2027-02")).toBe("2027-02-28");
    expect(endOfMonth("2028-02")).toBe("2028-02-29");
    expect(endOfMonth("2027-03")).toBe("2027-03-31");
  });
});
