import { describe, expect, it } from "vitest";
import { buildNotifications } from "@/lib/notifications";
import { spentSoFar, upcomingRenewal, upcomingRenewals, yearlyCost } from "@/lib/renewals";
import type { Goals, Subscription, Transaction } from "@/lib/types";

const sub = (p: Partial<Subscription> = {}): Subscription => ({
  id: "s1", kind: "subscription", entryType: "out", name: "Cloudflare", amount: 350, currency: "THB", cycle: "year",
  startDate: "2025-10-05", accountId: "a", category: "work", remind: true, autoLog: false, paused: false, tone: "#000", ...p,
});
const goals: Goals = { incomeTarget: 0, expenseBudget: 0, categoryBudgets: {}, alertAt80: true };

describe("yearly renewals", () => {
  it("comes up 7 days to 1 day before a yearly service renews", () => {
    expect(upcomingRenewal(sub(), "2026-09-27")).toBeNull();
    expect(upcomingRenewal(sub(), "2026-09-28")).toMatchObject({ due: "2026-10-05", days: 7 });
    expect(upcomingRenewal(sub(), "2026-10-04")).toMatchObject({ days: 1 });
    // On the day it has already renewed; next year's is far off.
    expect(upcomingRenewal(sub(), "2026-10-05")).toBeNull();
  });

  it("skips monthly services, paused ones and recurring entries", () => {
    const today = "2026-09-30";
    expect(upcomingRenewal(sub({ cycle: "month", startDate: "2026-09-05" }), today)).toBeNull();
    expect(upcomingRenewal(sub({ paused: true }), today)).toBeNull();
    expect(upcomingRenewal(sub({ kind: "recurring", name: "ประกันรถ" }), today)).toBeNull();
    expect(upcomingRenewals([sub({ id: "b", startDate: "2025-10-06" }), sub()], today).map((r) => r.sub.id)).toEqual(["s1", "b"]);
  });

  it("shows in the notification center at 09:00 a week before", () => {
    const list = buildNotifications({ accounts: [], transactions: [], subscriptions: [sub()], goals, today: "2026-09-30", now: Date.parse("2026-09-30T12:00:00Z") });
    const renew = list.find((n) => n.kind === "renew")!;
    expect(renew.id).toBe("renew:s1:2026-10-05");
    expect(renew.href).toBe("/subscriptions/s1");
    expect(new Date(renew.at).getDate()).toBe(28);
  });

  it("works out a year of a weekly or monthly price", () => {
    expect(yearlyCost(419, "month")).toBe(5028);
    expect(yearlyCost(100, "week")).toBe(5200);
    expect(yearlyCost(350, "year")).toBe(350);
  });

  it("adds up what it cost: logged charges, or charges due times the price", () => {
    const monthly = sub({ cycle: "month", startDate: "2026-07-05", amount: 419 });
    expect(spentSoFar(monthly, [], "2026-09-30")).toEqual({ amount: 1257, currency: "THB", count: 3 });
    const tx = (date: string, amount: number): Transaction => ({ id: date, type: "out", amount, date, title: "", accountId: "a", subscriptionId: "s1", createdAt: 1 });
    const usd = sub({ currency: "USD", amount: 10 });
    expect(spentSoFar(usd, [tx("2025-10-05", 360), tx("2026-10-05", 370)], "2026-09-30")).toEqual({ amount: 360, currency: "THB", count: 1 });
    expect(spentSoFar(usd, [], "2026-09-30")).toEqual({ amount: 10, currency: "USD", count: 1 });
  });
});
