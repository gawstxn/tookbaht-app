"use client";

import { create } from "zustand";
import { fetchAll, fromRow, toRow, type TransactionRow } from "./db";
import { todayISO } from "./format";
import { getSupabase } from "./supabase/client";
import type { Account, Goals, Settings, Subscription, Transaction, User } from "./types";

const EMPTY_GOALS: Goals = { incomeTarget: 0, expenseBudget: 0, categoryBudgets: {}, alertAt80: true };

type Status = "idle" | "loading" | "ready" | "error";

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
  /** Last failed save, shown as a toast. */
  syncError: string | null;
}

interface Actions {
  /** Fetch everything for the signed-in user. */
  load: (userId: string) => Promise<void>;
  /** Clear in-memory data (after sign-out). */
  reset: () => void;
  signOut: () => Promise<void>;
  /** Permanently delete the user and all their data. */
  deleteAccount: () => Promise<boolean>;
  setViewMonth: (key: string) => void;
  dismissError: () => void;

  addAccount: (a: Omit<Account, "id">) => string;
  updateAccount: (id: string, patch: Partial<Omit<Account, "id">>) => void;
  /** Resolves false when the account is still used by transactions or subscriptions. */
  removeAccount: (id: string) => Promise<boolean>;

  addTransaction: (t: Omit<Transaction, "id" | "createdAt">) => void;
  deleteTransaction: (id: string) => void;

  addSubscription: (s: Omit<Subscription, "id">) => string;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  /** Log due subscription charges as expenses (idempotent across devices). */
  runAutoLog: () => Promise<void>;

  setGoals: (g: Goals) => void;
  setSettings: (s: Partial<Settings>) => void;
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
  syncError: null,
};

const SAVE_FAILED = "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง";

export const useStore = create<State & Actions>()((set, get) => {
  const sb = () => getSupabase();

  /** Run a write; on failure undo the optimistic change and show a toast. */
  const save = async (write: PromiseLike<{ error: unknown }>, undo: () => void, message = SAVE_FAILED) => {
    const { error } = await write;
    if (error) {
      console.error(error);
      undo();
      set({ syncError: message });
      return false;
    }
    return true;
  };

  return {
    ...initial,

    load: async (userId) => {
      set({ status: "loading", userId });
      try {
        const data = await fetchAll(sb(), userId);
        if (get().userId !== userId) return;
        set({ ...data, goals: data.goals ?? EMPTY_GOALS, status: "ready" });
        await get().runAutoLog();
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
      const { error } = await sb().rpc("delete_my_account");
      if (error) {
        console.error(error);
        set({ syncError: "ลบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง" });
        return false;
      }
      await sb().auth.signOut({ scope: "local" });
      get().reset();
      return true;
    },
    setViewMonth: (viewMonth) => set({ viewMonth }),
    dismissError: () => set({ syncError: null }),

    addAccount: (a) => {
      const account: Account = { ...a, id: crypto.randomUUID() };
      set((s) => ({ accounts: [...s.accounts, account] }));
      void save(sb().from("accounts").insert({ ...toRow.account(account), sort_order: get().accounts.length }), () =>
        set((s) => ({ accounts: s.accounts.filter((x) => x.id !== account.id) })),
      );
      return account.id;
    },
    updateAccount: (id, patch) => {
      const prev = get().accounts.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      void save(sb().from("accounts").update(toRow.account(patch)).eq("id", id), () =>
        set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? prev : x)) })),
      );
    },
    removeAccount: async (id) => {
      const prev = get().accounts;
      set({ accounts: prev.filter((x) => x.id !== id) });
      return save(
        sb().from("accounts").delete().eq("id", id),
        () => set({ accounts: prev }),
        "ลบไม่ได้ เพราะยังมีรายการหรือ subscription ที่ใช้บัญชีนี้",
      );
    },

    addTransaction: (t) => {
      const tx: Transaction = { ...t, id: crypto.randomUUID(), createdAt: Date.now() };
      set((s) => ({ transactions: [...s.transactions, tx] }));
      void save(sb().from("transactions").insert(toRow.transaction(tx)), () =>
        set((s) => ({ transactions: s.transactions.filter((x) => x.id !== tx.id) })),
      );
    },
    deleteTransaction: (id) => {
      const prev = get().transactions.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ transactions: s.transactions.filter((x) => x.id !== id) }));
      void save(sb().from("transactions").delete().eq("id", id), () =>
        set((s) => ({ transactions: [...s.transactions, prev] })),
      );
    },

    addSubscription: (sub) => {
      const id = crypto.randomUUID();
      set((s) => ({ subscriptions: [...s.subscriptions, { ...sub, id }] }));
      void save(sb().from("subscriptions").insert(toRow.subscription({ ...sub, id })), () =>
        set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id) })),
      ).then((ok) => {
        if (ok) void get().runAutoLog();
      });
      return id;
    },
    updateSubscription: (id, patch) => {
      const prev = get().subscriptions.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      void save(sb().from("subscriptions").update(toRow.subscription(patch)).eq("id", id), () =>
        set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === id ? prev : x)) })),
      ).then((ok) => {
        // Resuming, turning auto-log on or moving the start date can make charges due now.
        if (ok) void get().runAutoLog();
      });
    },
    deleteSubscription: (id) => {
      const prev = get().subscriptions.find((x) => x.id === id);
      if (!prev) return;
      set((s) => ({
        subscriptions: s.subscriptions.filter((x) => x.id !== id),
        // Mirrors the database: logged expenses stay, unlinked.
        transactions: s.transactions.map((t) => (t.subscriptionId === id ? { ...t, subscriptionId: undefined } : t)),
      }));
      void save(sb().from("subscriptions").delete().eq("id", id), () => {
        set((s) => ({ subscriptions: [...s.subscriptions, prev] }));
        void get().load(get().userId!);
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
      void save(sb().from("goals").upsert({ user_id: get().userId, ...toRow.goals(goals) }), () => set({ goals: prev }));
    },
    setSettings: (p) => {
      const prev = get().settings;
      const settings = { ...prev, ...p };
      set({ settings });
      void save(sb().from("profiles").update({ settings }).eq("id", get().userId), () => set({ settings: prev }));
    },
  };
});
