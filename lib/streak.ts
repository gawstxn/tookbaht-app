import { addDays, diffDays, monthKey, toISO } from "./format";
import type { ISODate, Transaction } from "./types";

/*
 * Logging streak. A day counts when the user logs an entry themselves that
 * day (auto-logged subscription charges don't count) or confirms they spent
 * nothing. A missed day can be restored within RESTORE_WINDOW days by going
 * back and logging that day's entries (or confirming no spending that day),
 * up to a monthly quota that grows with the streak. Everything is derived
 * from the entries and no-spend confirmations, so nothing else is stored.
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

/** Tiers named after Thai money, coloured like the notes; reached by days counted overall. */
export const TIERS = [
  { key: "coin", days: 0, tone: "#c98a1e" },
  { key: "note20", days: 7, tone: "#2f5b45" },
  { key: "note50", days: 30, tone: "#33558f" },
  { key: "note100", days: 100, tone: "#8a2e22" },
  { key: "note500", days: 200, tone: "#5b4a7a" },
  { key: "note1000", days: 365, tone: "#6e3a1c" },
] as const;
export type TierKey = (typeof TIERS)[number]["key"];

/** Tier for a number of counted days, with the next one to reach (null at the top). */
export function tierFor(days: number) {
  let i = 0;
  while (i + 1 < TIERS.length && days >= TIERS[i + 1].days) i++;
  return { tier: TIERS[i], next: TIERS[i + 1] ?? null };
}

export interface StreakInput {
  /** When each entry was made (local day) and the day it is for; manual entries only. */
  logs: { at: ISODate; d: ISODate }[];
  noSpend: NoSpend[];
  today: ISODate;
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
  /** Days that count, and which of them were restored (for the calendar). */
  onTime: Set<ISODate>;
  restored: Set<ISODate>;
}

/** Manual entries as streak logs: the local day each was made and the day it's for. */
export function streakLogs(txs: Transaction[]): StreakInput["logs"] {
  const out: StreakInput["logs"] = [];
  for (const t of txs) if (!t.subscriptionId && t.createdAt) out.push({ at: toISO(new Date(t.createdAt)), d: t.date });
  return out;
}

export function streakStatus({ logs, noSpend, today }: StreakInput): StreakStatus {
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
      } else if (current > 0 && late.has(d) && (used.get(monthKey(d)) ?? 0) < restoreQuota(current)) {
        used.set(monthKey(d), (used.get(monthKey(d)) ?? 0) + 1);
        restored.add(d);
        current++;
      } else if (current > 0 && diffDays(today, d) <= RESTORE_WINDOW && (used.get(monthKey(d)) ?? 0) + missed.filter((m) => monthKey(m) === monthKey(d)).length < restoreQuota(current)) {
        // Missed, but can still be restored: hold the streak for now.
        missed.push(d);
      } else {
        current = 0;
        missed = [];
      }
      best = Math.max(best, current);
    }
  }

  const quota = restoreQuota(current);
  const month = monthKey(today);
  const quotaLeft = Math.max(0, quota - (used.get(month) ?? 0));
  const counted = [...onTime, ...restored].filter((d) => d <= today).sort();
  const last = counted[counted.length - 1] ?? null;
  return { current, best, total: onTime.size + restored.size, last, doneToday: onTime.has(today), missed, quotaLeft, quota, onTime, restored };
}
