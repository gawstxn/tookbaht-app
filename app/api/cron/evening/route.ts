import { NextResponse, type NextRequest } from "next/server"
import { pusherFor, setUpVapid } from "@/lib/push"
import { logReminderText, type StreakState } from "@/lib/pushText"
import { afterCron } from "@/lib/alerts"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * Evening job (vercel.json, 20:00 Bangkok): nudge users who turned the
 * reminder on and haven't logged anything today. Sent at most once a day.
 * Called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const vapidError = setUpVapid()
  if (vapidError) return NextResponse.json({ error: vapidError }, { status: 500 })

  const db = createSupabaseAdmin()
  const { data, error } = await db.rpc("pending_log_reminders")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const pending = (data ?? []) as { user_id: string; date: string; streak: number; streak_state: StreakState }[]
  if (!pending.length) return NextResponse.json({ reminders: 0, sent: 0 })

  let pusher: Awaited<ReturnType<typeof pusherFor>>
  try {
    pusher = await pusherFor(
      db,
      pending.map((r) => r.user_id),
    )
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const delivered: { user_id: string; date: string }[] = []
  for (const r of pending) {
    const text = logReminderText(pusher.lang(r.user_id), r.streak, r.streak_state)
    if (await pusher.push(r.user_id, { ...text, tag: `log-${r.date}` }))
      delivered.push({ user_id: r.user_id, date: r.date })
  }
  const { sent, failed, removed } = await pusher.finish()
  if (delivered.length) {
    const { error: logError } = await db.from("log_reminders_sent").upsert(delivered, { ignoreDuplicates: true })
    if (logError) console.error(logError)
  }
  return NextResponse.json({ reminders: pending.length, sent, failed, removed })
}

/** Also tells the maintainers when the job failed or no push got through, and sends waiting alerts. */
export const GET = async (request: NextRequest) => afterCron("evening", await run(request))
