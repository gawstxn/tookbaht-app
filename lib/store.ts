"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { TYPE_META, registerCustomCategories } from "./constants";
import { fetchAll, fromRow, toRow, type IouRow, type TransactionRow } from "./db";
import { applyLang, currentLang, t, type Lang } from "./i18n";
import { TERMS_VERSION } from "./legal";
import { baht, shortDate, toISO, todayISO } from "./format";
import { impliedFeePct, type UsdRate } from "./fx";
import { cycleStartDay, periodFor, periodOf, type Period } from "./period";
import { clearTripDrafts } from "./tripSplit";
import { isDuplicate, isRetryable, keepQueued, online, outbox, runOp, snapshot, type Op } from "./offline";
import { getSupabase } from "./supabase/client";
import type { Account, Goals, Iou, SavingsGoal, Settings, Subscription, Transaction, User, Wish } from "./types";

const EMPTY_GOALS: Goals = { incomeTarget: 0, expenseBudget: 0, categoryBudgets: {}, alertAt80: true };

type Status = "idle" | "loading" | "ready" | "error";

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
  /** e.g. "เลิกทำ" after a delete. */
  action?: { label: string; run: () => void };
}

interface State {
  status: Status;
  userId: string | null;
  user: User | null;
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  ious: Iou[];
  savingsGoals: SavingsGoal[];
  wishes: Wish[];
  goals: Goals;
  settings: Settings;
  /** Selected month on overview/list screens, "YYYY-MM". */
  viewMonth: string;
  /** Feedback for the last change (or failed save). */
  toast: Toast | null;
  /** Latest THB per USD, for estimating USD subscriptions. */
  usdRate: UsdRate | null;
  /** Set while the account is closed and waiting to be deleted (30 days after this). */
  deletionRequestedAt: string | null;
  /** Changes saved on this device, waiting for a connection. */
  pending: number;
  /** Showing data saved on this device because the server couldn't be reached. */
  offline: boolean;
}

