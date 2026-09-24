"use client";

import { toRow } from "./db";
import { getSupabase } from "./supabase/client";
import type { Account, Goals, Settings, Subscription, Transaction } from "./types";

/** Data saved by the offline-only version of the app. */
const LEGACY_KEY = "tookbaht-v1";
const IMPORTED_KEY = "tookbaht-v1-imported";

export interface LegacyData {
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  goals?: Goals;
  settings?: Settings;
}

/** Local data from the previous version, if any is waiting to be imported. */
export function readLegacyData(): LegacyData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw)?.state;
    if (!Array.isArray(s?.accounts) || s.accounts.length === 0) return null;
    return {
      accounts: s.accounts,
      transactions: Array.isArray(s.transactions) ? s.transactions : [],
      subscriptions: Array.isArray(s.subscriptions) ? s.subscriptions : [],
      goals: s.goals,
      settings: s.settings,
    };
  } catch {
    return null;
  }
}

/** Keep the old data as a backup under another key so it isn't offered again. */
export function dismissLegacyData() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) localStorage.setItem(IMPORTED_KEY, raw);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage unavailable — nothing to dismiss.
  }
}

const CHUNK = 500;

/** Import legacy data, then retire the local copy. */
export async function importLegacyData(userId: string, data: LegacyData): Promise<void> {
  await importData(userId, data);
  dismissLegacyData();
}

/**
 * Copy app data (legacy export or sample data) into the signed-in user's
 * database rows. Old ids aren't UUIDs, so every row gets a new id and
 * references are remapped. If a step fails, rows inserted so far are removed.
 */
export async function importData(userId: string, data: LegacyData): Promise<void> {
  const sb = getSupabase();
  const ids = new Map<string, string>();
  const newId = (old?: string) => {
    if (!old) return undefined;
    if (!ids.has(old)) ids.set(old, crypto.randomUUID());
    return ids.get(old);
  };

  // Skip rows pointing at accounts that no longer exist; the database would reject them.
  const hasAcc = new Set(data.accounts.map((a) => a.id));
  const accounts = data.accounts.map((a, i) => ({ ...toRow.account({ ...a, id: newId(a.id) }), sort_order: i }));
  const subs = data.subscriptions.filter((s) => hasAcc.has(s.accountId));
  const subscriptions = subs.map((s) => toRow.subscription({ ...s, id: newId(s.id), accountId: newId(s.accountId) }));
  const knownSubs = new Set(subs.map((s) => s.id));
  const transactions = data.transactions
    .filter((t) =>
      t.amount > 0 && (t.type === "move" ? hasAcc.has(t.fromId!) && hasAcc.has(t.toId!) && t.fromId !== t.toId : hasAcc.has(t.accountId!)),
    )
    .map((t) =>
      toRow.transaction({
        ...t,
        id: newId(t.id),
        accountId: newId(t.accountId),
        fromId: newId(t.fromId),
        toId: newId(t.toId),
        subscriptionId: t.subscriptionId && knownSubs.has(t.subscriptionId) ? newId(t.subscriptionId) : undefined,
      }),
    );

  const inserted: { table: string; ids: string[] }[] = [];
  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await sb.from(table).insert(chunk);
      if (error) throw error;
      inserted.push({ table, ids: chunk.map((r) => r.id as string) });
    }
  };

  try {
    await insert("accounts", accounts);
    await insert("subscriptions", subscriptions);
    await insert("transactions", transactions);
    if (data.goals) {
      const { error } = await sb.from("goals").upsert({ user_id: userId, ...toRow.goals(data.goals) });
      if (error) throw error;
    }
    if (data.settings) await sb.from("profiles").update({ settings: data.settings }).eq("id", userId);
  } catch (e) {
    for (const { table, ids } of inserted.reverse()) await sb.from(table).delete().in("id", ids);
    throw e;
  }
}
