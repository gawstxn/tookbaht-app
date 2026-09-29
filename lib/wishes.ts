import { diffDays } from "./format";
import { inPeriod, type Period } from "./period";
import type { Wish } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Money not spent: wishes the user decided against, in a calendar year ("2026") or one of the user's months. */
export function heldBack(wishes: Wish[], when: string | Period): { amount: number; count: number } {
  const within = (d: string) => (typeof when === "string" ? d.startsWith(when) : inPeriod(d, when));
  const skipped = wishes.filter((w) => w.status === "skipped" && !!w.decidedOn && within(w.decidedOn));
  return { amount: round2(skipped.reduce((a, w) => a + w.price, 0)), count: skipped.length };
}

/** Days until the day to decide (0 or less: time to decide). */
export const daysToDecide = (w: Wish, today: string) => diffDays(w.decideOn, today);

/** Waiting ones first by the day to decide, then decided ones newest first. */
export function sortWishes(wishes: Wish[]): { waiting: Wish[]; decided: Wish[] } {
  const waiting = wishes.filter((w) => w.status === "waiting").sort((a, b) => a.decideOn.localeCompare(b.decideOn) || a.createdAt - b.createdAt);
  const decided = wishes
    .filter((w) => w.status !== "waiting")
    .sort((a, b) => (b.decidedOn ?? "").localeCompare(a.decidedOn ?? "") || b.createdAt - a.createdAt);
  return { waiting, decided };
}
