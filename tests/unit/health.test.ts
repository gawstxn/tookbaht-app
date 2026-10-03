import { afterEach, describe, expect, it, vi } from "vitest"
import { alertEmbed, bangkokDay, cronAlert, healthAlerts } from "@/lib/alertText"
import { discordMessage, feedbackEmbed, webhookSet, webhookUrl } from "@/lib/discord"
import { CRON_JOBS, cronChecks, overallStatus, rateStatus, sizeStatus, type CronJobRow } from "@/lib/health"

const HOUR = 60 * 60 * 1000
const MB = 1024 * 1024
const NOW = Date.now()
const job = (name: string, patch: Partial<CronJobRow> = {}): CronJobRow => ({
  job: name,
  schedule: "5 * * * *",
  active: true,
  lastStatus: "succeeded",
  lastRun: NOW - 10 * 60 * 1000,
  failedWeek: 0,
  ...patch,
})
const all = (patch: Record<string, Partial<CronJobRow>> = {}) =>
  Object.keys(CRON_JOBS).map((name) => job(name, patch[name]))
const statusOf = (rows: CronJobRow[], name: string) => cronChecks(rows, NOW).find((c) => c.id === `job:${name}`)

describe("scheduled database jobs", () => {
  it("are fine when each ran on time", () => {
    const checks = cronChecks(all(), NOW)
    expect(checks).toHaveLength(Object.keys(CRON_JOBS).length)
    expect(checks.every((c) => c.status === "ok" && c.at)).toBe(true)
  })

  it("fail when a job is missing, off, late, or its last run failed", () => {
    expect(statusOf([], "purge-old-logs")).toMatchObject({ status: "fail", detail: "jobMissing" })
    expect(statusOf(all({ "purge-old-logs": { active: false } }), "purge-old-logs")).toMatchObject({
      status: "fail",
      detail: "jobOff",
    })
    expect(
      statusOf(all({ "purge-old-logs": { lastStatus: "failed", failedWeek: 1 } }), "purge-old-logs"),
    ).toMatchObject({ status: "fail", detail: "jobFailed" })
    // The hourly job three hours ago is late; a nightly one isn't.
    const late = { lastRun: NOW - 3 * HOUR }
    expect(statusOf(all({ "log-due-subscriptions": late }), "log-due-subscriptions")).toMatchObject({
      status: "fail",
      detail: "jobStale",
    })
    expect(statusOf(all({ "purge-old-logs": late }), "purge-old-logs")).toMatchObject({ status: "ok" })
    expect(statusOf(all({ "purge-old-logs": { lastRun: NOW - 27 * HOUR } }), "purge-old-logs")).toMatchObject({
      status: "fail",
      detail: "jobStale",
    })
  })

  it("warn when a job has no run yet, or failed earlier in the week", () => {
    expect(statusOf(all({ "purge-old-logs": { lastRun: null, lastStatus: null } }), "purge-old-logs")).toMatchObject({
      status: "warn",
      detail: "jobNeverRan",
    })
    expect(statusOf(all({ "purge-old-logs": { failedWeek: 2 } }), "purge-old-logs")).toMatchObject({
      status: "warn",
      detail: "jobFailedBefore",
    })
  })
})

describe("health statuses", () => {
  it("database size turns amber at 80% and red at 95%", () => {
    expect([sizeStatus(100, 500), sizeStatus(400, 500), sizeStatus(475, 500)]).toEqual(["ok", "warn", "fail"])
  })

  it("an exchange rate a few days old is normal, a week old isn't", () => {
    const day = (n: number) => new Date(NOW - n * 24 * HOUR).toISOString().slice(0, 10)
    expect([rateStatus(day(3), NOW), rateStatus(day(8), NOW), rateStatus(null, NOW)]).toEqual(["ok", "warn", "warn"])
  })

  it("the worst check decides the headline", () => {
    expect(overallStatus([{ id: "a", status: "ok" }])).toBe("ok")
    expect(
      overallStatus([
        { id: "a", status: "ok" },
        { id: "b", status: "warn" },
      ]),
    ).toBe("warn")
    expect(
      overallStatus([
        { id: "a", status: "warn" },
        { id: "b", status: "fail" },
      ]),
    ).toBe("fail")
  })
})

