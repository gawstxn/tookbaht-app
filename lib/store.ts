"use client";

import { create } from "zustand";
import { TYPE_META } from "./constants";
import { fetchAll, fromRow, toRow, type TransactionRow } from "./db";
import { applyLang, currentLang, t, type Lang } from "./i18n";
import { TERMS_VERSION } from "./legal";
import { baht, toISO, todayISO } from "./format";
import { impliedFeePct, type UsdRate } from "./fx";
import { getSupabase } from "./supabase/client";
import type { Account, Goals, Settings, Subscription, Transaction, User } from "./types";

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
}

interface Actions {
  /** Fetch everything for the signed-in user. */
  load: (userId: string) => Promise<void>;
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

  addTransaction: (t: Omit<Transaction, "id" | "createdAt">) => void;
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

  setGoals: (g: Goals) => void;
  setSettings: (s: Partial<Settings>) => void;
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
  goals: EMPTY_GOALS,
  settings: { faceLock: false },
  viewMonth: todayISO().slice(0, 7),
  toast: null,
  usdRate: null,
  deletionRequestedAt: null,
};

const SAVE_FAILED = () => t("toast.saveFailed");
const UNDO = () => t("common.undo");
let toastSeq = 0;

export const useStore = create<State & Actions>()((set, get) => {
  const sb = () => getSupabase();
  const ok = (text: string, action?: Toast["action"]) => get().notify(text, { action });

  /** Run a write; on failure undo the optimistic change and show an error toast. */
  const save = async (write: PromiseLike<{ error: unknown }>, undo: () => void, message = SAVE_FAILED()) => {
    const { error } = await write;
    if (error) {
      console.error(error);
      undo();
      get().notify(message, { tone: "error" });
      return false;
    }
    return true;
  };

  const insertTransaction = (tx: Transaction) => {
    set((s) => ({ transactions: [...s.transactions, tx] }));
    return save(sb().from("transactions").insert(toRow.transaction(tx)), () =>
      set((s) => ({ transactions: s.transactions.filter((x) => x.id !== tx.id) })),
    );
  };
  const insertAccount = (account: Account, sortOrder: number) => {
    set((s) => ({ accounts: [...s.accounts, account] }));
    return save(sb().from("accounts").insert({ ...toRow.account(account), sort_order: sortOrder }), () =>
      set((s) => ({ accounts: s.accounts.filter((x) => x.id !== account.id) })),
    );
  };
  const insertSubscription = (sub: Subscription) => {
    set((s) => ({ subscriptions: [...s.subscriptions, sub] }));
    return save(sb().from("subscriptions").insert(toRow.subscription(sub)), () =>
      set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== sub.id) })),
    );
  };

  return {
    ...initial,

    load: async (userId) => {
      set({ status: "loading", userId });
      try {
        const data = await fetchAll(sb(), userId);
        if (get().userId !== userId) return;
        set({ ...data, goals: data.goals ?? EMPTY_GOALS, status: "ready" });
        // The profile's language wins; if it has none yet, store the one in use.
        if (data.settings.lang) applyLang(data.settings.lang);
        else get().setSettings({ lang: currentLang() });
        await get().runAutoLog();
        if (data.subscriptions.some((s) => s.currency === "USD")) void get().ensureUsdRate();
      } catch (e) {
        console.error(e);
        if (get().userId === userId) set({ status: "error" });
      }
    },
    reset: () => set({ ...initial, viewMonth: todayISO().slice(0, 7) }),
    signOut: async () => {
      await sb().auth.signOut();
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
      void save(sb().from("accounts").update(toRow.account(patch)).eq("id", id), () =>
        set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? prev : x)) })),
      );
    },
    removeAccount: async (id) => {
      const prev = get().accounts;
      const index = prev.findIndex((x) => x.id === id);
      const account = prev[index];
      if (!account) return false;
      // Not optimistic: a refused delete (still in use) must not make the account vanish and reappear.
      const done = await save(sb().from("accounts").delete().eq("id", id), () => {}, t("toast.accountInUse"));
      if (done) set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }));
      if (done) ok(t("toast.accountDeleted", { name: account.name }), { label: UNDO(), run: () => void insertAccount(account, index) });
      return done;
    },

    addTransaction: (input) => {
      const tx: Transaction = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
      void insertTransaction(tx);
      ok(t("toast.txSaved", { type: tx.type === "move" ? t("type.moveLong") : TYPE_META[tx.type].label, amount: baht(tx.amount) }));
    },
    updateTransaction: (id, patch) => {
      const prev = get().transactions.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ transactions: s.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      ok(t("toast.saved"));
      void save(sb().from("transactions").update(toRow.transaction({ ...prev, ...patch })).eq("id", id), () =>
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
      void save(sb().from("transactions").delete().eq("id", id), () =>
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
      void save(sb().from("subscriptions").update(toRow.subscription(patch)).eq("id", id), () =>
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
            await save(sb().from("transactions").update({ subscription_id: id }).in("id", linked), () => relink(undefined));
          }),
      });
      void save(sb().from("subscriptions").delete().eq("id", id), () => {
        set((s) => ({ subscriptions: [...s.subscriptions, prev] }));
        relink(id);
      });
    },

    runAutoLog: async () => {
      // The database works out what's due (also run hourly by pg_cron) and returns only new rows.
      const { data, error } = await sb().rpc("run_my_auto_log");
      if (error) {
        console.error(error);
        return;
      }
      const added = (data as TransactionRow[]).map(fromRow.transaction);
      const known = new Set(get().transactions.map((t) => t.id));
      set((s) => ({ transactions: [...s.transactions, ...added.filter((t) => !known.has(t.id))] }));
    },

    setGoals: (goals) => {
      const prev = get().goals;
      set({ goals });
      ok(t("toast.goalsSaved"));
      void save(sb().from("goals").upsert({ user_id: get().userId, ...toRow.goals(goals) }), () => set({ goals: prev }));
    },
    setSettings: (p) => {
      const prev = get().settings;
      const settings = { ...prev, ...p };
      set({ settings });
      void save(sb().from("profiles").update({ settings }).eq("id", get().userId), () => set({ settings: prev }));
    },
    setLanguage: (lang) => {
      applyLang(lang);
      if (get().userId) get().setSettings({ lang });
    },
    acceptTerms: () => get().setSettings({ termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() }),
    markNotificationRead: (id) => {
      const ids = get().settings.notifReadIds ?? [];
      if (ids.includes(id)) return;
      // Keep the list short; anything older is covered by notifReadBefore eventually.
      get().setSettings({ notifReadIds: [...ids, id].slice(-200) });
    },
    markAllNotificationsRead: () => get().setSettings({ notifReadBefore: Date.now(), notifReadIds: [] }),
  };
});
