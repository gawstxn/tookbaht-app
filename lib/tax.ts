import type { Transaction } from "./types"

/*
 * Thai personal income tax deductions an expense can count towards. Only the
 * fixed baht caps that have held for years are listed; caps that depend on
 * income or change with each year's measures (RMF, ThaiESG, donations, Easy
 * E-Receipt) are shown as a note instead. The user checks the current rules
 * with the Revenue Department before filing.
 */
export type TaxType =
  | "life"
  | "health"
  | "parentHealth"
  | "homeLoan"
  | "rmf"
  | "thaiesg"
  | "donation"
  | "donationDouble"
  | "easyReceipt"
  | "other"

export const TAX_TYPES: { key: TaxType; cap?: number }[] = [
  { key: "life", cap: 100_000 },
  { key: "health", cap: 25_000 },
  { key: "parentHealth", cap: 15_000 },
  { key: "homeLoan", cap: 100_000 },
  { key: "rmf" },
  { key: "thaiesg" },
  { key: "donation" },
  { key: "donationDouble" },
  { key: "easyReceipt" },
  { key: "other" },
]

/** Life and own health insurance together may not go past this. */
export const LIFE_HEALTH_CAP = 100_000

export interface TaxLine {
  key: TaxType
  amount: number
  cap?: number
  items: Transaction[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** A tax year's (calendar year) marked expenses by kind, in TAX_TYPES order; kinds with nothing are left out. */
export function taxYear(txs: Transaction[], year: string): { lines: TaxLine[]; total: number; lifeHealthOver: number } {
  const marked = txs.filter((t) => t.type === "out" && t.taxType && t.date.startsWith(year))
  const lines = TAX_TYPES.map(({ key, cap }) => {
    const items = marked.filter((t) => t.taxType === key).sort((a, b) => b.date.localeCompare(a.date))
    return { key, cap, amount: round2(items.reduce((a, t) => a + t.amount, 0)), items }
  }).filter((l) => l.items.length)
  const amount = (k: TaxType) => lines.find((l) => l.key === k)?.amount ?? 0
  const lifeHealth = Math.min(amount("life"), 100_000) + Math.min(amount("health"), 25_000)
  return {
    lines,
    total: round2(marked.reduce((a, t) => a + t.amount, 0)),
    lifeHealthOver: round2(Math.max(0, lifeHealth - LIFE_HEALTH_CAP)),
  }
}

/** Years with marked expenses, newest first, always including the current one. */
export function taxYears(txs: Transaction[], current: string): string[] {
  const years = new Set([current, ...txs.filter((t) => t.taxType).map((t) => t.date.slice(0, 4))])
  return [...years].sort().reverse()
}
