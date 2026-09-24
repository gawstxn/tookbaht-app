import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Goals, Settings, Subscription, Transaction, User } from "./types";

/* Row shapes as stored in Postgres (snake_case). Numeric columns may arrive as strings. */

type Num = number | string;

interface AccountRow {
  id: string;
  name: string;
  kind: Account["kind"];
  opening_balance: Num;
  mono: string;
  tone: string;
}
export interface TransactionRow {
  id: string;
  type: Transaction["type"];
  amount: Num;
  date: string;
  title: string;
  note: string | null;
  category: string | null;
  account_id: string | null;
  from_id: string | null;
  to_id: string | null;
  subscription_id: string | null;
  created_at: string;
}
interface SubscriptionRow {
  id: string;
  name: string;
  amount: Num;
  cycle: Subscription["cycle"];
  start_date: string;
  account_id: string;
  category: string;
  remind: boolean;
  auto_log: boolean;
  paused: boolean;
  tone: string;
}
interface GoalsRow {
  income_target: Num;
  expense_budget: Num;
  category_budgets: Record<string, Num>;
  alert_at_80: boolean;
}
interface ProfileRow {
  name: string;
  email: string;
  settings: Partial<Settings> | null;
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export const fromRow = {
  account: (r: AccountRow): Account => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    openingBalance: Number(r.opening_balance),
    mono: r.mono,
    tone: r.tone,
  }),
  transaction: (r: TransactionRow): Transaction => ({
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    date: r.date,
    title: r.title,
    note: opt(r.note),
    category: opt(r.category),
    accountId: opt(r.account_id),
    fromId: opt(r.from_id),
    toId: opt(r.to_id),
    subscriptionId: opt(r.subscription_id),
    createdAt: Date.parse(r.created_at),
  }),
  subscription: (r: SubscriptionRow): Subscription => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    cycle: r.cycle,
    startDate: r.start_date,
    accountId: r.account_id,
    category: r.category,
    remind: r.remind,
    autoLog: r.auto_log,
    paused: r.paused,
    tone: r.tone,
  }),
  goals: (r: GoalsRow): Goals => ({
    incomeTarget: Number(r.income_target),
    expenseBudget: Number(r.expense_budget),
    categoryBudgets: Object.fromEntries(Object.entries(r.category_budgets ?? {}).map(([k, v]) => [k, Number(v)])),
    alertAt80: r.alert_at_80,
  }),
};

export const toRow = {
  account: (a: Partial<Account>) =>
    strip({
      id: a.id,
      name: a.name,
      kind: a.kind,
      opening_balance: a.openingBalance,
      mono: a.mono,
      tone: a.tone,
    }),
  transaction: (t: Partial<Transaction>) =>
    strip({
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.date,
      title: t.title,
      note: t.note || null,
      category: t.type === "move" ? null : (t.category ?? null),
      account_id: t.accountId ?? null,
      from_id: t.fromId ?? null,
      to_id: t.toId ?? null,
      subscription_id: t.subscriptionId ?? null,
      created_at: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
    }),
  subscription: (s: Partial<Subscription>) =>
    strip({
      id: s.id,
      name: s.name,
      amount: s.amount,
      cycle: s.cycle,
      start_date: s.startDate,
      account_id: s.accountId,
      category: s.category,
      remind: s.remind,
      auto_log: s.autoLog,
      paused: s.paused,
      tone: s.tone,
    }),
  goals: (g: Goals) => ({
    income_target: g.incomeTarget,
    expense_budget: g.expenseBudget,
    category_budgets: g.categoryBudgets,
    alert_at_80: g.alertAt80,
    updated_at: new Date().toISOString(),
  }),
};

/** Drop undefined keys so partial updates only touch the fields given. */
function strip<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const PAGE = 1000;

/** Everything the app shows for the signed-in user. */
export async function fetchAll(sb: SupabaseClient, userId: string) {
  const [profile, accounts, subscriptions, goals, transactions] = await Promise.all([
    sb.from("profiles").select("name, email, settings").eq("id", userId).single<ProfileRow>(),
    sb.from("accounts").select("*").order("sort_order").order("created_at").returns<AccountRow[]>(),
    sb.from("subscriptions").select("*").order("created_at").returns<SubscriptionRow[]>(),
    sb.from("goals").select("*").eq("user_id", userId).maybeSingle<GoalsRow>(),
    fetchTransactions(sb),
  ]);
  for (const r of [profile, accounts, subscriptions, goals]) if (r.error) throw r.error;

  const user: User = { name: profile.data!.name, email: profile.data!.email };
  return {
    user,
    settings: { faceLock: false, ...profile.data!.settings },
    accounts: accounts.data!.map(fromRow.account),
    subscriptions: subscriptions.data!.map(fromRow.subscription),
    goals: goals.data ? fromRow.goals(goals.data) : null,
    transactions,
  };
}

/** Transactions page by page (the API caps each response at 1,000 rows). */
async function fetchTransactions(sb: SupabaseClient): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("transactions")
      .select("*")
      .order("date")
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<TransactionRow[]>();
    if (error) throw error;
    out.push(...data.map(fromRow.transaction));
    if (data.length < PAGE) return out;
  }
}
