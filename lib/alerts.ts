import "server-only"
import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { alertEmbed, cronAlert, healthAlerts, type Alert } from "./alertText"
import { postToDiscord, webhookUrl } from "./discord"
import { parseHealth } from "./health"
import { createSupabaseAdmin } from "./supabase/admin"

/** Alerts posted per run; Discord takes ten embeds a message. */
const MAX_PER_RUN = 50
/** An alert nobody was told about for this long is stale (the webhook wasn't set); it isn't sent late. */
const FRESH_MS = 3 * 24 * 60 * 60 * 1000

/** Record alerts; one already recorded under the same key stays as it is. */
export async function raiseAlerts(db: SupabaseClient, alerts: Alert[]) {
  if (!alerts.length) return
  const { error } = await db.from("admin_alerts").upsert(alerts, { onConflict: "key", ignoreDuplicates: true })
  if (error) console.error("recording alerts failed", error.message)
}

/**
 * Work out what's wrong right now, record it, and post what hasn't been
 * posted yet to the alerts channel. Run by /api/cron/alerts and at the end of
 * the daily cron routes. A row is marked sent only once Discord took it.
 */
export async function deliverAlerts(db: SupabaseClient, now = Date.now()) {
  const collected = await db.rpc("collect_alerts")
  if (collected.error) console.error("collect_alerts failed", collected.error.message)
  const health = await db.rpc("system_health")
  if (health.error) console.error("system_health failed", health.error.message)
  else {
    const { jobs, dbBytes } = parseHealth(health.data ?? [])
    await raiseAlerts(db, healthAlerts(jobs, dbBytes, now))
  }

  if (!webhookUrl("alerts")) return { pending: 0, sent: 0 }
  const { data, error } = await db
    .from("admin_alerts")
    .select("key, kind, data, created_at")
    .is("sent_at", null)
    .gt("created_at", new Date(now - FRESH_MS).toISOString())
    .order("created_at")
    .limit(MAX_PER_RUN)
    .returns<Alert[]>()
  if (error) {
    console.error("reading alerts failed", error.message)
    return { pending: 0, sent: 0 }
  }
  const pending = data ?? []
  let sent = 0
  for (let i = 0; i < pending.length; i += 10) {
    const batch = pending.slice(i, i + 10)
    if (
      !(await postToDiscord(
        "alerts",
        batch.map((a) => alertEmbed(a)),
      ))
    )
      break
    const marked = await db
      .from("admin_alerts")
      .update({ sent_at: new Date().toISOString() })
      .in(
        "key",
        batch.map((a) => a.key),
      )
    if (marked.error) console.error("marking alerts sent failed", marked.error.message)
    sent += batch.length
  }
  return { pending: pending.length, sent }
}

/**
 * Wrap up a daily cron route: an alert when it failed or no push got through,
 * then send whatever is waiting. The route's own response goes back unchanged.
 */
export async function afterCron(route: string, res: NextResponse): Promise<NextResponse> {
  if (res.status === 401) return res
  try {
    const db = createSupabaseAdmin()
    const body = (await res
      .clone()
      .json()
      .catch(() => ({}))) as Record<string, unknown>
    const alert = cronAlert(route, res.status, body, Date.now())
    if (alert) await raiseAlerts(db, [alert])
    await deliverAlerts(db)
  } catch (e) {
    console.error("alerts after cron failed", (e as Error).message)
  }
  return res
}