interface Actions {
  /** Fetch everything for the signed-in user. */
  load: (userId: string) => Promise<void>;
  /** Send changes made offline (does nothing without any, or still without a connection). Resolves how many the server refused. */
  flush: () => Promise<number>;
  /** Send offline changes, then refresh from the server in the background. */
  sync: (refetch?: boolean) => Promise<void>;
  /**
   * Signed out without using the button (session expired or revoked elsewhere):
   * drop this account's data copy from the device. Unsynced changes stay, so
   * they are sent if the same user signs back in.
   */
  signedOut: () => void;
  /** Clear in-memory data (after sign-out). */
  reset: () => void;
  signOut: () => Promise<void>;
  /** Close the account (deleted for good after 30 days) and sign out. Needs a fresh sign-in; resolves the purge date. */
  deleteAccount: () => Promise<string | null>;
  /** Restore an account that is waiting to be deleted. */
  cancelDeletion: () => Promise<boolean>;
  setViewMonth: (key: string) => void;
  notify: (text: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;
  dismissToast: () => void;

  addAccount: (a: Omit<Account, "id">) => string;
  updateAccount: (id: string, patch: Partial<Omit<Account, "id">>) => void;
  /** Resolves false when the account is still used by transactions or subscriptions. */
  removeAccount: (id: string) => Promise<boolean>;

  /** Save a new entry; `undoable` puts an undo button on the toast (one-tap quick entries). */
  addTransaction: (t: Omit<Transaction, "id" | "createdAt">, opts?: { undoable?: boolean }) => string;
  /** Several entries at once (e.g. a batch of slips), with one toast that can undo them all. */
  addTransactions: (list: Omit<Transaction, "id" | "createdAt">[]) => void;
  /** Edit a saved transaction. Correcting a USD charge also learns the card's real FX fee. */
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id" | "createdAt">>) => void;
  /** Make sure a recent USD rate is loaded (fetches one when stored rates are old). */
  ensureUsdRate: () => Promise<void>;
  deleteTransaction: (id: string) => void;

  addSubscription: (s: Omit<Subscription, "id">) => string;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  /** Log due subscription charges as expenses (idempotent across devices). */
  runAutoLog: () => Promise<void>;

  /** Record what friends owe (one row per friend when splitting a bill). */
  addIous: (items: Omit<Iou, "id" | "createdAt">[]) => void;
  updateIou: (id: string, patch: Partial<Omit<Iou, "id" | "createdAt">>) => void;
  /**
   * Mark a debt paid back. With an account: money a friend paid back is logged
   * there as a repayment (it lowers spending); money the user paid a friend is
   * logged as an expense in `category` (the friend had paid for it).
   */
  settleIou: (id: string, accountId?: string, category?: string) => void;
  deleteIou: (id: string) => void;

  addSavingsGoal: (g: Omit<SavingsGoal, "id">) => string;
  updateSavingsGoal: (id: string, patch: Partial<Omit<SavingsGoal, "id">>) => void;
  deleteSavingsGoal: (id: string) => void;
  /** Put money towards a manual goal (negative takes some out). */
  addToSavings: (id: string, amount: number) => void;

  /** Wishlist: park something to buy until a day to decide. */
  addWish: (w: Pick<Wish, "name" | "price" | "note" | "decideOn">) => void;
  /** Bought (logged as an expense from `accountId`) or not buying after all. */
  decideWish: (id: string, status: "bought" | "skipped", accountId?: string) => void;
  /** Back to waiting (the expense it became is left alone). */
  reopenWish: (id: string) => void;
  deleteWish: (id: string) => void;

  /** Send a problem report from the profile screen. Resolves false when it couldn't be sent. */
  sendFeedback: (message: string, page: string) => Promise<boolean>;

  setGoals: (g: Goals) => void;
  setSettings: (s: Partial<Settings>) => void;
  /** Change the display name and/or picked avatar (undefined avatar = show the initial). */
  updateProfile: (p: { name: string; avatar?: string }) => void;
  /** Confirm no spending on `day` (today, or a missed day being restored) for the streak. */
  markNoSpend: (day: string) => void;
  /** Switch the UI language and remember it on the profile. */
  setLanguage: (lang: Lang) => void;
  /** Record that the user accepted the current terms and privacy policy. */
  acceptTerms: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const initial: State = {
  status: "idle",
  userId: null,
  user: null,
  accounts: [],
  transactions: [],
  subscriptions: [],
  ious: [],
  savingsGoals: [],
  wishes: [],
  goals: EMPTY_GOALS,
  settings: { faceLock: false },
  viewMonth: todayISO().slice(0, 7),
  toast: null,
  usdRate: null,
  deletionRequestedAt: null,
  pending: 0,
  offline: false,
};

/** What is kept on the device so the app opens offline. */
type Snapshot = Pick<State, "user" | "accounts" | "transactions" | "subscriptions" | "ious" | "savingsGoals" | "wishes" | "goals" | "settings" | "usdRate" | "deletionRequestedAt">;
export const toSnapshot = (s: State): Snapshot => ({
  user: s.user,
  accounts: s.accounts,
  transactions: s.transactions,
  subscriptions: s.subscriptions,
  ious: s.ious,
  savingsGoals: s.savingsGoals,
  wishes: s.wishes,
  goals: s.goals,
  settings: s.settings,
  usdRate: s.usdRate,
  deletionRequestedAt: s.deletionRequestedAt,
});

const SAVE_FAILED = () => t("toast.saveFailed");
/** Give up on loading after this long (a weak signal can leave requests hanging). */
const FETCH_TIMEOUT = 15_000;
const within = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))]);
const UNDO = () => t("common.undo");
let toastSeq = 0;