describe("posting to Discord", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("only posts to a Discord webhook, one per channel", () => {
    vi.stubEnv("DISCORD_FEEDBACK_WEBHOOK_URL", "")
    expect([webhookSet("feedback"), webhookUrl("feedback")]).toEqual([false, null])
    vi.stubEnv("DISCORD_FEEDBACK_WEBHOOK_URL", "https://example.com/api/webhooks/123/abc")
    expect([webhookSet("feedback"), webhookUrl("feedback")]).toEqual([true, null])
    vi.stubEnv("DISCORD_FEEDBACK_WEBHOOK_URL", "https://discord.com.example.com/api/webhooks/123/abc")
    expect(webhookUrl("feedback")).toBeNull()
    vi.stubEnv("DISCORD_FEEDBACK_WEBHOOK_URL", " https://discord.com/api/webhooks/123456/aB-c_9 ")
    expect(webhookUrl("feedback")).toBe("https://discord.com/api/webhooks/123456/aB-c_9")
    // The alerts channel has its own setting.
    vi.stubEnv("DISCORD_ALERTS_WEBHOOK_URL", "")
    expect(webhookUrl("alerts")).toBeNull()
    vi.stubEnv("DISCORD_ALERTS_WEBHOOK_URL", "https://discord.com/api/webhooks/987/xyz")
    expect(webhookUrl("alerts")).toBe("https://discord.com/api/webhooks/987/xyz")
  })

  it("a report says who sent it, quotes the message and names where it came from", () => {
    const embed = feedbackEmbed(
      {
        message: "ปุ่มกดไม่ได้\nลองสองรอบแล้ว",
        name: "Somchai",
        page: "/add",
        appVersion: "1.44.0 (abc1234)",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      },
      NOW,
    )
    expect(embed.title).toBe("ฟีดแบคจาก Somchai")
    expect(embed.description).toBe("> ปุ่มกดไม่ได้\n> ลองสองรอบแล้ว")
    expect(embed.footer).toEqual({ text: "/add · v1.44.0 (abc1234) · iPhone · Safari" })
    expect(embed.fields).toBeUndefined()
    expect(embed.timestamp).toBe(new Date(NOW).toISOString())
  })

  it("nothing a user typed can ping or look like a mention", () => {
    const embed = feedbackEmbed({
      message: "@everyone @here ดูหน่อย",
      name: "@everyone",
      page: "",
      appVersion: "",
      userAgent: "",
    })
    expect(discordMessage([embed]).allowed_mentions).toEqual({ parse: [] })
    expect(JSON.stringify(embed)).not.toMatch(/@(everyone|here)/)
    expect(embed.description).toContain("ดูหน่อย")
    // Nothing known about where it came from: no empty footer (Discord refuses empty text).
    expect(embed.footer).toBeUndefined()
  })

  it("a report stays inside Discord's limits", () => {
    const embed = feedbackEmbed({
      message: "ก".repeat(5000),
      name: "ก".repeat(300),
      page: "",
      appVersion: "",
      userAgent: "",
    })
    expect(embed.description?.length).toBeLessThanOrEqual(4096)
    expect(embed.title.length).toBeLessThanOrEqual(256)
  })
})

