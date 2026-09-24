import { addDays, toISO, todayISO, uid } from "./format";
import type { Account, Goals, Subscription, Transaction } from "./types";

/** Demo data placed relative to today so the app always looks "lived in". */
export function seedData() {
  const today = todayISO();
  const t = new Date();
  const monthStart = toISO(new Date(t.getFullYear(), t.getMonth(), 1));
  const inMonth = (dayOfMonth: number) => {
    const d = toISO(new Date(t.getFullYear(), t.getMonth(), dayOfMonth));
    return d > today ? today : d;
  };

  const accounts: Account[] = [
    { id: "acc-salary", name: "บัญชีเงินเดือน", kind: "bank", openingBalance: 20000, mono: "ง", tone: "#2f5b45" },
    { id: "acc-saving", name: "บัญชีออม", kind: "saving", openingBalance: 102000, mono: "อ", tone: "#33558f" },
    { id: "acc-credit", name: "บัตรเครดิต", kind: "credit", openingBalance: 50000, mono: "ค", tone: "#8a2e22" },
    { id: "acc-cash", name: "เงินสด", kind: "cash", openingBalance: 2000, mono: "ส", tone: "#5f6259" },
  ];

  const tx = (p: Omit<Transaction, "id" | "createdAt">): Transaction => ({ ...p, id: uid(), createdAt: Date.now() });

  const transactions: Transaction[] = [
    tx({ type: "in", amount: 45000, date: monthStart, title: "เงินเดือน", category: "salary", accountId: "acc-salary" }),
    tx({ type: "move", amount: 5000, date: inMonth(2), title: "โอนเข้าบัญชีออม", fromId: "acc-salary", toId: "acc-saving" }),
    tx({ type: "out", amount: 8500, date: inMonth(3), title: "ค่าเช่าห้อง", category: "bill", accountId: "acc-salary" }),
    tx({ type: "out", amount: 1236, date: addDays(today, -2), title: "ค่าไฟฟ้า", category: "bill", accountId: "acc-salary" }),
    tx({ type: "out", amount: 85, date: addDays(today, -2), title: "กาแฟ", category: "food", accountId: "acc-cash" }),
    tx({ type: "in", amount: 3500, date: addDays(today, -1), title: "ค่าออกแบบโลโก้", category: "freelance", accountId: "acc-salary" }),
    tx({ type: "out", amount: 842, date: addDays(today, -1), title: "ซูเปอร์มาร์เก็ต", category: "shop", accountId: "acc-credit" }),
    tx({ type: "out", amount: 65, date: today, title: "ข้าวมันไก่", category: "food", accountId: "acc-cash" }),
    tx({ type: "out", amount: 47, date: today, title: "รถไฟฟ้า", category: "travel", accountId: "acc-salary" }),
    tx({ type: "move", amount: 5000, date: today, title: "โอนเข้าบัญชีออม", fromId: "acc-salary", toId: "acc-saving" }),
  ].map((x) => (x.date < monthStart ? { ...x, date: monthStart } : x));

  const sub = (p: Omit<Subscription, "id">): Subscription => ({ ...p, id: uid() });
  const subscriptions: Subscription[] = [
    sub({ name: "Spotify", amount: 149, cycle: "month", startDate: addDays(today, 4 - 60), accountId: "acc-credit", category: "music", remind: true, autoLog: true, paused: false, tone: "#2f5b45" }),
    sub({ name: "iCloud+", amount: 35, cycle: "month", startDate: addDays(today, 7 - 90), accountId: "acc-credit", category: "cloud", remind: true, autoLog: true, paused: false, tone: "#33558f" }),
    sub({ name: "Netflix", amount: 419, cycle: "month", startDate: addDays(today, 9 - 120), accountId: "acc-credit", category: "fun", remind: true, autoLog: true, paused: false, tone: "#8a2e22" }),
    sub({ name: "YouTube Premium", amount: 179, cycle: "month", startDate: addDays(today, 14 - 60), accountId: "acc-salary", category: "fun", remind: false, autoLog: true, paused: false, tone: "#6e3a1c" }),
    sub({ name: "สมาชิกฟิตเนส", amount: 1290, cycle: "month", startDate: addDays(today, 21 - 180), accountId: "acc-salary", category: "fit", remind: true, autoLog: true, paused: false, tone: "#1c1e1b" }),
    sub({ name: "Google One", amount: 700, cycle: "year", startDate: addDays(today, 110 - 365), accountId: "acc-credit", category: "cloud", remind: true, autoLog: false, paused: false, tone: "#5b4a7a" }),
  ];

  const goals: Goals = {
    incomeTarget: 50000,
    expenseBudget: 30000,
    categoryBudgets: { food: 8000, shop: 5000, bill: 11000, travel: 3000, fun: 2000 },
    alertAt80: true,
  };

  return { accounts, transactions, subscriptions, goals };
}
