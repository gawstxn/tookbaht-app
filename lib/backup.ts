import type { Account, Goals, Settings, Subscription, Transaction } from "./types";

/** Everything a backup file carries, in the app's own shapes. */
export interface BackupData {
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  goals?: Goals;
  settings?: Settings;
}

export interface BackupFile extends BackupData {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
}

const BACKUP_APP = "tookbaht";
/** Bump when the file shape changes; older files must keep restoring. */
export const BACKUP_VERSION = 1;

export function makeBackup(data: BackupData, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    accounts: data.accounts,
    transactions: data.transactions,
    subscriptions: data.subscriptions,
    goals: data.goals,
    settings: data.settings,
  };
}

/** Why a file can't be restored: not JSON, not a Tookbaht backup, from a newer app, or damaged rows. */
export type BackupProblem = "json" | "format" | "newer" | "damaged";
export class BackupError extends Error {
  constructor(readonly problem: BackupProblem) {
    super(`backup: ${problem}`);
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const oneOf = (v: unknown, xs: readonly string[]) => typeof v === "string" && xs.includes(v);

const validAccount = (a: Account) => str(a?.id) && str(a.name) && oneOf(a.kind, ["bank", "saving", "credit", "cash"]) && typeof a.openingBalance === "number";
const validTransaction = (t: Transaction) =>
  str(t?.id) &&
  oneOf(t.type, ["in", "out", "move"]) &&
  positive(t.amount) &&
  DATE.test(t.date ?? "") &&
  (t.type === "move" ? str(t.fromId) && str(t.toId) : str(t.accountId));
const validSubscription = (s: Subscription) =>
  str(s?.id) && str(s.name) && positive(s.amount) && oneOf(s.cycle, ["week", "month", "year"]) && DATE.test(s.startDate ?? "") && str(s.accountId);

/**
 * Read a backup file. Rejects the whole file rather than restoring part of
 * it, since a restore replaces the user's current data.
 */
export function parseBackup(text: string): BackupData {
  let raw: Partial<BackupFile>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("json");
  }
  if (raw?.app !== BACKUP_APP || typeof raw.version !== "number") throw new BackupError("format");
  if (raw.version > BACKUP_VERSION) throw new BackupError("newer");
  const { accounts, transactions, subscriptions } = raw;
  if (!Array.isArray(accounts) || !Array.isArray(transactions) || !Array.isArray(subscriptions) || accounts.length === 0) throw new BackupError("format");
  if (!accounts.every(validAccount) || !transactions.every(validTransaction) || !subscriptions.every(validSubscription)) throw new BackupError("damaged");
  return {
    accounts: accounts.map((a) => ({ ...a, fxFeePct: a.fxFeePct ?? 0 })),
    transactions,
    subscriptions: subscriptions.map((s) => ({ ...s, currency: s.currency ?? "THB" })),
    goals: raw.goals,
    settings: raw.settings,
  };
}

/** "tookbaht-backup-2026-09-25.json" */
export function backupFileName(now = new Date()) {
  return `tookbaht-backup-${now.toISOString().slice(0, 10)}.json`;
}
