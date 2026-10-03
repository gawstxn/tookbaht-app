/*
 * The admin "สถานะระบบ" screen: is the database reachable, did the scheduled
 * jobs run, are the keys the server needs set. /api/admin/health gathers the
 * facts; the judging lives here so it can be unit-tested. A check never
 * carries a key or a URL, only whether it is set and works.
 */

export type HealthStatus = "ok" | "warn" | "fail"

export interface HealthCheck {
  /** Names the row: locale key `admin.health.<id>`, or `job:<name>` for a scheduled job. */
  id: string
  status: HealthStatus
  /** Why, as locale key `admin.healthDetail.<detail>`. */
  detail?: string
  /** How long the check took. */
  ms?: number
  /** A time to show ("ran 5 minutes ago"). */
  at?: number
  /** A value to show as is ("23.4 MB / 500 MB", "2026-10-02"). */
  text?: string
}

export interface HealthReport {
  checks: HealthCheck[]
  version: string
  commit: string
  at: number
}

/** One row of admin_health(): a scheduled database job and its last run. */
export interface CronJobRow {
  job: string
  schedule: string
  active: boolean
  lastStatus: string | null
  lastRun: number | null
  failedWeek: number
}

const HOUR = 60 * 60 * 1000

/** The rows of system_health() / admin_health(): the database's own row (job is null), then one per job. */
export function parseHealth(rows: Record<string, unknown>[]): { dbBytes: number; jobs: CronJobRow[] } {
  return {
    dbBytes: Number(rows.find((r) => r.job === null)?.db_bytes ?? 0),
    jobs: rows
      .filter((r) => r.job !== null)
      .map((r) => ({
        job: String(r.job),
        schedule: String(r.schedule ?? ""),
        active: r.active === true,
        lastStatus: r.last_status === null ? null : String(r.last_status),
        lastRun: r.last_run ? Date.parse(String(r.last_run)) : null,
        failedWeek: Number(r.failed_week ?? 0),
      })),
  }
}

/**
 * The jobs the migrations schedule, and how long each may go without a run
 * before something is wrong (its interval plus slack).
 */
export const CRON_JOBS: Record<string, number> = {
  "log-due-subscriptions": 2 * HOUR,
  "purge-deleted-accounts": 26 * HOUR,
  "purge-old-logs": 26 * HOUR,
  "purge-cron-history": 26 * HOUR,
  "send-admin-alerts": 2 * HOUR,
}

/** One check per expected job; a job the database doesn't have is a failure. */
export function cronChecks(rows: CronJobRow[], now: number): HealthCheck[] {
  return Object.entries(CRON_JOBS).map(([name, maxAge]) => {
    const id = `job:${name}`
    const row = rows.find((r) => r.job === name)
    if (!row) return { id, status: "fail", detail: "jobMissing" }
    if (!row.active) return { id, status: "fail", detail: "jobOff" }
    // Nothing in the history yet: just scheduled, or the history was purged.
    if (row.lastRun === null) return { id, status: "warn", detail: "jobNeverRan" }
    const at = row.lastRun
    if (row.lastStatus === "failed") return { id, status: "fail", detail: "jobFailed", at }
    if (now - at > maxAge) return { id, status: "fail", detail: "jobStale", at }
    if (row.failedWeek > 0) return { id, status: "warn", detail: "jobFailedBefore", at }
    return { id, status: "ok", at }
  })
}

/** Red when the database is nearly full, amber from 80%. */
export function sizeStatus(bytes: number, limit: number): HealthStatus {
  const used = bytes / limit
  return used >= 0.95 ? "fail" : used >= 0.8 ? "warn" : "ok"
}

/** ECB skips weekends and holidays, so a rate a few days old is normal. */
export function rateStatus(date: string | null, now: number): HealthStatus {
  if (!date) return "warn"
  return now - Date.parse(date) > 5 * 24 * HOUR ? "warn" : "ok"
}

/** The worst status of the lot, for the line at the top. */
export function overallStatus(checks: HealthCheck[]): HealthStatus {
  return checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "ok"
}
