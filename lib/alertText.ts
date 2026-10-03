import { DB_LIMIT_BYTES, megabytes } from "./admin"
import { clip, type DiscordEmbed } from "./discord"
import { cronChecks, sizeStatus, type CronJobRow } from "./health"
import th from "./locales/th"

/*
 * Alerts for the maintainers' Discord channel. Each is a row in admin_alerts
 * whose key names what it is about, so the same thing is raised once (see the
 * admin_alerts migration); this file works out the ones the server sees for
 * itself and words every kind. Thai, like the admin screens.
 */

export interface Alert {
  key: string
  kind: string
  data: Record<string, unknown>
  /** When it was recorded (admin_alerts.created_at); absent on one not saved yet. */
  created_at?: string
}

/** The date in Bangkok, for keys that repeat once a day. */
export const bangkokDay = (now: number) => new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)

/** A scheduled job that stopped or failed (once a day while it lasts) and a database filling up (once per level). */
export function healthAlerts(jobs: CronJobRow[], dbBytes: number, now: number): Alert[] {
  // No jobs at all: a database without pg_cron (local tests), not five jobs gone missing.
  const alerts: Alert[] = (jobs.length ? cronChecks(jobs, now) : [])
    .filter((c) => c.status === "fail")
    .map((c) => ({
      key: `${c.id}:${bangkokDay(now)}`,
      kind: "job",
      data: { job: c.id.slice(4), detail: c.detail ?? "" },
    }))
  const size = sizeStatus(dbBytes, DB_LIMIT_BYTES)
  if (size !== "ok") alerts.push({ key: `db:${size}`, kind: "db", data: { bytes: dbBytes } })
  return alerts
}

/** What a finished cron route says about itself: `{ error }` on failure, else counts with `sent` and `failed`. */
export function cronAlert(route: string, status: number, body: Record<string, unknown>, now: number): Alert | null {
  const day = bangkokDay(now)
  if (status >= 500) {
    return {
      key: `cron:${route}:${day}`,
      kind: "cron",
      data: { route, error: clip(String(body.error ?? status), 200) },
    }
  }
  // Devices were tried and none took it: the keys or the push service, not one stale phone.
  const failed = Number(body.failed ?? 0)
  if (failed > 0 && Number(body.sent ?? 0) === 0) {
    return { key: `push:${route}:${day}`, kind: "push", data: { route, failed } }
  }
  return null
}

const RED = 0xe5484d
const AMBER = 0xf5a524
const GREY = 0x8b8d98

const n = (v: unknown) => Number(v ?? 0).toLocaleString("en-US")
const s = (v: unknown, max = 100) => clip(String(v ?? "") || "—", max)

const TABLES: Record<string, string> = {
  transactions: th.admin.entries,
  accounts: th.admin.rowsAccounts,
  subscriptions: th.admin.rowsSchedules,
  ious: th.ious.title,
  savings_goals: th.savings.title,
  wishes: th.wish.title,
  feedback: th.admin.feedback,
}
const ROUTES: Record<string, string> = { reminders: "แจ้งเตือนตอนเช้า", evening: "แจ้งเตือนตอนค่ำ" }

/** The Discord embed for an alert, stamped with when it was raised. */
export function alertEmbed(alert: Alert, now = Date.now()): DiscordEmbed {
  const timestamp = new Date(alert.created_at ? Date.parse(alert.created_at) : now).toISOString()
  return { ...alertWords(alert), timestamp }
}

function alertWords({ kind, data: d }: Alert): Omit<DiscordEmbed, "timestamp"> {
  switch (kind) {
    case "job": {
      const jobs: Record<string, string> = th.admin.healthJob
      const details: Record<string, string> = th.admin.healthDetail
      return {
        title: "งานอัตโนมัติมีปัญหา",
        description: `${jobs[String(d.job)] ?? s(d.job)}: ${details[String(d.detail)] ?? s(d.detail)}`,
        color: RED,
      }
    }
    case "db": {
      const bytes = Number(d.bytes ?? 0)
      return {
        title: "ฐานข้อมูลใกล้เต็ม",
        description: `ใช้ไป ${megabytes(bytes)} จาก ${megabytes(DB_LIMIT_BYTES)} (${Math.round((bytes / DB_LIMIT_BYTES) * 100)}%)`,
        color: sizeStatus(bytes, DB_LIMIT_BYTES) === "fail" ? RED : AMBER,
      }
    }
    case "writes":
      return {
        title: "บัญชีเขียนข้อมูลผิดปกติ",
        description: `${s(d.name)} จดเพิ่ม ${n(d.count)} รายการใน 24 ชม.`,
        color: RED,
      }
    case "cap":
      return {
        title: "บัญชีเก็บข้อมูลครบเพดาน",
        description: `${s(d.name)}: ${TABLES[String(d.table)] ?? s(d.table)} ${n(d.count)} แถว`,
        color: AMBER,
      }
    case "fbspam":
      return {
        title: "ฟีดแบคถูกส่งถี่ผิดปกติ",
        description: `${s(d.name)} ส่ง ${n(d.count)} ข้อความใน 24 ชม. (ครบเพดานของวัน)`,
        color: AMBER,
      }
    case "signups":
      return {
        title: "มีบัญชีสมัครใหม่มากผิดปกติ",
        description: `${n(d.count)} บัญชีใหม่ในชั่วโมง ${s(d.hour, 10)}`,
        color: RED,
      }
    case "suspended":
      return {
        title: "ระงับบัญชี",
        description: `${s(d.admin)} ระงับบัญชี ${s(d.name)}${d.note ? `\n${th.admin.noteLabel}: ${s(d.note, 200)}` : ""}`,
        color: GREY,
      }
    case "lifted":
      return { title: "ยกเลิกการระงับ", description: `${s(d.admin)} ยกเลิกการระงับ ${s(d.name)}`, color: GREY }
    case "push":
      return {
        title: "แจ้งเตือนส่งไม่ออก",
        description: `${ROUTES[String(d.route)] ?? s(d.route)}: ส่งไม่สำเร็จ ${n(d.failed)} เครื่อง ไม่มีเครื่องไหนได้รับ`,
        color: RED,
      }
    case "cron":
      return {
        title: "งานตั้งเวลาของ Vercel ล้มเหลว",
        description: `${ROUTES[String(d.route)] ?? s(d.route)}: ${s(d.error, 200)}`,
        color: RED,
      }
    case "summary":
      return {
        title: "สรุปประจำวัน",
        fields: [
          { name: th.admin.total, value: n(d.users) },
          { name: "สมัครใหม่ 24 ชม.", value: n(d.newDay) },
          { name: th.admin.activeDay, value: n(d.activeDay) },
          { name: th.admin.entriesDay, value: n(d.entriesDay) },
          { name: "ฟีดแบคค้าง", value: n(d.feedbackOpen) },
          { name: "บัญชีที่ถูกระงับ", value: n(d.suspended) },
          { name: th.admin.database, value: `${megabytes(Number(d.dbBytes ?? 0))} / ${megabytes(DB_LIMIT_BYTES)}` },
        ].map((f) => ({ ...f, inline: true })),
      }
    default:
      return { title: s(kind, 40), description: clip(JSON.stringify(d), 500) }
  }
}
