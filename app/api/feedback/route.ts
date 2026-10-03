import { after, NextResponse } from "next/server"
import { isSuspended } from "@/lib/admin"
import { feedbackEmbed, postToDiscord } from "@/lib/discord"
import { createSupabaseServer } from "@/lib/supabase/server"

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

/**
 * A problem report from the profile screen. Saved as the signed-in user, so
 * the row cap, the 20-a-day limit and suspension apply as they do to any
 * write, then posted to the maintainers' Discord channel. One post per saved
 * report: the channel can't be flooded past the daily limit.
 */
export async function POST(req: Request) {
  const sb = await createSupabaseServer()
  const { data } = await sb.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const report = {
    message: text(body?.message, 2000),
    app_version: text(body?.appVersion, 40),
    page: text(body?.page, 200),
    user_agent: text(req.headers.get("user-agent"), 300),
  }
  if (!report.message) return NextResponse.json({ error: "bad request" }, { status: 400 })

  const { error } = await sb.from("feedback").insert(report)
  if (error) {
    console.error(error)
    if (isSuspended(error)) return NextResponse.json({ error: "suspended" }, { status: 403 })
    const limit = error.hint === "feedback_limit" || error.hint === "row_limit"
    return NextResponse.json({ error: limit ? error.hint : "failed" }, { status: limit ? 429 : 500 })
  }

  // After the response: the user doesn't wait on Discord, and a failed post doesn't fail the report.
  after(async () => {
    const { data: profile } = await sb.from("profiles").select("name").eq("id", userId).maybeSingle<{ name: string }>()
    await postToDiscord("feedback", [
      feedbackEmbed({
        message: report.message,
        name: profile?.name ?? "",
        page: report.page,
        appVersion: report.app_version,
        userAgent: report.user_agent,
      }),
    ])
  })
  return NextResponse.json({ ok: true })
}