export const useStore = create<State & Actions>()((set, get) => {
  const sb = () => getSupabase();
  const ok = (text: string, action?: Toast["action"]) => get().notify(text, { action });

  type Row = Record<string, unknown>;
  const ins = (table: string, rows: Row | Row[]): Op => ({ table, kind: "insert", rows });
  const ups = (table: string, rows: Row): Op => ({ table, kind: "upsert", rows });
  const upd = (table: string, values: Row, id: string): Op => ({ table, kind: "update", values, match: { col: "id", eq: id } });
  const del = (table: string, id: string): Op => ({ table, kind: "delete", match: { col: "id", eq: id } });

  const queue = (op: Op) => {
    const userId = get().userId;
    const n = userId ? outbox(userId).push(op) : 0;
    if (n) set({ pending: n });
    return n > 0;
  };

  const send = async (op: Op, undo: () => void, message: string, queueable: boolean) => {
    // Keep writes in order: once anything is queued, later writes queue behind it.
    if (queueable && (get().pending > 0 || !online()) && queue(op)) return true;
    const res = await runOp(sb(), op);
    if (!res.error || isDuplicate(res)) return true;
    if (isRetryable(res)) {
      if (queueable && queue(op)) return true;
      undo();
      get().notify(t(online() ? "offline.serverDown" : "offline.needsConnection"), { tone: "error" });
      return false;
    }
    console.error(res.error);
    undo();
    get().notify(res.error.hint === "row_limit" ? t("toast.rowLimit") : message, { tone: "error" });
    return false;
  };
  let lastSave: Promise<unknown> = Promise.resolve();
  /**
   * Run a write; on failure undo the optimistic change and show an error toast.
   * Without a connection, or while the server is down or not answering, the
   * write waits in the outbox instead and the change stays on screen (unless
   * `queueable` is false: the server must answer now).
   * Writes go out one at a time, so one that hangs and ends up queued still
   * stays ahead of the writes made after it.
   */
  const save = (op: Op, undo: () => void, message = SAVE_FAILED(), { queueable = true } = {}) => {
    const run = lastSave.then(() => send(op, undo, message, queueable));
    lastSave = run.catch(() => {});
    return run;
  };
  let flushing = false;
  let syncing = false;

  /** After fresh data arrives: language, charges due now, the USD rate. */
  const afterFetch = (data: Awaited<ReturnType<typeof fetchAll>>) => {
    // The profile's language wins; if it has none yet, store the one in use.
    if (data.settings.lang) applyLang(data.settings.lang);
    else get().setSettings({ lang: currentLang() });
    void get().runAutoLog();
    if (data.subscriptions.some((s) => s.currency === "USD")) void get().ensureUsdRate();
  };

  const insertTransaction = (tx: Transaction) => {
    set((s) => ({ transactions: [...s.transactions, tx] }));
    return save(ins("transactions", toRow.transaction(tx)), () =>
      set((s) => ({ transactions: s.transactions.filter((x) => x.id !== tx.id) })),
    );
  };
  const insertAccount = (account: Account, sortOrder: number) => {
    set((s) => ({ accounts: [...s.accounts, account] }));
    return save(ins("accounts", { ...toRow.account(account), sort_order: sortOrder }), () =>
      set((s) => ({ accounts: s.accounts.filter((x) => x.id !== account.id) })),
    );
  };
  const insertSubscription = (sub: Subscription) => {
    set((s) => ({ subscriptions: [...s.subscriptions, sub] }));
    return save(ins("subscriptions", toRow.subscription(sub)), () =>
      set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== sub.id) })),
    );
  };

  const insertIous = (items: Iou[]) => {
    const ids = new Set(items.map((i) => i.id));
    set((s) => ({ ious: [...s.ious, ...items] }));
    return save(ins("ious", items.map(toRow.iou)), () => set((s) => ({ ious: s.ious.filter((x) => !ids.has(x.id)) })));
  };
  const patchIou = (id: string, patch: Partial<Iou>) => {
    const prev = get().ious.find((x) => x.id === id);
    if (!prev) return Promise.resolve(false);
    set((s) => ({ ious: s.ious.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    return save(upd("ious", toRow.iou(patch), id), () => set((s) => ({ ious: s.ious.map((x) => (x.id === id ? prev : x)) })));
  };
  const insertSavingsGoal = (goal: SavingsGoal) => {
    set((s) => ({ savingsGoals: [...s.savingsGoals, goal] }));
    return save(ins("savings_goals", toRow.savingsGoal(goal)), () =>
      set((s) => ({ savingsGoals: s.savingsGoals.filter((x) => x.id !== goal.id) })),
    );
  };
  const patchSavingsGoal = (id: string, patch: Partial<SavingsGoal>) => {
    const prev = get().savingsGoals.find((x) => x.id === id);
    if (!prev) return;
    set((s) => ({ savingsGoals: s.savingsGoals.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    void save(upd("savings_goals", toRow.savingsGoal(patch), id), () =>
      set((s) => ({ savingsGoals: s.savingsGoals.map((x) => (x.id === id ? prev : x)) })),
    );
  };

  return {
    ...initial,

    load: async (userId) => {
      set({ status: "loading", userId, pending: outbox(userId).list().length });
      // With a copy on this device, show it at once and refresh in the background:
      // opening never waits on the network (a weak signal can hang for a long time).
      const cached = snapshot<Snapshot>(userId).read();
      if (cached) {
        // Copies saved before the wishlist existed lack it.
        set({ ...cached.data, wishes: cached.data.wishes ?? [], status: "ready", offline: false });
        if (cached.data.settings.lang) applyLang(cached.data.settings.lang);
        void get().sync(true);
        return;
      }
      try {
        await get().flush();
        const data = await within(fetchAll(sb(), userId), FETCH_TIMEOUT);
        if (get().userId !== userId) return;
        set({ ...data, goals: data.goals ?? EMPTY_GOALS, status: "ready", offline: false });
        afterFetch(data);
      } catch (e) {
        console.error(e);
        if (get().userId === userId) set({ status: "error" });
      }
    },
    flush: async () => {
      const userId = get().userId;
      if (!userId || flushing || !online()) return 0;
      const box = outbox(userId);
      if (!box.list().length) return 0;
      flushing = true;
      let dropped = 0;
      let stalled = false;
      try {
        // Refreshes an access token that expired while offline.
        await sb().auth.getSession();
        for (let next = box.list()[0]; next; next = box.list()[0]) {
          const res = await runOp(sb(), next.op);
          if (res.error && keepQueued(res, next.at)) {
            stalled = true;
            break;
          }
          if (res.error && !isDuplicate(res)) {
            console.error("dropped an offline change", next.op, res.error);
            dropped++;
          }
          set({ pending: box.shift(next.id) });
        }
      } catch (e) {
        console.error(e);
        stalled = true;
      } finally {
        flushing = false;
      }
      if (stalled || get().userId !== userId) return dropped;
      if (dropped) get().notify(t("offline.dropped", { count: dropped }), { tone: "error" });
      else get().notify(t("offline.synced"));
      void get().runAutoLog();
      return dropped;
    },
    sync: async (refetch = false) => {
      if (syncing) return;
      syncing = true;
      try {
        // The server turned some changes down: show what it has instead.
        if ((await get().flush()) > 0) refetch = true;
        const userId = get().userId;
        // Showing this device's copy, or the server turned changes down: fetch.
        if (!userId || get().status !== "ready" || get().pending > 0 || !(refetch || get().offline)) return;
        if (!online()) return void set({ offline: true });
        // Swap in fresh data without leaving the screen (no loading state).
        try {
          const data = await within(fetchAll(sb(), userId), FETCH_TIMEOUT);
          if (get().userId !== userId || get().pending > 0) return;
          set({ ...data, goals: data.goals ?? EMPTY_GOALS, offline: false });
          afterFetch(data);
        } catch (e) {
          console.error(e);
          if (get().userId === userId) set({ offline: true });
        }
      } finally {
        syncing = false;
      }
    },
    signedOut: () => {
      const userId = get().userId;
      if (userId) snapshot(userId).clear();
      get().reset();
    },
    reset: () => set({ ...initial, viewMonth: todayISO().slice(0, 7) }),
    signOut: async () => {
      const userId = get().userId;
      await sb().auth.signOut();
      // Nothing of this account stays on a shared device.
      if (userId) {
        snapshot(userId).clear();
        outbox(userId).clear();
      }
      clearTripDrafts();
      get().reset();
    },
    deleteAccount: async () => {
      const { data, error } = await sb().rpc("request_account_deletion");
      if (error) {
        console.error(error);
        get().notify(t("toast.deleteAccountFailed"), { tone: "error" });
        return null;
      }
      await sb().auth.signOut({ scope: "local" });
      const userId = get().userId;
      if (userId) {
        snapshot(userId).clear();
        outbox(userId).clear();
      }
      clearTripDrafts();
      get().reset();
      // The purge date in this device's calendar (the server returns a UTC timestamp).
      return toISO(new Date(String(data)));
    },
    cancelDeletion: async () => {
      const { error } = await sb().rpc("cancel_account_deletion");
      if (error) {
        console.error(error);
        get().notify(t("toast.saveFailed"), { tone: "error" });
        return false;
      }
      set({ deletionRequestedAt: null });
      get().notify(t("deletion.restored"));
      return true;
    },
    setViewMonth: (viewMonth) => set({ viewMonth }),
    notify: (text, opts) => {
      set({ toast: { id: ++toastSeq, text, tone: opts?.tone ?? "ok", action: opts?.action } });
      // A light tap on Android; iOS doesn't expose vibration to web apps.
      if (opts?.tone !== "error") navigator.vibrate?.(10);
    },
    dismissToast: () => set({ toast: null }),

    addAccount: (a) => {
      const account: Account = { ...a, id: crypto.randomUUID() };
      void insertAccount(account, get().accounts.length);
      ok(t("toast.accountAdded", { name: account.name }));
      return account.id;
    },
    updateAccount: (id, patch) => {
      const prev = get().accounts.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      ok(t("toast.saved"));
      void save(upd("accounts", toRow.account(patch), id), () =>
        set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? prev : x)) })),
      );
    },
    removeAccount: async (id) => {
      const prev = get().accounts;
      const index = prev.findIndex((x) => x.id === id);
      const account = prev[index];
      if (!account) return false;
      // Not optimistic: a refused delete (still in use) must not make the account vanish and reappear.
      const done = await save(del("accounts", id), () => {}, t("toast.accountInUse"), { queueable: false });
      if (done) set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }));
      if (done) ok(t("toast.accountDeleted", { name: account.name }), { label: UNDO(), run: () => void insertAccount(account, index) });
      return done;
    },

    addTransaction: (input, opts) => {
      const tx: Transaction = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
      const saved = insertTransaction(tx);
      const undo = () =>
        void saved.then((done) => {
          if (!done) return;
          set((s) => ({ transactions: s.transactions.filter((x) => x.id !== tx.id) }));
          void save(del("transactions", tx.id), () => set((s) => ({ transactions: [...s.transactions, tx] })));
        });
      ok(
        t("toast.txSaved", { type: tx.type === "move" ? t("type.moveLong") : TYPE_META[tx.type].label, amount: baht(tx.amount) }),
        opts?.undoable ? { label: UNDO(), run: undo } : undefined,
      );
      return tx.id;
    },
    addTransactions: (list) => {
      if (!list.length) return;
      const now = Date.now();
      const txs: Transaction[] = list.map((input, i) => ({ ...input, id: crypto.randomUUID(), createdAt: now + i }));
      const saved = txs.map((tx) => insertTransaction(tx));
      const undo = () =>
        txs.forEach((tx, i) =>
          void saved[i].then((done) => {
            if (!done) return;
            set((s) => ({ transactions: s.transactions.filter((x) => x.id !== tx.id) }));
            void save(del("transactions", tx.id), () => set((s) => ({ transactions: [...s.transactions, tx] })));
          }),
        );
      ok(t("toast.txBatch", { count: txs.length, amount: baht(txs.reduce((a, x) => a + x.amount, 0)) }), { label: UNDO(), run: undo });
    },
    updateTransaction: (id, patch) => {
      const prev = get().transactions.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ transactions: s.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      ok(t("toast.saved"));
      void save(upd("transactions", toRow.transaction({ ...prev, ...patch }), id), () =>
        set((s) => ({ transactions: s.transactions.map((x) => (x.id === id ? prev : x)) })),
      ).then((done) => {
        // A corrected USD charge tells us what the card really adds on top of the rate.
        const acc = get().accounts.find((a) => a.id === (patch.accountId ?? prev.accountId));
        if (!done || !acc || !prev.origAmount || !prev.fxRate || patch.amount === undefined || patch.amount === prev.amount) return;
        const fee = impliedFeePct(patch.amount, prev.origAmount, prev.fxRate);
        if (Math.abs(fee - acc.fxFeePct) < 0.05) return;
        const before = acc.fxFeePct;
        get().updateAccount(acc.id, { fxFeePct: fee });
        get().notify(t("toast.feeLearned", { name: acc.name, pct: fee }), {
          action: { label: t("common.undo"), run: () => get().updateAccount(acc.id, { fxFeePct: before }) },
        });
      });
    },
    ensureUsdRate: async () => {
      const current = get().usdRate;
      if (current && Date.now() - Date.parse(current.date) < 40 * 3_600_000) return;
      try {
        const res = await fetch("/api/rates");
        const body = (await res.json()) as { usd: UsdRate | null };
        if (body.usd) {
          set({ usdRate: body.usd });
          // Charges waiting for a rate can be logged now.
          await get().runAutoLog();
        }
      } catch (e) {
        console.error(e);
      }
    },
    deleteTransaction: (id) => {
      const prev = get().transactions.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ transactions: s.transactions.filter((x) => x.id !== id) }));
      ok(t("toast.deleted", { name: prev.title || TYPE_META[prev.type].label }), { label: UNDO(), run: () => void insertTransaction(prev) });
      void save(del("transactions", id), () =>
        set((s) => ({ transactions: [...s.transactions, prev] })),
      );
    },

    addSubscription: (sub) => {
      const full: Subscription = { ...sub, id: crypto.randomUUID() };
      void insertSubscription(full).then((done) => {
        if (done) void get().runAutoLog();
      });
      ok(t("toast.subAdded", { name: full.name }));
      return full.id;
    },
    updateSubscription: (id, patch) => {
      const prev = get().subscriptions.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      ok(
        patch.paused === true
          ? t("toast.subPaused", { name: prev.name })
          : patch.paused === false
            ? t("toast.subResumed", { name: prev.name })
            : t("toast.saved"),
      );
      void save(upd("subscriptions", toRow.subscription(patch), id), () =>
        set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === id ? prev : x)) })),
      ).then((done) => {
        // Resuming, turning auto-log on or moving the start date can make charges due now.
        if (done) void get().runAutoLog();
      });
    },
    deleteSubscription: (id) => {
      const prev = get().subscriptions.find((x) => x.id === id);
      if (!prev) return;
      const linked = get().transactions.filter((t) => t.subscriptionId === id).map((t) => t.id);
      const relink = (subscriptionId: string | undefined) =>
        set((s) => ({ transactions: s.transactions.map((t) => (linked.includes(t.id) ? { ...t, subscriptionId } : t)) }));
      set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id) }));
      // Mirrors the database: logged expenses stay, unlinked.
      relink(undefined);
      ok(t("toast.subDeleted", { name: prev.name }), {
        label: UNDO(),
        run: () =>
          void insertSubscription(prev).then(async (done) => {
            if (!done || !linked.length) return;
            relink(id);
            await save({ table: "transactions", kind: "update", values: { subscription_id: id }, match: { col: "id", in: linked } }, () => relink(undefined));
          }),
      });
      void save(del("subscriptions", id), () => {
        set((s) => ({ subscriptions: [...s.subscriptions, prev] }));
        relink(id);
      });
    },

    runAutoLog: async () => {
      if (!online() || get().pending > 0) return;
      // The database works out what's due (also run hourly by pg_cron) and returns only new rows.
      const { data, error } = await sb().rpc("run_my_auto_log");
      if (error) {
        console.error(error);
        return;
      }
      const added = (data as TransactionRow[]).map(fromRow.transaction);
      const known = new Set(get().transactions.map((t) => t.id));
      set((s) => ({ transactions: [...s.transactions, ...added.filter((t) => !known.has(t.id))] }));
      // Charges of shared subscriptions come with what friends owe (added by the database).
      const shared = new Set(get().subscriptions.filter((s) => s.splitWith?.length).map((s) => s.id));
      const ids = added.filter((t) => t.subscriptionId && shared.has(t.subscriptionId)).map((t) => t.id);
      if (!ids.length) return;
      const { data: owed, error: owedError } = await sb().from("ious").select("*").in("transaction_id", ids).returns<IouRow[]>();
      if (owedError) return console.error(owedError);
      const have = new Set(get().ious.map((i) => i.id));
      set((s) => ({ ious: [...s.ious, ...owed.map(fromRow.iou).filter((i) => !have.has(i.id))] }));
    },

    addIous: (items) => {
      if (!items.length) return;
      const now = Date.now();
      const rows: Iou[] = items.map((i, n) => ({ ...i, id: crypto.randomUUID(), createdAt: now + n }));
      void insertIous(rows);
      const total = rows.reduce((s, i) => s + i.amount, 0);
      const key = rows[0].direction === "i_owe" ? "toast.iouOwed" : "toast.iouAdded";
      ok(rows.length === 1 ? t(key, { name: rows[0].person, amount: baht(total) }) : t("toast.iousAdded", { count: rows.length, amount: baht(total) }));
    },
    updateIou: (id, patch) => {
      void patchIou(id, patch);
      ok(t("toast.saved"));
    },
    settleIou: (id, accountId, category) => {
      const iou = get().ious.find((x) => x.id === id);
      if (!iou) return;
      const today = todayISO();
      void patchIou(id, { settledOn: today });
      let txId: string | undefined;
      const iOwe = iou.direction === "i_owe";
      if (accountId) {
        const tx: Transaction = {
          id: crypto.randomUUID(),
          type: iOwe ? "out" : "in",
          amount: iou.amount,
          date: today,
          title: t(iOwe ? "ious.paidTitle" : "ious.repaidTitle", { name: iou.person }),
          note: iou.note || undefined,
          category: iOwe ? (category ?? "other") : "repay",
          accountId,
          createdAt: Date.now(),
        };
        txId = tx.id;
        void insertTransaction(tx);
      }
      ok(t(iOwe ? "toast.iouPaid" : "toast.iouSettled", { name: iou.person, amount: baht(iou.amount) }), {
        label: UNDO(),
        run: () => {
          void patchIou(id, { settledOn: null });
          if (!txId) return;
          const tx = get().transactions.find((x) => x.id === txId);
          set((s) => ({ transactions: s.transactions.filter((x) => x.id !== txId) }));
          if (tx) void save(del("transactions", tx.id), () => set((s) => ({ transactions: [...s.transactions, tx] })));
        },
      });
    },
    deleteIou: (id) => {
      const prev = get().ious.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ ious: s.ious.filter((x) => x.id !== id) }));
      ok(t("toast.deleted", { name: prev.person }), { label: UNDO(), run: () => void insertIous([prev]) });
      void save(del("ious", id), () => set((s) => ({ ious: [...s.ious, prev] })));
    },

    addSavingsGoal: (g) => {
      const goal: SavingsGoal = { ...g, id: crypto.randomUUID() };
      void insertSavingsGoal(goal);
      ok(t("toast.savingsAdded", { name: goal.name }));
      return goal.id;
    },
    updateSavingsGoal: (id, patch) => {
      patchSavingsGoal(id, patch);
      ok(t("toast.saved"));
    },
    addWish: (input) => {
      const wish: Wish = { ...input, id: crypto.randomUUID(), status: "waiting", decidedOn: null, transactionId: null, createdAt: Date.now() };
      set((s) => ({ wishes: [...s.wishes, wish] }));
      ok(t("toast.wishAdded", { name: wish.name, date: shortDate(wish.decideOn) }));
      void save(ins("wishes", toRow.wish(wish)), () => set((s) => ({ wishes: s.wishes.filter((x) => x.id !== wish.id) })));
    },
    decideWish: (id, status, accountId) => {
      const prev = get().wishes.find((x) => x.id === id);
      if (!prev) return;
      const today = todayISO();
      let transactionId: string | null = null;
      let saved: Promise<boolean> = Promise.resolve(true);
      if (status === "bought" && accountId) {
        const tx: Transaction = { id: crypto.randomUUID(), type: "out", amount: prev.price, date: today, title: prev.name, note: prev.name, category: "shop", accountId, createdAt: Date.now() };
        transactionId = tx.id;
        saved = insertTransaction(tx);
      }
      const patch = { status, decidedOn: today, transactionId };
      set((s) => ({ wishes: s.wishes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      const back = () => set((s) => ({ wishes: s.wishes.map((x) => (x.id === id ? prev : x)) }));
      const undo = () => {
        back();
        void save(upd("wishes", toRow.wish({ status: "waiting", decidedOn: null, transactionId: null }), id), () => {});
        if (transactionId) {
          const txId = transactionId;
          set((s) => ({ transactions: s.transactions.filter((x) => x.id !== txId) }));
          void save(del("transactions", txId), () => {});
        }
      };
      ok(t(status === "bought" ? "toast.wishBought" : "toast.wishSkipped", { name: prev.name, amount: baht(prev.price) }), { label: UNDO(), run: undo });
      // The wish points at the new expense, so that row has to exist first.
      void saved.then((done) => {
        if (done) void save(upd("wishes", toRow.wish(patch), id), back);
        else back();
      });
    },
    reopenWish: (id) => {
      const prev = get().wishes.find((x) => x.id === id);
      if (!prev) return;
      const patch = { status: "waiting" as const, decidedOn: null, transactionId: null };
      set((s) => ({ wishes: s.wishes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      ok(t("toast.wishReopened", { name: prev.name }));
      void save(upd("wishes", toRow.wish(patch), id), () => set((s) => ({ wishes: s.wishes.map((x) => (x.id === id ? prev : x)) })));
    },
    deleteWish: (id) => {
      const prev = get().wishes.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ wishes: s.wishes.filter((x) => x.id !== id) }));
      const restore = () => {
        set((s) => ({ wishes: [...s.wishes, prev] }));
        void save(ins("wishes", toRow.wish(prev)), () => set((s) => ({ wishes: s.wishes.filter((x) => x.id !== prev.id) })));
      };
      ok(t("toast.deleted", { name: prev.name }), { label: UNDO(), run: restore });
      void save(del("wishes", id), () => set((s) => ({ wishes: [...s.wishes, prev] })));
    },
    deleteSavingsGoal: (id) => {
      const prev = get().savingsGoals.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ savingsGoals: s.savingsGoals.filter((x) => x.id !== id) }));
      ok(t("toast.deleted", { name: prev.name }), { label: UNDO(), run: () => void insertSavingsGoal(prev) });
      void save(del("savings_goals", id), () => set((s) => ({ savingsGoals: [...s.savingsGoals, prev] })));
    },
    addToSavings: (id, amount) => {
      const goal = get().savingsGoals.find((x) => x.id === id);
      if (!goal || !amount) return;
      const before = goal.saved;
      const saved = Math.max(0, Math.round((before + amount) * 100) / 100);
      patchSavingsGoal(id, { saved });
      ok(amount > 0 ? t("toast.savingsIn", { name: goal.name, amount: baht(amount) }) : t("toast.savingsOut", { name: goal.name, amount: baht(-amount) }), {
        label: UNDO(),
        run: () => patchSavingsGoal(id, { saved: before }),
      });
    },

    sendFeedback: async (message, page) => {
      const { error } = await sb()
        .from("feedback")
        .insert({
          message: message.trim().slice(0, 2000),
          app_version: `${process.env.NEXT_PUBLIC_APP_VERSION} (${process.env.NEXT_PUBLIC_APP_COMMIT})`.slice(0, 40),
          page: page.slice(0, 200),
          user_agent: navigator.userAgent.slice(0, 300),
        });
      if (error) {
        console.error(error);
        get().notify(t(error.hint === "feedback_limit" ? "feedback.limit" : error.hint === "row_limit" ? "toast.rowLimit" : "feedback.failed"), { tone: "error" });
        return false;
      }
      ok(t("feedback.sent"));
      return true;
    },

    setGoals: (goals) => {
      const prev = get().goals;
      set({ goals });
      ok(t("toast.goalsSaved"));
      void save(ups("goals", { user_id: get().userId, ...toRow.goals(goals) } as Row), () => set({ goals: prev }));
    },
    setSettings: (p) => {
      const prev = get().settings;
      set({ settings: { ...prev, ...p } });
      // Send only what changed (undefined = remove the key): another device's
      // older copy of the other settings must not overwrite them.
      const patch = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === undefined ? null : v]));
      const before = Object.fromEntries(Object.keys(p).map((k) => [k, prev[k as keyof Settings]]));
      void save({ kind: "rpc", fn: "merge_settings", args: { patch } }, () => set((s) => ({ settings: { ...s.settings, ...before } })));
    },
    updateProfile: ({ name, avatar }) => {
      const { user, userId, settings } = get();
      if (!user || !userId) return;
      if (name !== user.name) {
        set({ user: { ...user, name } });
        void save(upd("profiles", { name }, userId), () => set((s) => ({ user: s.user && { ...s.user, name: user.name } })));
      }
      if (avatar !== settings.avatar) get().setSettings({ avatar });
      ok(t("toast.profileSaved"));
    },
    markNoSpend: (day) => {
      const list = get().settings.noSpend ?? [];
      if (list.some((x) => x.d === day)) return;
      const today = todayISO();
      get().setSettings({ noSpend: [...list, { d: day, at: today }] });
      ok(t(day === today ? "streak.noSpendSaved" : "streak.restoredToast"));
    },
    setLanguage: (lang) => {
      applyLang(lang);
      if (get().userId) get().setSettings({ lang });
    },
    acceptTerms: () =>
      get().setSettings({
        termsAcceptedVersion: TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString(),
        // First-time users (onboarding accepts the terms) have nothing "new" to catch up on.
        ...(get().accounts.length === 0 ? { lastSeenVersion: process.env.NEXT_PUBLIC_APP_VERSION } : {}),
      }),
    markNotificationRead: (id) => {
      const ids = get().settings.notifReadIds ?? [];
      if (ids.includes(id)) return;
      // Keep the list short; anything older is covered by notifReadBefore eventually.
      get().setSettings({ notifReadIds: [...ids, id].slice(-200) });
    },
    markAllNotificationsRead: () => get().setSettings({ notifReadBefore: Date.now(), notifReadIds: [] }),
  };
});

