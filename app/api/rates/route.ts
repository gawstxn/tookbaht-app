import { NextResponse } from "next/server";
import { latestUsdRate, refreshUsdRate } from "@/lib/rates";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Refresh when the stored rate is older than this (ECB skips weekends and holidays). */
const STALE_MS = 40 * 60 * 60 * 1000;

/**
 * Latest THB per USD for signed-in users. Refreshes from the source when the
 * stored rate is missing or old, so the app works before the daily cron runs.
 */
export async function GET() {
  const auth = await createSupabaseServer();
  const { data } = await auth.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createSupabaseAdmin();
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
