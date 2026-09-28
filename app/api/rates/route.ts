import { NextResponse } from "next/server";
import { isFxCurrency } from "@/lib/currencies";
import { latestUsdRate, rateOn, refreshUsdRate } from "@/lib/rates";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Refresh when the stored rate is older than this (ECB skips weekends and holidays). */
const STALE_MS = 40 * 60 * 60 * 1000;

/**
 * Latest THB per USD for signed-in users. Refreshes from the source when the
 * stored rate is missing or old, so the app works before the daily cron runs.
 * With ?currency=JPY&date=2026-10-02: the rate for an entry logged abroad that day.
 */
export async function GET(req: Request) {
  const auth = await createSupabaseServer();
  const { data } = await auth.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createSupabaseAdmin();
  const params = new URL(req.url).searchParams;
  const currency = params.get("currency");
  if (currency !== null) {
    const date = params.get("date") ?? "";
    // No later than tomorrow (time zones), no earlier than the euro's reference rates.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (!isFxCurrency(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2000-01-01" || date > tomorrow) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    try {
      const rate = await rateOn(db, currency, date);
      return NextResponse.json({ rate }, { headers: { "Cache-Control": "private, max-age=3600" } });
    } catch (e) {
      console.error("rate lookup failed", e);
      return NextResponse.json({ rate: null }, { status: 502 });
    }
  }
  let rate = await latestUsdRate(db);
  if (!rate || Date.now() - Date.parse(rate.date) > STALE_MS) {
    try {
      rate = await refreshUsdRate(db);
    } catch (e) {
      console.error("rate refresh failed", e);
    }
  }
  return NextResponse.json({ usd: rate }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
