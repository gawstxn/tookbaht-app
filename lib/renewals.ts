import { addDays, diffDays, monthlyEquivalent } from "./format";
import { chargesSoFar, isService, nextCharge } from "./selectors";
import { TRIAL_NOTICE_DAYS, trialNoticeDay } from "./trial";
import type { Currency, Cycle, Subscription, Transaction } from "./types";

/** How many days before a yearly renewal the app asks whether it's still used. */
export const RENEW_NOTICE_DAYS = 7;

export interface Renewal {
  sub: Subscription;
  due: string;
  /** Days until it renews (1…RENEW_NOTICE_DAYS, or 1…TRIAL_NOTICE_DAYS when a trial ends). */
  days: number;
  /** The first charge after a free trial rather than a yearly renewal. */
  trial: boolean;
}

/**
 * A yearly service (not salary, rent or an installment plan) renewing in the
 * next week, or a free trial of any cycle ending in the next few days, early
 * enough to cancel with the provider. The day before is left to the usual
 * "bills tomorrow" reminder.
 */
export function upcomingRenewal(s: Subscription, today: string): Renewal | null {
  if (!isService(s) || s.paused) return null;
  const next = nextCharge(s, today);
  if (!next) return null;
  const days = diffDays(next.due, today);
  const trial = !!s.trialFrom && next.n === 1;
  if (!trial && s.cycle !== "year") return null;
  return days >= 1 && days <= (trial ? TRIAL_NOTICE_DAYS : RENEW_NOTICE_DAYS) ? { sub: s, due: next.due, days, trial } : null;
}

export function upcomingRenewals(subs: Subscription[], today: string): Renewal[] {
  return subs.flatMap((s) => upcomingRenewal(s, today) ?? []).sort((a, b) => a.due.localeCompare(b.due));
}

/** The notification (and review card) for one renewal; read once the user answers it. */
export const renewalNotifId = (r: Pick<Renewal, "sub" | "due">) => `renew:${r.sub.id}:${r.due}`;
/** The day the review is brought up. */
export const renewalNoticeDay = (r: Pick<Renewal, "due" | "trial">) => (r.trial ? trialNoticeDay(r.due) : addDays(r.due, -RENEW_NOTICE_DAYS));

/** A year of the price, in the subscription's own currency. */
export const yearlyCost = (amount: number, cycle: Cycle) => monthlyEquivalent(amount, cycle) * 12;

/**
 * What a service has cost so far. Charges the database logged are real baht
 * amounts; without any, it's the charges due so far times the price.
 */
export function spentSoFar(
  s: Pick<Subscription, "id" | "amount" | "currency" | "startDate" | "cycle" | "installments">,
  txs: Transaction[],
  today: string,
): { amount: number; currency: Currency; count: number } {
  const logged = txs.filter((t) => t.subscriptionId === s.id && t.date <= today);
  if (logged.length) return { amount: logged.reduce((a, t) => a + t.amount, 0), currency: "THB", count: logged.length };
  const count = chargesSoFar(s, today);
  return { amount: count * s.amount, currency: s.currency, count };
}
