import type { Account, Goals, Iou, SavingsGoal, Settings, Subscription, Transaction, Wish } from "./types"

/** Everything a backup file carries, in the app's own shapes. */
export interface BackupData {
  accounts: Account[]
  transactions: Transaction[]
  subscriptions: Subscription[]
  /** Added in 1.11; older files have none. */
  ious?: Iou[]
  savingsGoals?: SavingsGoal[]
  /** Added in 1.26. */
  wishes?: Wish[]
  goals?: Goals
  settings?: Settings
}

export interface BackupFile extends BackupData {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
}

const BACKUP_APP = "tookbaht"
/** Bump when the file shape changes; older files must keep restoring. */
export const BACKUP_VERSION = 1

export function makeBackup(data: BackupData, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    accounts: data.accounts,
    transactions: data.transactions,
    subscriptions: data.subscriptions,
    ious: data.ious ?? [],
    savingsGoals: data.savingsGoals ?? [],
    wishes: data.wishes ?? [],
    goals: data.goals,
    settings: data.settings,
  }
}

/** Why a file can't be restored: not JSON, not a Tookbaht backup, from a newer app, or damaged rows. */
export type BackupProblem = "json" | "format" | "newer" | "damaged"
export class BackupError extends Error {
  constructor(readonly problem: BackupProblem) {
    super(`backup: ${problem}`)
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0
const oneOf = (v: unknown, xs: readonly string[]) => typeof v === "string" && xs.includes(v)

const validAccount = (a: Account) =>
  str(a?.id) &&
  str(a.name) &&
  oneOf(a.kind, ["bank", "saving", "credit", "cash"]) &&
  typeof a.openingBalance === "number"
const validTransaction = (t: Transaction) =>
  str(t?.id) &&
  oneOf(t.type, ["in", "out", "move"]) &&
  positive(t.amount) &&
  DATE.test(t.date ?? "") &&
  (t.type === "move" ? str(t.fromId) && str(t.toId) : str(t.accountId))
const validIou = (i: Iou) => str(i?.id) && str(i.person) && positive(i.amount) && DATE.test(i.date ?? "")
const validWish = (w: Wish) =>
  str(w?.id) &&
  str(w.name) &&
  positive(w.price) &&
  oneOf(w.status, ["waiting", "bought", "skipped"]) &&
  DATE.test(w.decideOn ?? "")
const validSavingsGoal = (g: SavingsGoal) =>
  str(g?.id) && str(g.name) && positive(g.target) && typeof g.saved === "number"
const validSubscription = (s: Subscription) =>
  str(s?.id) &&
  str(s.name) &&
  positive(s.amount) &&
  oneOf(s.cycle, ["week", "month", "year"]) &&
  DATE.test(s.startDate ?? "") &&
  str(s.accountId) &&
  (s.trialFrom == null || (DATE.test(s.trialFrom) && s.trialFrom < s.startDate))

/**
 * Read a backup file. Rejects the whole file rather than restoring part of
 * it, since a restore replaces the user's current data.
 */
export function parseBackup(text: string): BackupData {
  let raw: Partial<BackupFile>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError("json")
  }
  if (raw?.app !== BACKUP_APP || typeof raw.version !== "number") throw new BackupError("format")
  if (raw.version > BACKUP_VERSION) throw new BackupError("newer")
  const { accounts, transactions, subscriptions } = raw
  if (
    !Array.isArray(accounts) ||
    !Array.isArray(transactions) ||
    !Array.isArray(subscriptions) ||
    accounts.length === 0
  )
    throw new BackupError("format")
  if (!accounts.every(validAccount) || !transactions.every(validTransaction) || !subscriptions.every(validSubscription))
    throw new BackupError("damaged")
  const ious = raw.ious ?? []
  const savingsGoals = raw.savingsGoals ?? []
  const wishes = raw.wishes ?? []
  if (
    !Array.isArray(ious) ||
    !Array.isArray(savingsGoals) ||
    !ious.every(validIou) ||
    !savingsGoals.every(validSavingsGoal)
  )
    throw new BackupError("damaged")
  if (!Array.isArray(wishes) || !wishes.every(validWish)) throw new BackupError("damaged")
  return {
    accounts: accounts.map((a) => ({ ...a, fxFeePct: a.fxFeePct ?? 0 })),
    transactions,
    // Older backups predate recurring entries: everything was a subscription.
    subscriptions: subscriptions.map((s) => ({
      ...s,
      currency: s.currency ?? "THB",
      kind: s.kind ?? "subscription",
      entryType: s.entryType ?? "out",
    })),
    ious: ious.map((i) => ({ ...i, note: i.note ?? "" })),
    savingsGoals,
    wishes: wishes.map((w) => ({
      ...w,
      note: w.note ?? "",
      decidedOn: w.status === "waiting" ? null : (w.decidedOn ?? w.decideOn),
      transactionId: w.transactionId ?? null,
    })),
    goals: raw.goals,
    settings: raw.settings,
  }
}

/** "tookbaht-backup-2026-09-25.json" */
export function backupFileName(now = new Date()) {
  return `tookbaht-backup-${now.toISOString().slice(0, 10)}.json`
}
