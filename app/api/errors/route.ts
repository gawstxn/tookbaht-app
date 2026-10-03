import { after, NextResponse } from "next/server"
import { recordError } from "@/lib/errorServer"
import { CLIENT_SOURCES, type ErrorSource } from "@/lib/errorText"
import { createSupabaseServer } from "@/lib/supabase/server"

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

/**
 * An error the app ran into on a signed-in user's device (lib/errorReport.ts).
 * Scrubbed, counted once per error per day, and posted to the maintainers'
 * Discord when it is new. Always answers 204: the app has nothing to do with
 * the result.
 */
export async function POST(req: Request) {
  const sb = await createSupabaseServer()
  const { data } = await sb.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const source = body?.source as ErrorSource
  const message = text(body?.message, 1000)
  if (!CLIENT_SOURCES.includes(source) || !message.trim()) {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }
  const input = {
    source,
    message,
    stack: text(body?.stack, 4000),
    page: text(body?.page, 300),
    appVersion: text(body?.appVersion, 40),
    userAgent: text(req.headers.get("user-agent"), 300),
  }
  after(() => recordError(input, userId))
  return new NextResponse(null, { status: 204 })
}
