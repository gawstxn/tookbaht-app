import { addDays, diffDays, fromISO, shiftMonth, toISO } from "./format";
import { periodOf } from "./period";
import { summarize } from "./selectors";
import type { ISODate, Transaction } from "./types";

/*
 * Logging streak. A day counts when the user logs an entry themselves that
 * day (auto-logged subscription charges don't count) or confirms they spent
 * nothing. A missed day can be restored within RESTORE_WINDOW days by going
 * back and logging that day's entries (or confirming no spending that day),
 * up to a monthly quota that grows with the streak, plus one more in a month
 * that follows a month kept within the overall budget. Months are the user's
 * own (lib/period.ts: payday to payday when set). A calendar week (Sunday to
 * Saturday, as the calendar shows it) with every day logged on the day itself
 * is a perfect week. Everything is derived from the entries and no-spend
 * confirmations, so nothing else is stored.
 */

/** A "spent nothing" confirmation: for day `d`, made on day `at`. */
export interface NoSpend {
  d: ISODate;
  at: ISODate;
}

/** How many days back a missed day can still be restored. */
export const RESTORE_WINDOW = 2;

/** Restores allowed per calendar month, by the streak length when the day was missed. */
export function restoreQuota(streak: number): number {
  return streak >= 100 ? 3 : streak >= 30 ? 2 : 1;
}

/** Streak lengths that get a celebration. */
export const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

/** Tiers: money that grows (the icons), coloured metal to gem so they read as a climb; reached by days counted overall. */
export const TIERS = [
  { key: "coin", days: 0, tone: "#b87333" },
  { key: "note", days: 7, tone: "#8e9aa6" },
  { key: "wad", days: 30, tone: "#c9a227" },
  { key: "stack", days: 100, tone: "#2e9d74" },
  { key: "bag", days: 200, tone: "#3f7fd0" },
  { key: "safe", days: 365, tone: "#9460d6" },
] as const;
export type TierKey = (typeof TIERS)[number]["key"];

/** Tier for a number of counted days, with the next one to reach (null at the top). */
export function tierFor(days: number) {
  let i = 0;
  while (i + 1 < TIERS.length && days >= TIERS[i + 1].days) i++;
  return { tier: TIERS[i], next: TIERS[i + 1] ?? null };
}

/**
 * Months (period keys) that get an extra restore: those right after a month
 * with entries whose spending stayed within the overall budget. Needs an
 * overall budget; the month in progress hasn't earned anything yet.
 */
export function budgetBonus(expenseBudget: number, txs: Transaction[], startDay: number, today: ISODate): Set<string> {
  const out = new Set<string>();
  if (!(expenseBudget > 0)) return out;
  const current = periodOf(today, startDay).key;
  const byMonth = new Map<string, Transaction[]>();
  for (const t of txs) {
    const key = periodOf(t.date, startDay).key;
    if (key >= current) continue;
    const list = byMonth.get(key);
    if (list) list.push(t);
    else byMonth.set(key, [t]);
  }
  for (const [key, list] of byMonth) if (summarize(list).expense <= expenseBudget) out.add(shiftMonth(key, 1));
  return out;
}

/** The Sunday that starts the week holding `d`. */
export function weekStart(d: ISODate): ISODate {
  return addDays(d, -fromISO(d).getDay());
}

export interface StreakInput {
  /** When each entry was made (local day) and the day it is for; manual entries only. */
  logs: { at: ISODate; d: ISODate }[];
  noSpend: NoSpend[];
  today: ISODate;
  /** First day of the user's month (lib/period.ts); 1 when unset. */
  startDay?: number;
  /** Months with an extra restore for keeping the one before within budget (budgetBonus). */
  bonus?: Set<string>;
}

