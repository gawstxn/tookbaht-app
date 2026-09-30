import { addDays, diffDays, stepCycle } from "./format";
import type { ISODate, Subscription } from "./types";

/*
 * Free trials. A trial is the stretch before a service's first charge:
 * `startDate` stays the first billing date (so charges, reminders and
 * forecasts work unchanged) and `trialFrom` is the day the free period began.
 * Mirrors the trial parts of the subscription_trials migration.
 */

/** How many days before a trial ends the app asks whether it's still wanted. */
export const TRIAL_NOTICE_DAYS = 3;

export type TrialLength = "7d" | "1m" | "3m" | "1y";
export const TRIAL_LENGTHS: TrialLength[] = ["7d", "1m", "3m", "1y"];

/** The day a trial of `length` begun on `from` ends: its first charge (month ends clamp like billing dates). */
export function trialEnd(from: ISODate, length: TrialLength): ISODate {
  if (length === "7d") return addDays(from, 7);
  if (length === "1y") return stepCycle(from, "year", 1);
  return stepCycle(from, "month", length === "1m" ? 1 : 3);
}

/** Which preset a trial matches, or null for a custom end date. */
export function trialLengthOf(from: ISODate, end: ISODate): TrialLength | null {
  return TRIAL_LENGTHS.find((l) => trialEnd(from, l) === end) ?? null;
}

/** Days of the trial left on `today` (0 on the day it ends), or null when not in a trial. */
export function trialDaysLeft(s: Pick<Subscription, "trialFrom" | "startDate">, today: ISODate): number | null {
  if (!s.trialFrom || today >= s.startDate) return null;
  return diffDays(s.startDate, today);
}

export const inTrial = (s: Pick<Subscription, "trialFrom" | "startDate">, today: ISODate) => trialDaysLeft(s, today) !== null;

/** The day the "still want it?" review is brought up: a few days before the trial ends. */
export const trialNoticeDay = (end: ISODate) => addDays(end, -TRIAL_NOTICE_DAYS);
