import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Offline support. Every write the store makes is described as an Op; when
 * there's no connection it goes into a per-user outbox in localStorage and is
 * replayed in order once the device is back online. The last loaded data is
 * kept in localStorage too, so the app opens without a connection.
 */

type Row = Record<string, unknown>;
export type Match = { col: string; eq: string | null } | { col: string; in: string[] };
export type Op =
  | { table: string; kind: "insert"; rows: Row | Row[] }
  | { table: string; kind: "upsert"; rows: Row }
  | { table: string; kind: "update"; values: Row; match: Match }
  | { table: string; kind: "delete"; match: Match };

export interface OpResult {
  error: { message?: string; code?: string; hint?: string } | null;
  status: number;
}

/** Run one write against the database. */
export function runOp(sb: SupabaseClient, op: Op): PromiseLike<OpResult> {
  const from = sb.from(op.table);
  if (op.kind === "insert") return from.insert(op.rows);
  if (op.kind === "upsert") return from.upsert(op.rows);
  const q = op.kind === "update" ? from.update(op.values) : from.delete();
  return "in" in op.match ? q.in(op.match.col, op.match.in) : q.eq(op.match.col, op.match.eq);
}

/** The request never reached the server (or its answer never came back): worth retrying later. */
export function isNetworkError(r: OpResult): boolean {
  if (!r.error) return false;
  // supabase-js reports a failed fetch with status 0; an expired session (401) also clears up after reconnecting.
  return r.status === 0 || r.status === 401 || /failed to fetch|networkerror|load failed|network request failed/i.test(r.error.message ?? "");
}

/** A replayed insert that had already landed before the connection dropped. */
export function isDuplicate(r: OpResult): boolean {
  return r.error?.code === "23505";
}

/* ---------- storage ---------- */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const storage = (): KeyValueStore | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const read = <T>(s: KeyValueStore | null, key: string, fallback: T): T => {
  try {
    const raw = s?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (s: KeyValueStore | null, key: string, value: unknown) => {
  try {
    s?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Full or unavailable storage: offline support degrades, the app still works online.
    return false;
  }
};

export interface QueuedOp {
  id: string;
  op: Op;
  at: number;
}

/** Writes waiting for a connection, oldest first. */
export function outbox(userId: string, s = storage()) {
  const key = `tookbaht-outbox:${userId}`;
  return {
    list: () => read<QueuedOp[]>(s, key, []),
    push(op: Op) {
      const list = this.list();
      list.push({ id: crypto.randomUUID(), op, at: Date.now() });
      return write(s, key, list) ? list.length : 0;
    },
    /** Remove the first entry once it has been sent (or given up on). */
    shift(id: string) {
      const list = this.list().filter((q) => q.id !== id);
      if (list.length) write(s, key, list);
      else s?.removeItem(key);
      return list.length;
    },
    clear: () => s?.removeItem(key),
  };
}

/** The last data shown, so the app can open offline. */
export function snapshot<T>(userId: string, s = storage()) {
  const key = `tookbaht-cache:${userId}`;
  return {
    read: () => read<{ v: 1; savedAt: number; data: T } | null>(s, key, null),
    save: (data: T) => write(s, key, { v: 1, savedAt: Date.now(), data }),
    clear: () => s?.removeItem(key),
  };
}

/** False when the browser knows it has no connection. */
export function online() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