describe("alerts", () => {
  it("a job that failed is raised once a day, a full database once per level", () => {
    expect(healthAlerts(all(), 100 * MB, NOW)).toEqual([])
    const day = bangkokDay(NOW)
    const alerts = healthAlerts(all({ "purge-old-logs": { lastStatus: "failed", failedWeek: 1 } }), 410 * MB, NOW)
    expect(alerts).toEqual([
      { key: `job:purge-old-logs:${day}`, kind: "job", data: { job: "purge-old-logs", detail: "jobFailed" } },
      { key: "db:warn", kind: "db", data: { bytes: 410 * MB } },
    ])
    expect(healthAlerts(all(), 480 * MB, NOW).map((a) => a.key)).toEqual(["db:fail"])
    // A job that only failed earlier in the week is on the screen, not an alert.
    expect(healthAlerts(all({ "purge-old-logs": { failedWeek: 2 } }), 0, NOW)).toEqual([])
    // A database without pg_cron has no jobs to miss.
    expect(healthAlerts([], 0, NOW)).toEqual([])
  })

  it("the day in a key is Bangkok's", () => {
    expect(bangkokDay(Date.parse("2026-10-03T16:59:00Z"))).toBe("2026-10-03")
    expect(bangkokDay(Date.parse("2026-10-03T17:00:00Z"))).toBe("2026-10-04")
  })

  it("a cron route that failed, or whose pushes all failed, is raised", () => {
    const day = bangkokDay(NOW)
    expect(cronAlert("evening", 500, { error: "VAPID keys are not configured" }, NOW)).toEqual({
      key: `cron:evening:${day}`,
      kind: "cron",
      data: { route: "evening", error: "VAPID keys are not configured" },
    })
    expect(cronAlert("reminders", 200, { reminders: 4, sent: 0, failed: 3 }, NOW)).toEqual({
      key: `push:reminders:${day}`,
      kind: "push",
      data: { route: "reminders", failed: 3 },
    })
    // Some got through, nothing to send, or only phones that dropped their subscription.
    expect(cronAlert("reminders", 200, { reminders: 4, sent: 2, failed: 1 }, NOW)).toBeNull()
    expect(cronAlert("reminders", 200, { reminders: 0, sent: 0 }, NOW)).toBeNull()
    expect(cronAlert("reminders", 200, { reminders: 2, sent: 0, failed: 0, removed: 2 }, NOW)).toBeNull()
  })

  it("every kind has its own words, with names and numbers only", () => {
    const kinds: Record<string, Record<string, unknown>> = {
      job: { job: "log-due-subscriptions", detail: "jobStale" },
      db: { bytes: 410 * MB },
      writes: { name: "Somchai", count: 2500 },
      cap: { name: "Somchai", table: "transactions", count: 30000 },
      fbspam: { name: "Somchai", count: 20 },
      signups: { count: 31, hour: "14:00" },
      suspended: { name: "Somchai", admin: "Admin", note: "สแปม" },
      lifted: { name: "Somchai", admin: "Admin", note: "" },
      push: { route: "evening", failed: 3 },
      cron: { route: "reminders", error: "boom" },
      summary: { users: 12, newDay: 1, activeDay: 5, suspended: 0, feedbackOpen: 2, entriesDay: 40, dbBytes: 30 * MB },
    }
    const embeds = Object.entries(kinds).map(([kind, data]) => alertEmbed({ key: kind, kind, data }))
    expect(new Set(embeds.map((e) => e.title)).size).toBe(embeds.length)
    for (const e of embeds) {
      expect(e.timestamp).toMatch(/^\d{4}-\d\d-\d\dT/)
      expect(e.title).not.toMatch(/^[a-z]+$/)
      expect(JSON.stringify(e)).not.toMatch(/undefined|NaN/)
    }
    const text = (kind: string) => alertEmbed({ key: kind, kind, data: kinds[kind] }).description
    expect(text("job")).toBe("จดรายการประจำอัตโนมัติ: ไม่ได้ทำงานตามเวลา")
    expect(text("db")).toBe("ใช้ไป 410 MB จาก 500 MB (82%)")
    expect(text("writes")).toBe("Somchai จดเพิ่ม 2,500 รายการใน 24 ชม.")
    expect(text("suspended")).toBe("Admin ระงับบัญชี Somchai\nเหตุผล: สแปม")
    expect(alertEmbed({ key: "s", kind: "summary", data: kinds.summary }).fields).toHaveLength(7)
    // Stamped with when the alert was raised, not when it was posted.
    const raised = "2026-10-04T01:15:00.000Z"
    expect(alertEmbed({ key: "j", kind: "job", data: kinds.job, created_at: raised }).timestamp).toBe(raised)
  })
})
