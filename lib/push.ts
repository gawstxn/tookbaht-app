import "server-only"
import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Lang } from "./pushText"

/** Browser push services (mirrors public.is_push_endpoint in the database). */
const PUSH_ENDPOINT =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//

interface PushTarget {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushMessage {
  title: string
  body: string
  url: string
  tag: string
}

/** Error text when the VAPID keys aren't configured, else null (keys are set up). */
export function setUpVapid(): string | null {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env
  if (!publicKey || !privateKey || !subject) return "VAPID keys are not configured"
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return null
}

/**
 * Push sender for a batch of users: loads their devices and languages once,
 * sends to every device of a user, and forgets devices the browser dropped
 * (call `finish` at the end).
 */
export async function pusherFor(db: SupabaseClient, userIds: string[]) {
  // Each user's chosen language (profiles.settings.lang); Thai when unset.
  const { data: profiles } = await db.from("profiles").select("id, settings, suspended_at").in("id", userIds)
  type ProfileRow = { id: string; settings: { lang?: string } | null; suspended_at: string | null }
  const langOf = new Map<string, Lang>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p.settings?.lang === "en" ? "en" : "th"]),
  )
  // A suspended account can't open the app, so it isn't reminded to.
  const suspended = new Set(((profiles ?? []) as ProfileRow[]).filter((p) => p.suspended_at).map((p) => p.id))
  const { data: targets, error } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds)
    .returns<PushTarget[]>()
  if (error) throw error

  let sent = 0
  const gone = new Set<string>()
  return {
    lang: (userId: string): Lang => langOf.get(userId) ?? "th",
    /** Push to every device of the user; true when at least one accepted it. */
    async push(userId: string, message: PushMessage) {
      const payload = JSON.stringify(message)
      let ok = false
      if (suspended.has(userId)) return ok
      for (const t of targets.filter(
        (x) => x.user_id === userId && !gone.has(x.id) && PUSH_ENDPOINT.test(x.endpoint),
      )) {
        try {
          await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, {
            TTL: 60 * 60 * 12,
          })
          ok = true
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          // The browser dropped this subscription; stop sending to it.
          if (status === 404 || status === 410) gone.add(t.id)
          else console.error("push failed", status, e)
        }
      }
      return ok
    },
    async finish() {
      if (gone.size)
        await db
          .from("push_subscriptions")
          .delete()
          .in("id", [...gone])
      return { sent, removed: gone.size }
    },
  }
}
