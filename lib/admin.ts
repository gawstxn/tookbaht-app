import type { SupabaseClient } from "@supabase/supabase-js"

/*
 * The admin screens (Profile → ผู้ดูแลระบบ): who uses the app, when they last
 * opened it, problem reports, and suspending an account that abuses the app.
 * Everything goes through admin_* database functions, which refuse anyone
 * whose profile isn't role "admin"; hiding the screens is only for tidiness.
 * Admins see names, emails, dates and a count of entries, never the entries.
 */

/** Rows fetched per page of users or reports. */
export const ADMIN_PAGE = 50
/** The Supabase free tier's database size. */
export const DB_LIMIT_BYTES = 500 * 1024 * 1024

export interface AdminUser {
  id: string
  name: string
  email: string
  avatar?: string
  role: "user" | "admin"
  createdAt: number
  /** Last time the app was opened or brought to the foreground; null when never since this was recorded. */
  lastActiveAt: number | null
  /** How many transactions the account keeps. */
  entries: number
  suspendedAt: number | null
  suspendedNote: string
  /** Closed by the user and waiting out the 30 days. */
  deletionRequestedAt: number | null
}

/** One account in more detail: counts and sizes, never what was logged. */
export interface AdminUserDetail {
  accounts: number
  subscriptions: number
  ious: number
  savingsGoals: number
  wishes: number
  entries: number
  /**
   * Entries added in the last 24 hours / 7 days. 20,000 entries built up over years is a heavy
   * user; 20,000 added today is a script writing in a loop.
   */
  entriesDay: number
  entriesWeek: number
  feedback: number
  feedbackDay: number
  /** Devices with notifications turned on. */
  pushDevices: number
  /** Size of the account's rows, without indexes. */
  dataBytes: number
}

/** The most rows one account may keep in each table (the enforce_row_cap triggers in supabase/migrations). */
export const ROW_CAPS = {
  entries: 30_000,
  accounts: 100,
  subscriptions: 300,
  ious: 5_000,
  savingsGoals: 100,
  wishes: 2_000,
  feedback: 100,
} as const

export interface AdminOverview {
  users: number
  activeDay: number
  activeWeek: number
  suspended: number
  feedbackOpen: number
  dbBytes: number
}

export interface AdminFeedback {
  id: string
  userId: string
  name: string
  email: string
  message: string
  appVersion: string
  page: string
  userAgent: string
  createdAt: number
  resolvedAt: number | null
}

type Row = Record<string, string | number | null>
const time = (v: string | number | null) => (v ? Date.parse(String(v)) : null)

export async function fetchAdminOverview(sb: SupabaseClient): Promise<AdminOverview> {
  const { data, error } = await sb.rpc("admin_overview")
  if (error) throw error
  const r = (data as Row[])[0]
  return {
    users: Number(r.users),
    activeDay: Number(r.active_day),
    activeWeek: Number(r.active_week),
    suspended: Number(r.suspended),
    feedbackOpen: Number(r.feedback_open),
    dbBytes: Number(r.db_bytes),
  }
}

export async function fetchAdminUsers(sb: SupabaseClient, search: string, offset = 0): Promise<AdminUser[]> {
  const { data, error } = await sb.rpc("admin_users", {
    p_search: search.trim(),
    p_limit: ADMIN_PAGE,
    p_offset: offset,
  })
  if (error) throw error
  return (data as Row[]).map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    email: String(r.email ?? ""),
    avatar: r.avatar ? String(r.avatar) : undefined,
    role: r.role === "admin" ? "admin" : "user",
    createdAt: time(r.created_at) ?? 0,
    lastActiveAt: time(r.last_active_at),
    entries: Number(r.entries),
    suspendedAt: time(r.suspended_at),
    suspendedNote: String(r.suspended_note ?? ""),
    deletionRequestedAt: time(r.deletion_requested_at),
  }))
}

export async function fetchAdminUserDetail(sb: SupabaseClient, userId: string): Promise<AdminUserDetail | null> {
  const { data, error } = await sb.rpc("admin_user_detail", { p_user: userId })
  if (error) throw error
  const r = (data as Row[])[0]
  if (!r) return null
  return {
    accounts: Number(r.accounts),
    subscriptions: Number(r.subscriptions),
    ious: Number(r.ious),
    savingsGoals: Number(r.savings_goals),
    wishes: Number(r.wishes),
    entries: Number(r.entries),
    entriesDay: Number(r.entries_day),
    entriesWeek: Number(r.entries_week),
    feedback: Number(r.feedback),
    feedbackDay: Number(r.feedback_day),
    pushDevices: Number(r.push_devices),
    dataBytes: Number(r.data_bytes),
  }
}

export async function setSuspended(sb: SupabaseClient, userId: string, suspended: boolean, note = "") {
  const { error } = await sb.rpc("admin_set_suspended", { p_user: userId, p_suspended: suspended, p_note: note.trim() })
  if (error) throw error
}

export async function fetchAdminFeedback(sb: SupabaseClient, openOnly: boolean, offset = 0): Promise<AdminFeedback[]> {
  const { data, error } = await sb.rpc("admin_feedback", {
    p_open_only: openOnly,
    p_limit: ADMIN_PAGE,
    p_offset: offset,
  })
  if (error) throw error
  return (data as Row[]).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    name: String(r.name ?? ""),
    email: String(r.email ?? ""),
    message: String(r.message ?? ""),
    appVersion: String(r.app_version ?? ""),
    page: String(r.page ?? ""),
    userAgent: String(r.user_agent ?? ""),
    createdAt: time(r.created_at) ?? 0,
    resolvedAt: time(r.resolved_at),
  }))
}

export async function resolveFeedback(sb: SupabaseClient, id: string, resolved: boolean) {
  const { error } = await sb.rpc("admin_resolve_feedback", { p_id: id, p_resolved: resolved })
  if (error) throw error
}

/** The database turned the request down because the account is suspended (check_request() in the migrations). */
export const isSuspended = (error: unknown): boolean => (error as { code?: string } | null)?.code === "PT403"

/** "iPhone · Safari" from a browser's user-agent string, for reading a problem report at a glance. */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : ""
  // Order matters: most browsers also claim to be Safari, and Chrome-based ones to be Chrome.
  const browser = /Line\//.test(ua)
    ? "LINE"
    : /FBAN|FBAV/.test(ua)
      ? "Facebook"
      : /EdgA?\/|EdgiOS/.test(ua)
        ? "Edge"
        : /Firefox|FxiOS/.test(ua)
          ? "Firefox"
          : /SamsungBrowser/.test(ua)
            ? "Samsung Internet"
            : /Chrome|CriOS/.test(ua)
              ? "Chrome"
              : /Safari/.test(ua)
                ? "Safari"
                : ""
  return [device, browser].filter(Boolean).join(" · ")
}

/** "21 KB" below a megabyte, then "3.4 MB". */
export function dataSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(0, Math.round(bytes / 1024))} KB` : megabytes(bytes)
}

/** "23.4 MB" */
export function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`
}
