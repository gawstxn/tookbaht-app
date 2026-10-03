import { createHash } from "node:crypto"
import { deviceLabel } from "./admin"
import { clip, type DiscordEmbed } from "./discord"

/*
 * Errors users run into but never report (see the error_reports migration).
 * The browser sends what went wrong (lib/errorReport.ts); this is the server
 * half: clean the text, give the same error the same fingerprint so it is
 * counted rather than repeated, and word it for the maintainers' Discord.
 */

export type ErrorSource = "error" | "rejection" | "save" | "server"
export const CLIENT_SOURCES: ErrorSource[] = ["error", "rejection", "save"]

export interface ErrorInput {
  source: ErrorSource
  message: string
  stack: string
  page: string
  appVersion: string
  userAgent: string
}

export interface ErrorRecord {
  fingerprint: string
  source: ErrorSource
  message: string
  stack: string
  page: string
  appVersion: string
  device: string
}

/**
 * Take out what could be a user's own data before an error is kept or sent:
 * an error from the database can quote the row it refused. Emails, ids, long
 * numbers (phone, PromptPay, amounts), quoted row values and anything typed
 * in Thai go; the app's own error texts are English.
 */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/=\([^)]*\)/g, "=(…)")
    .replace(/[฀-๿]+(\s+[฀-๿]+)*/g, "…")
    .replace(/\d[\d,.]{5,}/g, "[number]")
}

/** The top of a stack, without the site's address or query strings: enough to find the place. */
export function trimStack(stack: string, message: string): string {
  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes(message))
    .slice(0, 6)
    .map((line) => line.replace(/https?:\/\/[^/\s)]+/g, "").replace(/\?[^\s):]*/g, ""))
    .join("\n")
}

/** The path only, with ids taken out: /subscriptions/[id]/edit. */
export function cleanPage(page: string): string {
  return scrub(page.split(/[?#]/)[0]).slice(0, 200)
}

/**
 * The same error gets the same fingerprint whoever meets it: its kind, its
 * message with the numbers taken out, and where it was thrown (the first
 * stack line, without line numbers or the build's file hashes).
 */
export function fingerprint(source: string, message: string, stack: string): string {
  const where = (stack.split("\n")[0] ?? "").replace(/[-.][0-9a-f]{8,}(?=\.js)/g, "").replace(/:\d+/g, "")
  const what = message.replace(/\d+/g, "0")
  return createHash("sha256").update(`${source}|${what}|${where}`).digest("hex").slice(0, 16)
}

/** What is kept of a reported error, or null when there is nothing to say. */
export function errorRecord(input: ErrorInput): ErrorRecord | null {
  const message = clip(scrub(input.message.trim()), 300)
  if (!message) return null
  const stack = clip(scrub(trimStack(input.stack, input.message.trim())), 1000)
  return {
    fingerprint: fingerprint(input.source, message, stack),
    source: input.source,
    message,
    stack,
    page: cleanPage(input.page),
    appVersion: input.appVersion.slice(0, 40),
    device: deviceLabel(input.userAgent).slice(0, 60),
  }
}

const SOURCES: Record<ErrorSource, string> = {
  error: "หน้าจอพัง",
  rejection: "งานเบื้องหลังล้มเหลว",
  save: "บันทึกไม่สำเร็จ",
  server: "เซิร์ฟเวอร์",
}
const RED = 0xe5484d

/** The Discord embed: new the first time, then again at 10, 100, 1,000 occurrences in the day. */
export function errorEmbed(e: ErrorRecord, count: number, users: number, now = Date.now()): DiscordEmbed {
  const from = [e.page, e.appVersion && `v${e.appVersion}`, e.device].filter(Boolean)
  // Backticks would close the code block.
  const code = (s: string) => `\`\`\`\n${s.replace(/`/g, "'")}\n\`\`\``
  return {
    title: count > 1 ? `ข้อผิดพลาดเกิดซ้ำ ${count.toLocaleString("en-US")} ครั้งวันนี้` : "ข้อผิดพลาดใหม่",
    description: `**${SOURCES[e.source]}**\n${code(e.message)}${e.stack ? code(e.stack) : ""}`,
    fields:
      count > 1 && e.source !== "server"
        ? [{ name: "ผู้ใช้ที่เจอ", value: `${users.toLocaleString("en-US")} คน`, inline: true }]
        : undefined,
    footer: from.length ? { text: clip(from.join(" · "), 300) } : undefined,
    color: RED,
    timestamp: new Date(now).toISOString(),
  }
}
