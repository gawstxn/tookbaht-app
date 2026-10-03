import { NextResponse, type NextRequest } from "next/server"
import { deliverAlerts } from "@/lib/alerts"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * Hourly: post new alerts (a scheduled job that stopped, a full database, an
 * account writing in a loop, a burst of sign-ups, what an admin did, the
 * morning summary) to the maintainers' Discord channel. Called by the
 * database (pg_cron job send-admin-alerts → ping_alerts()) with
 * `Authorization: Bearer $CRON_SECRET`, because Vercel Cron on the free plan
 * runs once a day; the two daily cron routes also send what's waiting.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    return NextResponse.json(await deliverAlerts(createSupabaseAdmin()))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
