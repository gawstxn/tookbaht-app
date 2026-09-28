import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const SOURCE = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=THB";

/** Latest stored THB per USD. */
export async function latestUsdRate(db: SupabaseClient) {
  const { data } = await db.from("exchange_rates").select("rate, date").eq("currency", "USD").order("date", { ascending: false }).limit(1).maybeSingle<{ rate: number | string; date: string }>();
  return data ? { rate: Number(data.rate), date: data.date } : null;
}

/**
 * Fetch today's ECB reference rate (Frankfurter) and store it. ECB publishes
 * on working days, so the returned date can be a day or two old.
 */
export async function refreshUsdRate(db: SupabaseClient) {
  const res = await fetch(SOURCE, { cache: "no-store" });
  if (!res.ok) throw new Error(`rate source ${res.status}`);
  const body = (await res.json()) as { date: string; rates?: { THB?: number } };
  const rate = body.rates?.THB;
  if (!rate || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new Error("unexpected rate response");
  const { error } = await db.from("exchange_rates").upsert({ currency: "USD", date: body.date, rate });
  if (error) throw error;
  return { rate, date: body.date };
}

/** A stored rate this many days older than the entry still counts (ECB skips weekends and holidays). */
const MAX_GAP_DAYS = 4;

/**
 * THB per 1 `currency` for an entry on `date`: the stored rate for that day
 * or a few days before, else the ECB rate Frankfurter gives for that date
 * (the last working day on or before it), stored for next time.
 */
export async function rateOn(db: SupabaseClient, currency: string, date: string) {
  const { data } = await db
    .from("exchange_rates")
    .select("rate, date")
    .eq("currency", currency)
    .lte("date", date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle<{ rate: number | string; date: string }>();
  if (data && (Date.parse(date) - Date.parse(data.date)) / 86_400_000 <= MAX_GAP_DAYS) return { rate: Number(data.rate), date: data.date };

  const res = await fetch(`https://api.frankfurter.dev/v1/${date}?base=${currency}&symbols=THB`, { cache: "no-store" });
  if (!res.ok) throw new Error(`rate source ${res.status}`);
  const body = (await res.json()) as { date: string; rates?: { THB?: number } };
  const rate = body.rates?.THB;
  if (!rate || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new Error("unexpected rate response");
  const { error } = await db.from("exchange_rates").upsert({ currency, date: body.date, rate });
  if (error) throw error;
  return { rate, date: body.date };
}
