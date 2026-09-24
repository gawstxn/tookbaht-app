"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { dueDatesUntil, todayISO, uid } from "./format";
import { seedData } from "./seed";
import type { Account, Goals, Settings, Subscription, Transaction, User } from "./types";

const EMPTY_GOALS: Goals = { incomeTarget: 0, expenseBudget: 0, categoryBudgets: {}, alertAt80: true };

interface State {
  user: User | null;
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  goals: Goals;
  settings: Settings;
  /** Selected month on overview/list screens, "YYYY-MM". */
  viewMonth: string;
}

interface Actions {
  signIn: (user: User) => void;
  signOut: () => void;
  deleteAccount: () => void;
  setViewMonth: (key: string) => void;

  addTransaction: (t: Omit<Transaction, "id" | "createdAt">) => void;
  deleteTransaction: (id: string) => void;

  addSubscription: (s: Omit<Subscription, "id">) => string;
  updateSubscription: (id: string, patch: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  /** Log due subscription charges as expenses (idempotent). */
  runAutoLog: () => void;

  setGoals: (g: Goals) => void;
  setSettings: (s: Partial<Settings>) => void;
}

const initial: State = {
  user: null,
  accounts: [],
  transactions: [],
  subscriptions: [],
  goals: EMPTY_GOALS,
  settings: { faceLock: false },
  viewMonth: todayISO().slice(0, 7),
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      signIn: (user) => {
        // First sign-in on this device gets demo data so the app is explorable.
        const hasData = get().accounts.length > 0;
        set({ user, ...(hasData ? {} : seedData()), viewMonth: todayISO().slice(0, 7) });
        get().runAutoLog();
      },
      // Data stays on the device; signing back in picks it up again.
      signOut: () => set({ user: null }),
      deleteAccount: () => set({ ...initial, viewMonth: todayISO().slice(0, 7) }),
      setViewMonth: (viewMonth) => set({ viewMonth }),

      addTransaction: (t) =>
        set((s) => ({ transactions: [...s.transactions, { ...t, id: uid(), createdAt: Date.now() }] })),
      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addSubscription: (sub) => {
        const id = uid();
        set((s) => ({ subscriptions: [...s.subscriptions, { ...sub, id }] }));
        get().runAutoLog();
        return id;
      },
      updateSubscription: (id, patch) =>
        set((s) => ({ subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSubscription: (id) => set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id) })),

      runAutoLog: () => {
        const today = todayISO();
        const { subscriptions, transactions } = get();
        const logged = new Set(
          transactions.filter((t) => t.subscriptionId).map((t) => `${t.subscriptionId}|${t.date}`),
        );
        const added: Transaction[] = [];
        for (const s of subscriptions) {
          if (!s.autoLog || s.paused) continue;
          for (const date of dueDatesUntil(s.startDate, s.cycle, today)) {
            if (logged.has(`${s.id}|${date}`)) continue;
            added.push({
              id: uid(),
              type: "out",
              amount: s.amount,
              date,
              title: s.name,
              category: "sub",
              accountId: s.accountId,
              subscriptionId: s.id,
              createdAt: Date.now(),
            });
          }
        }
        if (added.length) set({ transactions: [...transactions, ...added] });
      },

      setGoals: (goals) => set({ goals }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
    }),
    {
      name: "tookbaht-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        user: s.user,
        accounts: s.accounts,
        transactions: s.transactions,
        subscriptions: s.subscriptions,
        goals: s.goals,
        settings: s.settings,
      }),
    },
  ),
);
