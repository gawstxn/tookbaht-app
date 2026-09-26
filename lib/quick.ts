import { addDays } from "./format";
import type { Transaction, TxType } from "./types";

/** Entries typed by hand (auto-logged subscription charges don't count as habits). */
const manual = (txs: Transaction[]) => txs.filter((t) => !t.subscriptionId);
const newestFirst = (a: Transaction, b: Transaction) => b.createdAt - a.createdAt;

export interface QuickEntry {
  key: string;
  /** The latest entry of the group; a quick save copies its fields. */
  sample: Transaction;
  count: number;
}

/**
 * Entries the user logs again and again ("กาแฟ ฿65 · เงินสด"): the same type,
 * amount, title, category and account at least `min` times within `days`.
 * Most frequent first, then most recent.
 */
export function quickEntries(
  txs: Transaction[],
  accountIds: string[],
  today: string,
  { days = 60, min = 3, limit = 4 }: { days?: number; min?: number; limit?: number } = {},
): QuickEntry[] {
  const since = addDays(today, -days);
  const groups = new Map<string, QuickEntry>();
  for (const t of manual(txs)) {
    if (t.type === "move" || t.date < since || t.date > today || !t.accountId || !accountIds.includes(t.accountId)) continue;
    const key = [t.type, t.amount, t.title.trim().toLowerCase(), t.category, t.accountId].join("|");
    const g = groups.get(key);
    if (!g) groups.set(key, { key, sample: t, count: 1 });
    else {
      g.count++;
      if (t.createdAt > g.sample.createdAt) g.sample = t;
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= min)
    .sort((a, b) => b.count - a.count || b.sample.createdAt - a.sample.createdAt)
    .slice(0, limit);
}

/** The value seen most often, ties going to the most recent (values are newest first). */
function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const v of values) {
    const c = counts.get(v)!;
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/**
 * An entry just like this one logged moments ago (same type, amount, day,
 * category and account or transfer route), e.g. the save button tapped twice.
 */
export function recentDuplicate(
  txs: Transaction[],
  entry: Pick<Transaction, "type" | "amount" | "date" | "category" | "accountId" | "fromId" | "toId">,
  now: number,
  withinMs = 10 * 60_000,
): Transaction | undefined {
  return manual(txs)
    .filter(
      (t) =>
        t.type === entry.type &&
        t.amount === entry.amount &&
        t.date === entry.date &&
        now - t.createdAt <= withinMs &&
        (t.type === "move" ? t.fromId === entry.fromId && t.toId === entry.toId : t.category === entry.category && t.accountId === entry.accountId),
    )
    .sort(newestFirst)[0];
}

export interface EntryDefaults {
  category?: string;
  accountId?: string;
  fromId?: string;
  toId?: string;
}

/**
 * What the add screen preselects for a new entry of this type: the category
 * and account (or transfer route) used most among the last `recent` entries.
 */
export function entryDefaults(txs: Transaction[], type: TxType, accountIds: string[], recent = 20): EntryDefaults {
  const known = (id?: string) => !!id && accountIds.includes(id);
  const last = manual(txs)
    .filter((t) => t.type === type)
    .sort(newestFirst)
    .slice(0, recent);
  if (type === "move") {
    const route = mostCommon(last.filter((t) => known(t.fromId) && known(t.toId) && t.fromId !== t.toId).map((t) => `${t.fromId}>${t.toId}`));
    if (!route) return {};
    const [fromId, toId] = route.split(">");
    return { fromId, toId };
  }
  return {
    category: mostCommon(last.map((t) => t.category).filter((c): c is string => !!c && c !== "sub")),
    accountId: mostCommon(last.map((t) => t.accountId).filter(known)),
  };
}