export interface StreakStatus {
  /** Current streak (kept while a missed day can still be restored). */
  current: number;
  best: number;
  /** Days counted overall (on time or restored); drives the tier. */
  total: number;
  /** Today already counts. */
  doneToday: boolean;
  /** Missed days that can still be restored, oldest first. */
  missed: ISODate[];
  /** Latest day that counts (on time or restored), or null. */
  last: ISODate | null;
  /** Restores left this month for the current streak, and the month's allowance. */
  quotaLeft: number;
  quota: number;
  /** This month has an extra restore for keeping last month within budget. */
  bonus: boolean;
  /** Days that count, and which of them were restored (for the calendar). */
  onTime: Set<ISODate>;
  restored: Set<ISODate>;
  /** This week, Sunday to Saturday. */
  week: ISODate[];
  /** Weeks (their Sundays) with every day logged on the day; restored days don't make one. */
  perfectWeeks: Set<ISODate>;
}

/** Manual entries as streak logs: the local day each was made and the day it's for. */
export function streakLogs(txs: Transaction[]): StreakInput["logs"] {
  const out: StreakInput["logs"] = [];
  for (const t of txs) if (!t.subscriptionId && t.createdAt) out.push({ at: toISO(new Date(t.createdAt)), d: t.date });
  return out;
}

export function streakStatus({ logs, noSpend, today, startDay = 1, bonus = new Set() }: StreakInput): StreakStatus {
  const monthOf = (d: ISODate) => periodOf(d, startDay).key;
  const quotaFor = (streak: number, d: ISODate) => restoreQuota(streak) + (bonus.has(monthOf(d)) ? 1 : 0);
  const onTime = new Set<ISODate>();
  // Days with a late entry made within the restore window.
  const late = new Set<ISODate>();
  for (const e of [...logs, ...noSpend]) {
    if (e.at > today) continue;
    if (e.at === e.d) onTime.add(e.d);
    else if (e.at > e.d && diffDays(e.at, e.d) <= RESTORE_WINDOW) late.add(e.d);
  }
  // Any entry counts for the day it was made.
  for (const e of logs) if (e.at <= today) onTime.add(e.at);

  const restored = new Set<ISODate>();
  const used = new Map<string, number>();
  let current = 0;
  let best = 0;
  let missed: ISODate[] = [];
  const start = [...onTime].sort()[0];
  if (start) {
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (onTime.has(d)) {
        current++;
      } else if (d === today) {
        // Still time to log today.
      } else if (current > 0 && late.has(d) && (used.get(monthOf(d)) ?? 0) < quotaFor(current, d)) {
        used.set(monthOf(d), (used.get(monthOf(d)) ?? 0) + 1);
        restored.add(d);
        current++;
      } else if (current > 0 && diffDays(today, d) <= RESTORE_WINDOW && (used.get(monthOf(d)) ?? 0) + missed.filter((m) => monthOf(m) === monthOf(d)).length < quotaFor(current, d)) {
        // Missed, but can still be restored: hold the streak for now.
        missed.push(d);
      } else {
        current = 0;
        missed = [];
      }
      best = Math.max(best, current);
    }
  }

  const quota = quotaFor(current, today);
  const month = monthOf(today);
  const quotaLeft = Math.max(0, quota - (used.get(month) ?? 0));
  const counted = [...onTime, ...restored].filter((d) => d <= today).sort();
  const last = counted[counted.length - 1] ?? null;
  const perfectWeeks = new Set<ISODate>();
  const weeks = new Set([...onTime].filter((d) => d <= today).map(weekStart));
  for (const sun of weeks) {
    if (Array.from({ length: 7 }, (_, i) => addDays(sun, i)).every((x) => x <= today && onTime.has(x))) perfectWeeks.add(sun);
  }
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(today), i));
  return {
    current,
    best,
    total: onTime.size + restored.size,
    last,
    doneToday: onTime.has(today),
    missed,
    quotaLeft,
    quota,
    bonus: bonus.has(month),
    onTime,
    restored,
    week,
    perfectWeeks,
  };
}
