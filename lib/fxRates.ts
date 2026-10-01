import type { FxCurrency } from "./currencies"
import type { UsdRate } from "./fx"

const cache = new Map<string, Promise<UsdRate | null>>()

/** THB per 1 `currency` for an entry on `date` (null offline or when the source fails; retried next time). */
export function fetchRate(currency: FxCurrency, date: string): Promise<UsdRate | null> {
  const key = `${currency}:${date}`
  let p = cache.get(key)
  if (!p) {
    p = fetch(`/api/rates?currency=${currency}&date=${date}`)
      .then(async (res) => ((await res.json()) as { rate: UsdRate | null }).rate)
      .catch(() => null)
      .then((rate) => {
        if (!rate) cache.delete(key)
        return rate
      })
    cache.set(key, p)
  }
  return p
}
