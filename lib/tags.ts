import { summarize } from "./selectors"
import type { Transaction } from "./types"

export interface TagSummary {
  tag: string
  /** Spending (repayments taken off), income and entries under the tag. */
  spent: number
  income: number
  count: number
  from: string
  to: string
}

/** Every tag with its totals and date span, most recent first. */
export function tagSummaries(txs: Transaction[]): TagSummary[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) if (t.tag) groups.set(t.tag, [...(groups.get(t.tag) ?? []), t])
  return [...groups.entries()]
    .map(([tag, list]) => {
      const dates = list.map((t) => t.date).sort()
      const { expense, income } = summarize(list)
      return { tag, spent: expense, income, count: list.length, from: dates[0], to: dates[dates.length - 1] }
    })
    .sort((a, b) => b.to.localeCompare(a.to) || a.tag.localeCompare(b.tag))
}

/** Tags used before, most recently used first. */
export function knownTags(txs: Transaction[], limit = 8): string[] {
  const seen = new Set<string>()
  for (const t of [...txs].sort((a, b) => b.createdAt - a.createdAt)) if (t.tag) seen.add(t.tag)
  return [...seen].slice(0, limit)
}
