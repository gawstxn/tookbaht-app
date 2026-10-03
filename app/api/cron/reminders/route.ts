import { NextResponse, type NextRequest } from "next/server"
import { pusherFor, setUpVapid } from "@/lib/push"
import {
  budgetText,
  chargeText,
  dueText,
  renewText,
  summaryText,
  type PendingBudget,
  type PendingDue,
  type PendingReminder,
  type PendingRenewal,
  type PendingSummary,
} from "@/lib/pushText"
import { refreshUsdRate } from "@/lib/rates"
import { afterCron } from "@/lib/alerts"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * Daily job (vercel.json, 09:00 Bangkok): push reminders for charges due
 * tomorrow, yearly services renewing within a week (still used?), card /
 * pay-later payments due tomorrow, and budgets that reached
 * 80% or went over, and last month's summary early in a new month. Called
 * by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 * Each kind is recorded once delivered, so a retried run doesn't repeat it.
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const vapidError = setUpVapid()
  if (vapidError) return NextResponse.json({ error: vapidError }, { status: 500 })

  const db = createSupabaseAdmin()
  // Daily job: also keep the USD rate fresh for auto-logging foreign subscriptions.
  await refreshUsdRate(db).catch((e) => console.error("rate refresh failed", e))
  const [charges, renewals, dues, budgets, summaries] = await Promise.all([
    db.rpc("pending_reminders"),
    db.rpc("pending_renewal_reviews"),
    db.rpc("pending_due_reminders"),
    db.rpc("pending_budget_alerts"),
    db.rpc("pending_month_summaries"),
  ])
  for (const r of [charges, renewals, dues, budgets, summaries])
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
  const pending = (charges.data ?? []) as PendingReminder[]
  const pendingRenewal = (renewals.data ?? []) as PendingRenewal[]
  const pendingDue = (dues.data ?? []) as PendingDue[]
  const pendingBudget = (budgets.data ?? []) as PendingBudget[]
  const pendingSummary = (summaries.data ?? []) as PendingSummary[]

  const userIds = [
    ...new Set(
      [...pending, ...pendingRenewal, ...pendingDue, ...pendingBudget, ...pendingSummary].map((r) => r.user_id),
    ),
  ]
  if (!userIds.length) return NextResponse.json({ reminders: 0, sent: 0 })

  let pusher: Awaited<ReturnType<typeof pusherFor>>
  try {
    pusher = await pusherFor(db, userIds)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const { push, lang } = pusher

  const deliveredCharges: { subscription_id: string; due_date: string }[] = []
  for (const r of pending) {
    const ok = await push(r.user_id, {
      ...chargeText(lang(r.user_id), r),
      url: `/subscriptions/${r.subscription_id}`,
      tag: `due-${r.subscription_id}-${r.due_date}`,
    })
    if (ok) deliveredCharges.push({ subscription_id: r.subscription_id, due_date: r.due_date })
  }
  const deliveredRenewals: { subscription_id: string; due_date: string }[] = []
  for (const r of pendingRenewal) {
    const ok = await push(r.user_id, {
      ...renewText(lang(r.user_id), r),
      url: `/subscriptions/${r.subscription_id}`,
      tag: `renew-${r.subscription_id}-${r.due_date}`,
    })
    if (ok) deliveredRenewals.push({ subscription_id: r.subscription_id, due_date: r.due_date })
  }
  const deliveredDue: { account_id: string; due_date: string }[] = []
  for (const r of pendingDue) {
    const ok = await push(r.user_id, {
      ...dueText(lang(r.user_id), r),
      url: "/accounts",
      tag: `pay-${r.account_id}-${r.due_date}`,
    })
    if (ok) deliveredDue.push({ account_id: r.account_id, due_date: r.due_date })
  }
  const deliveredBudget: { user_id: string; month: string; budget_key: string; level: number }[] = []
  for (const r of pendingBudget) {
    const ok = await push(r.user_id, {
      ...budgetText(lang(r.user_id), r),
      url: "/goals",
      tag: `budget-${r.budget_key}-${r.month}-${r.level}`,
    })
    // Going over also covers the 80% warning, so it isn't sent afterwards.
    if (ok)
      for (const level of r.level === 100 ? [80, 100] : [80])
        deliveredBudget.push({ user_id: r.user_id, month: r.month, budget_key: r.budget_key, level })
  }
  const deliveredSummary: { user_id: string; month: string }[] = []
  for (const r of pendingSummary) {
    const ok = await push(r.user_id, {
      ...summaryText(lang(r.user_id), r),
      url: "/insights",
      tag: `summary-${r.month}`,
    })
    if (ok) deliveredSummary.push({ user_id: r.user_id, month: r.month })
  }

  const { sent, failed, removed } = await pusher.finish()
  const logs = await Promise.all([
    deliveredCharges.length ? db.from("reminders_sent").upsert(deliveredCharges, { ignoreDuplicates: true }) : null,
    deliveredRenewals.length
      ? db.from("renewal_reviews_sent").upsert(deliveredRenewals, { ignoreDuplicates: true })
      : null,
    deliveredDue.length ? db.from("due_reminders_sent").upsert(deliveredDue, { ignoreDuplicates: true }) : null,
    deliveredBudget.length ? db.from("budget_alerts_sent").upsert(deliveredBudget, { ignoreDuplicates: true }) : null,
    deliveredSummary.length
      ? db.from("month_summaries_sent").upsert(deliveredSummary, { ignoreDuplicates: true })
      : null,
  ])
  for (const l of logs) if (l?.error) console.error(l.error)
  return NextResponse.json({
    reminders: pending.length,
    renewals: pendingRenewal.length,
    due: pendingDue.length,
    budgets: pendingBudget.length,
    summaries: pendingSummary.length,
    sent,
    failed,
    removed,
  })
}

/** Also tells the maintainers when the job failed or no push got through, and sends waiting alerts. */
export const GET = async (request: NextRequest) => afterCron("reminders", await run(request))
