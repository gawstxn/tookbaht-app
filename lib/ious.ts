import type { Iou, IouDirection } from "./types";

const dirOf = (i: Iou): IouDirection => i.direction ?? "owed_to_me";

export interface PersonDebt {
  person: string;
  total: number;
  /** Unpaid debts, oldest first. */
  items: Iou[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Names compare without case or surrounding spaces ("Boss" = "boss "). */
const nameKey = (s: string) => s.trim().toLocaleLowerCase();

/** Unpaid debts in one direction, grouped by friend, largest total first. */
export function debtsByPerson(ious: Iou[], direction: IouDirection = "owed_to_me"): PersonDebt[] {
  const groups = new Map<string, PersonDebt>();
  for (const i of [...ious].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    if (i.settledOn || dirOf(i) !== direction) continue;
    const key = nameKey(i.person);
    const g = groups.get(key) ?? { person: i.person.trim(), total: 0, items: [] };
    g.total = round2(g.total + i.amount);
    g.items.push(i);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.person.localeCompare(b.person));
}

/** Everything still unpaid in one direction (by default, what friends owe the user). */
export function owedTotal(ious: Iou[], direction: IouDirection = "owed_to_me"): number {
  return round2(ious.reduce((s, i) => (i.settledOn || dirOf(i) !== direction ? s : s + i.amount), 0));
}

/**
 * Each friend's share of a bill split evenly between `people` (the user
 * included). Rounded to satang; any leftover satang stays with the user.
 */
export function splitShare(total: number, people: number): number {
  if (people < 2 || total <= 0) return 0;
  return Math.floor((total * 100) / people) / 100;
}

/** Names used before, most recent first, for quick picks. */
export function knownPeople(ious: Iou[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of [...ious].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = nameKey(i.person);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i.person.trim());
  }
  return out.slice(0, limit);
}
