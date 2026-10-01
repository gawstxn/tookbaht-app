import type { SupabaseClient } from "@supabase/supabase-js"

/*
 * Offline support. Every write the store makes is described as an Op; when
 * there's no connection it goes into a per-user outbox in localStorage and is
 * replayed in order once the device is back online. The last loaded data is
 * kept in localStorage too, so the app opens without a connection.
 */

type Row = Record<string, unknown>
export type Match = { col: string; eq: string | null } | { col: string; in: string[] }
export type Op =
  | { table: string; kind: "insert"; rows: Row | Row[] }
  | { table: string; kind: "upsert"; rows: Row }
  | { table: string; kind: "update"; values: Row; match: Match }
  | { table: string; kind: "delete"; match: Match }
  /** A database function, e.g. merge_settings (changes only the keys it's given). */
  | { kind: "rpc"; fn: string; args: Row }

export interface OpResult {
  error: { message?: string; code?: string; hint?: string } | null
  status: number
}

/**
 * How long a write may take before it's given up on and queued. A write that
 * landed anyway is harmless to replay: inserts come back as duplicates, the
 * rest set the same values again.
 */
export const WRITE_TIMEOUT = 15_000

function query(sb: SupabaseClient, op: Op) {
  if (op.kind === "rpc") return sb.rpc(op.fn, op.args)
  const from = sb.from(op.table)
  if (op.kind === "insert") return from.insert(op.rows)
  if (op.kind === "upsert") return from.upsert(op.rows)
  const q = op.kind === "update" ? from.update(op.values) : from.delete()
  return "in" in op.match ? q.in(op.match.col, op.match.in) : q.eq(op.match.col, op.match.eq)
}

/** Run one write against the database; a request that hangs is aborted after `timeout` (status 0). */
export function runOp(sb: SupabaseClient, op: Op, timeout = WRITE_TIMEOUT): Promise<OpResult> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeout)
  return Promise.resolve(query(sb, op).abortSignal(abort.signal)).finally(() => clearTimeout(timer))
}

/**
 * The server never took the write: no connection, a timeout, or the backend
 * down or overloaded (5xx, 408, 429). Worth retrying later. A refused write
 * (constraint, RLS, row cap) comes back as 4xx and is not.
 */
export function isRetryable(r: OpResult): boolean {
  if (!r.error) return false
  // supabase-js reports a failed or aborted fetch with status 0; an expired session (401) also clears up after reconnecting.
  if (r.status === 0 || r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500) return true
  return /failed to fetch|networkerror|load failed|network request failed/i.test(r.error.message ?? "")
}

/** A server error that outlasts this is a write the server can't take, not an outage. */
export const OUTAGE_LIMIT = 3 * 24 * 60 * 60 * 1000

/** Whether a queued write that just failed should stay at the head of the queue and be tried again later. */
export function keepQueued(r: OpResult, queuedAt: number, now = Date.now()): boolean {
  if (!isRetryable(r)) return false
  // Don't let one write the server keeps failing on hold back everything behind it forever.
  return r.status < 500 || now - queuedAt < OUTAGE_LIMIT
}

/** A replayed insert that had already landed before the connection dropped. */
export function isDuplicate(r: OpResult): boolean {
  return r.error?.code === "23505"
}

/* ---------- storage ---------- */

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const storage = (): KeyValueStore | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

const read = <T>(s: KeyValueStore | null, key: string, fallback: T): T => {
  try {
    const raw = s?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (s: KeyValueStore | null, key: string, value: unknown) => {
  try {
    s?.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Full or unavailable storage: offline support degrades, the app still works online.
    return false
  }
}

export interface QueuedOp {
  id: string
  op: Op
  at: number
}

/** Writes waiting for a connection, oldest first. */
export function outbox(userId: string, s = storage()) {
  const key = `tookbaht-outbox:${userId}`
  return {
    list: () => read<QueuedOp[]>(s, key, []),
    push(op: Op) {
      const list = this.list()
      list.push({ id: crypto.randomUUID(), op, at: Date.now() })
      return write(s, key, list) ? list.length : 0
    },
    /** Remove the first entry once it has been sent (or given up on). */
    shift(id: string) {
      const list = this.list().filter((q) => q.id !== id)
      if (list.length) write(s, key, list)
      else s?.removeItem(key)
      return list.length
    },
    clear: () => s?.removeItem(key),
  }
}

/** The last data shown, so the app can open offline. */
export function snapshot<T>(userId: string, s = storage()) {
  const key = `tookbaht-cache:${userId}`
  return {
    read: () => read<{ v: 1; savedAt: number; data: T } | null>(s, key, null),
    save: (data: T) => write(s, key, { v: 1, savedAt: Date.now(), data }),
    clear: () => s?.removeItem(key),
  }
}

/** False when the browser knows it has no connection. */
export function online() {
  return typeof navigator === "undefined" || navigator.onLine !== false
}