// Keep the latest data on this device so the app opens offline.
let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
if (typeof window !== "undefined") {
  useStore.subscribe((state, prev) => {
    if (state.status !== "ready" || !state.userId) return;
    const changed = (Object.keys(toSnapshot(state)) as (keyof Snapshot)[]).some((k) => state[k] !== prev[k]);
    if (!changed && prev.status === "ready") return;
    clearTimeout(snapshotTimer);
    const userId = state.userId;
    snapshotTimer = setTimeout(() => {
      const now = useStore.getState();
      if (now.userId === userId && now.status === "ready") snapshot<Snapshot>(userId).save(toSnapshot(now));
    }, 800);
  });
}

// Show the user's current month again when their month's start day changes (also once their settings load).
let lastStartDay = 1;
useStore.subscribe((s) => {
  const day = cycleStartDay(s.settings);
  if (day === lastStartDay) return;
  lastStartDay = day;
  useStore.setState({ viewMonth: periodOf(todayISO(), day).key });
});

/** First day of the user's month (settings.cycleStartDay, 1 when unset). */
export const useStartDay = () => useStore((s) => cycleStartDay(s.settings));

/** The month on screen (viewMonth) as the user's period. */
export function useViewPeriod(): Period {
  const key = useStore((s) => s.viewMonth);
  const day = useStartDay();
  return useMemo(() => periodFor(key, day), [key, day]);
}

// Keep the user's own category names resolvable everywhere (lib/constants.ts).
let lastCustom: Settings["customCategories"];
useStore.subscribe((s) => {
  if (s.settings.customCategories === lastCustom) return;
  lastCustom = s.settings.customCategories;
  registerCustomCategories(lastCustom);
});
