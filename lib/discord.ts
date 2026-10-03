import { deviceLabel } from "./admin"

/*
 * The maintainers' Discord: problem reports go to one channel
 * (DISCORD_FEEDBACK_WEBHOOK_URL), alerts about the system to another
 * (DISCORD_ALERTS_WEBHOOK_URL) and errors the app ran into to a third
 * (DISCORD_ERRORS_WEBHOOK_URL), so a report isn't buried under the rest and
 * each channel can notify differently. Server only: a webhook URL is a
 * secret, anyone holding it can post to its channel.
 */

export type DiscordChannel = "feedback" | "alerts" | "errors"

const ENV: Record<DiscordChannel, string> = {
  feedback: "DISCORD_FEEDBACK_WEBHOOK_URL",
  alerts: "DISCORD_ALERTS_WEBHOOK_URL",
  errors: "DISCORD_ERRORS_WEBHOOK_URL",
}

/** Only a Discord webhook; a mistyped setting must not send anything somewhere else. */
const WEBHOOK = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/

/** Whether the setting is there at all (set but malformed is a failed health check, not "off"). */
export const webhookSet = (channel: DiscordChannel): boolean => !!process.env[ENV[channel]]?.trim()

/** The channel's webhook, or null when it isn't set or isn't a Discord webhook URL. */
export function webhookUrl(channel: DiscordChannel): string | null {
  const url = process.env[ENV[channel]]?.trim()
  return url && WEBHOOK.test(url) ? url : null
}

export interface DiscordEmbed {
  title: string
  description?: string
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  color?: number
  /** Every embed says when it happened; Discord shows it in the reader's own time zone. */
  timestamp: string
}

/** The app's lime, as the bar down the side of a report. */
const LIME = 0xc6f24e

export const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

/** A message of up to ten embeds. Mentions are off so nothing a user typed can ping the channel. */
export const discordMessage = (embeds: DiscordEmbed[]) => ({
  username: "Tookbaht",
  allowed_mentions: { parse: [] as string[] },
  embeds,
})

/** Post to a channel. False when its webhook isn't set or Discord refused the message. */
export async function postToDiscord(channel: DiscordChannel, embeds: DiscordEmbed[]): Promise<boolean> {
  const url = webhookUrl(channel)
  if (!url) return false
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordMessage(embeds)),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error(`discord ${channel} webhook refused the message`, res.status)
    return res.ok
  } catch (e) {
    // Never the error itself: a fetch error can carry the URL.
    console.error(`discord ${channel} webhook failed`, (e as Error).name)
    return false
  }
}

/** Ask Discord whether the webhook still exists (a GET posts nothing). */
export async function pingWebhook(channel: DiscordChannel): Promise<boolean> {
  const url = webhookUrl(channel)
  if (!url) return false
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" })
    return res.ok
  } catch {
    return false
  }
}

export interface FeedbackNotice {
  message: string
  name: string
  page: string
  appVersion: string
  userAgent: string
}

/**
 * What a user typed, safe to show: "@everyone" and "@here" would be drawn as
 * a mention (pings are already off), so the @ is split from the word.
 */
const plain = (s: string) => s.replace(/@/g, "@​")

/**
 * A problem report: who sent it, the message as a quote, and where it came
 * from on one small line underneath. The sender's name only: the email stays
 * in the admin screen.
 */
export function feedbackEmbed(f: FeedbackNotice, now = Date.now()): DiscordEmbed {
  const from = [f.page, f.appVersion && `v${f.appVersion}`, deviceLabel(f.userAgent)].filter(Boolean)
  return {
    title: clip(`ฟีดแบคจาก ${plain(f.name) || "ผู้ใช้"}`, 200),
    // Discord allows 4096; a report is at most 2000.
    description: clip(
      plain(f.message)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n"),
      4000,
    ),
    footer: from.length ? { text: clip(from.join(" · "), 300) } : undefined,
    color: LIME,
    timestamp: new Date(now).toISOString(),
  }
}
