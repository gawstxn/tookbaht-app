import { MASK, baht, baht2, isMasked } from "./money"
import type { Account, Currency, Subscription } from "./types"

/** Latest THB per USD and the date it's for. */
export interface UsdRate {
  rate: number
  date: string
}

const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "US$21.40" or "฿149" / "฿149.00". */
export function formatMoney(amount: number, currency: Currency, decimals = false): string {
  if (currency === "USD") return "US$" + (isMasked() ? MASK : usd.format(amount))
  return decimals ? baht2(amount) : baht(amount)
}

/** Estimated baht for a foreign amount on this account (rate + the card's FX fee). */
export function toTHB(
  amount: number,
  currency: Currency,
  rate: UsdRate | null,
  account?: Pick<Account, "fxFeePct">,
): number | null {
  if (currency === "THB") return amount
  if (!rate) return null
  return amount * rate.rate * (1 + (account?.fxFeePct ?? 0) / 100)
}

/** A subscription's price in baht (estimated for USD; null until a rate is known). */
export function subTHB(
  s: Pick<Subscription, "amount" | "currency" | "accountId">,
  accounts: Account[],
  rate: UsdRate | null,
): number | null {
  return toTHB(
    s.amount,
    s.currency,
    rate,
    accounts.find((a) => a.id === s.accountId),
  )
}

/** The card fee a charge implies: actual baht vs. amount × rate. Used to learn a card's real fee. */
export function impliedFeePct(actualTHB: number, origAmount: number, rate: number): number {
  const pct = (actualTHB / (origAmount * rate) - 1) * 100
  return Math.min(10, Math.max(0, Math.round(pct * 100) / 100))
}
