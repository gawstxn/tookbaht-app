import { NextResponse } from "next/server"
import { DB_LIMIT_BYTES, megabytes } from "@/lib/admin"
import { pingWebhook, webhookSet, webhookUrl, type DiscordChannel } from "@/lib/discord"
import { cronChecks, parseHealth, rateStatus, sizeStatus, type HealthCheck, type HealthReport } from "@/lib/health"
import { setUpVapid } from "@/lib/push"
import { latestUsdRate } from "@/lib/rates"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { supabaseEnv } from "@/lib/supabase/env"
import { createSupabaseServer } from "@/lib/supabase/server"

/** Run a check and time it; a throw is a failure. */
async function timed(id: string, run: () => Promise<Omit<HealthCheck, "id" | "ms">>): Promise<HealthCheck> {
  const start = Date.now()
  try {
    return { id, ...(await run()), ms: Date.now() - start }
  } catch (e) {
    console.error(`health check ${id} failed`, (e as Error).message)
    return { id, status: "fail", ms: Date.now() - start }
  }
}

/** A Discord webhook: not set is a warning (the app works without it), set but refused is a failure. */
const webhookCheck = (id: string, channel: DiscordChannel) =>
  timed(id, async () => {
    if (!webhookSet(channel)) return { status: "warn", detail: "notSet" }
    if (!webhookUrl(channel)) return { status: "fail", detail: "discordBadUrl" }
    return (await pingWebhook(channel)) ? { status: "ok" } : { status: "fail", detail: "discordRefused" }
  })

/**
 * Admin: is the app healthy? The database (and that the caller is an admin:
 * admin_health() refuses anyone else), the scheduled jobs, sign-in, and the
 * keys the server needs. Says whether a key is set and works, never the key.
 */
export async function GET() {
  const sb = await createSupabaseServer()
  const { data: auth } = await sb.auth.getClaims()
  if (!auth?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const start = Date.now()
  const { data, error } = await sb.rpc("admin_health")
  const dbMs = Date.now() - start
  if (error) {
    // 42501: not an admin. Anything else: the database didn't answer, so nobody can be shown the rest.
    if (error.code === "42501") return NextResponse.json({ error: "forbidden" }, { status: 403 })
    console.error(error)
    return NextResponse.json({ error: "database" }, { status: 503 })
  }
  const now = Date.now()
  const { dbBytes, jobs } = parseHealth(data ?? [])

  const { url, key } = supabaseEnv()
  const [serviceKey, signIn, discord, discordAlerts, discordErrors] = await Promise.all([
    // The secret key the cron routes and the rates route use.
    timed("serviceKey", async () => {
      const { error: e } = await createSupabaseAdmin().from("exchange_rates").select("date").limit(1)
      if (e) throw e
      return { status: "ok" }
    }),
    timed("auth", async () => {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      })
      return { status: res.ok ? "ok" : "fail" }
    }),
    webhookCheck("discord", "feedback"),
    webhookCheck("discordAlerts", "alerts"),
    webhookCheck("discordErrors", "errors"),
  ])

  let rates: HealthCheck
  try {
    const rate = serviceKey.status === "ok" ? await latestUsdRate(createSupabaseAdmin()) : null
    rates = {
      id: "rates",
      status: rateStatus(rate?.date ?? null, now),
      text: rate?.date,
      detail: rate ? undefined : "noRate",
    }
  } catch {
    rates = { id: "rates", status: "fail" }
  }

  const checks: HealthCheck[] = [
    { id: "db", status: "ok", ms: dbMs },
    {
      id: "dbSize",
      status: sizeStatus(dbBytes, DB_LIMIT_BYTES),
      text: `${megabytes(dbBytes)} / ${megabytes(DB_LIMIT_BYTES)}`,
    },
    signIn,
    serviceKey,
    ...cronChecks(jobs, now),
    setUpVapid() ? { id: "push", status: "fail", detail: "notSet" } : { id: "push", status: "ok" },
    process.env.CRON_SECRET
      ? { id: "cronSecret", status: "ok" }
      : { id: "cronSecret", status: "fail", detail: "notSet" },
    discord,
    discordAlerts,
    discordErrors,
    rates,
  ]
  const report: HealthReport = {
    checks,
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    commit: process.env.NEXT_PUBLIC_APP_COMMIT ?? "",
    at: now,
  }
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } })
}
