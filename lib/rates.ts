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
