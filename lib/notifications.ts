import { budgetLines, rolloverCarry, withCarry } from "./budget";
import { baht, addDays, fromISO, monthLabel, relativeDue, toISO } from "./format";
import { periodOf, shiftPeriod } from "./period";
import { formatForeign } from "./currencies";
import { formatMoney } from "./fx";
import { t } from "./i18n";
import { REPAY_CATEGORY, accountDue, daysLeftInMonth, monthTransactions, nextCharge, summarize } from "./selectors";
import type { Account, Goals, Settings, Subscription, Transaction, Wish } from "./types";

export type NotifKind = "due" | "over" | "near" | "autolog" | "income" | "weekly" | "summary" | "price" | "wish";

export interface AppNotification {
  id: string;
  kind: NotifKind;
  /** When it happened (ms). */
  at: number;
  title: string;
  body: string;
  href: string;
}

const DAY = 86_400_000;
const at = (date: string, h: number, m = 0) => {
  const d = fromISO(date);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/** When a running total first went past `limit`, i.e. the transaction that crossed it. */
function crossedAt(txs: Transaction[], limit: number, pick: (tx: Transaction) => number): number | null {
  let sum = 0;
  for (const tx of [...txs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    sum += pick(tx);
    if (sum > limit) return Math.max(tx.createdAt, at(tx.date, 0));
  }
  return null;
}

/**
 * In-app notifications, derived from the user's data (nothing is stored
 * except which ones were read): upcoming charges, budget alerts, auto-logged
 * charges, income goal progress and a weekly summary. Newest first, last 30 days.
 */
export function buildNotifications(input: {
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  goals: Goals;
  today: string;
  now: number;
  wishes?: Wish[];
  /** First day of the user's month (settings.cycleStartDay). */
  startDay?: number;
}): AppNotification[] {
  const { accounts, transactions, subscriptions, goals, today, now, wishes = [], startDay = 1 } = input;
  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "";
  const out: AppNotification[] = [];

  // Charges due today or tomorrow (announced 09:00 the day before).
  for (const s of subscriptions) {
    // Money coming in isn't a charge to prepare for.
    if (s.paused || s.entryType === "in") continue;
    const next = nextCharge(s, today);
    if (!next || next.due > addDays(today, 1)) continue;
    const due = next.due;
    out.push({
      id: `due:${s.id}:${due}`,
      kind: "due",
      at: Math.min(now, at(addDays(due, -1), 9)),
      title: t(due === today ? "notif.dueToday" : "notif.dueTomorrow", { name: s.name }),
      body: t("notif.fromAccount", { amount: formatMoney(s.amount, s.currency), account: accName(s.accountId) }),
      href: `/subscriptions/${s.id}`,
    });
  }

  // Card / pay-later payments due within 3 days (announced 09:00, three days before).
  for (const a of accounts) {
    const d = accountDue(a, transactions, today, subscriptions);
    if (!d || d.owed <= 0 || d.days > 3) continue;
    out.push({
      id: `pay:${a.id}:${d.due}`,
      kind: "due",
      at: Math.min(now, at(addDays(d.due, -3), 9)),
      title: t("notif.payDue", { name: a.name, rel: relativeDue(d.days) }),
      body: t("notif.payDueBody", { amount: baht(d.owed) }),
      href: "/accounts",
    });
  }

  // Budget alerts for this month, timed at the transaction that crossed the line.
  const period = periodOf(today, startDay);
  const month = period.key;
  const monthTxs = monthTransactions(transactions, period);
  const { cats, total } = budgetLines(withCarry(goals, rolloverCarry(goals, transactions, period)), monthTxs);
  const daysLeft = daysLeftInMonth(period, today);
  for (const line of [...(total ? [total] : []), ...cats]) {
    const pick = (t: Transaction) => (t.type === "out" && (line.key === "total" || t.category === line.key) ? t.amount : 0);
    const overAt = crossedAt(monthTxs, line.budget, pick);
    if (overAt) {
      out.push({
        id: `over:${line.key}:${month}`,
        kind: "over",
        at: overAt,
        title: line.key === "total" ? t("banner.totalOver") : t("banner.oneOver", { label: line.label }),
        body: t("notif.usedOf", { spent: baht(line.spent), budget: baht(line.budget) }),
        href: "/goals",
      });
    }
    const nearAt = goals.alertAt80 ? crossedAt(monthTxs, line.budget * 0.8, pick) : null;
    if (nearAt && (!overAt || nearAt < overAt)) {
      out.push({
        id: `near:${line.key}:${month}`,
        kind: "near",
        at: nearAt,
        title: t("banner.oneNear", { label: line.label, pct: `${Math.min(99, Math.round(line.pct * 100))}%` }),
        body:
          line.spent <= line.budget
            ? t("banner.leftFor", { amount: baht(line.budget - line.spent) }) + (daysLeft ? t("banner.daysMore", { count: daysLeft }) : "")
            : t("notif.over80"),
        href: "/goals",
      });
    }
  }

  // Income goal: close (90%) or reached.
  if (goals.incomeTarget > 0) {
    const income = summarize(monthTxs).income;
    const pickIn = (t: Transaction) => (t.type === "in" && t.category !== REPAY_CATEGORY ? t.amount : 0);
    const reachedAt = crossedAt(monthTxs, goals.incomeTarget - 0.005, pickIn);
    const closeAt = crossedAt(monthTxs, goals.incomeTarget * 0.9, pickIn);
    const when = reachedAt ?? closeAt;
    if (when) {
      out.push({
        id: `income:${reachedAt ? "reached" : "close"}:${month}`,
        kind: "income",
        at: when,
        title: t(reachedAt ? "notif.incomeReached" : "notif.incomeClose"),
        body: t("notif.incomeOf", { income: baht(income), target: baht(goals.incomeTarget) }),
        href: "/goals",
      });
    }
  }

  // Charges the database logged automatically.
  for (const tx of transactions) {
    if (!tx.subscriptionId || now - tx.createdAt > 30 * DAY) continue;
    out.push({
      id: `autolog:${tx.id}`,
      kind: "autolog",
      at: tx.createdAt,
      title: t("notif.autoLogged", { name: tx.title }),
      body: t("notif.fromAccount", { amount: `−${baht(tx.amount)}`, account: accName(tx.accountId) }),
      href: "/transactions",
    });
  }

  // A service that charged more than last time. Dollar prices compare in dollars,
  // so exchange-rate swings don't count as a price rise.
  for (const s of subscriptions) {
    const logged = transactions.filter((tx) => tx.subscriptionId === s.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    if (logged.length < 2) continue;
    const [prev, last] = logged.slice(-2);
    const price = (tx: Transaction) => tx.origAmount ?? tx.amount;
    const currency = last.origCurrency ?? "THB";
    const money = (n: number, c: typeof currency) => (c === "THB" ? baht(n) : formatForeign(n, c));
    if ((prev.origCurrency ?? "THB") !== currency || price(last) < price(prev) * 1.01) continue;
    out.push({
      id: `price:${s.id}:${last.date}`,
      kind: "price",
      at: Math.max(last.createdAt, at(last.date, 0)),
      title: t("notif.priceUp", { name: s.name }),
      body: t("notif.priceUpBody", { from: money(price(prev), currency), to: money(price(last), currency) }),
      href: `/subscriptions/${s.id}`,
    });
  }

  // A wish reached its day to decide (09:00 that day).
  for (const w of wishes) {
    if (w.status !== "waiting" || w.decideOn > today) continue;
    out.push({
      id: `wish:${w.id}:${w.decideOn}`,
      kind: "wish",
      at: at(w.decideOn, 9),
      title: t("notif.wishReady", { name: w.name }),
      body: t("notif.wishReadyBody", { amount: baht(w.price) }),
      href: "/wishlist",
    });
  }

  // Last month's summary on its first day at 08:00 (the same as the push, for anyone without notifications on).
  const lastPeriod = shiftPeriod(period, -1);
  const lastMonth = lastPeriod.key;
  const lastTxs = monthTransactions(transactions, lastPeriod);
  if (lastTxs.length) {
    const sum = summarize(lastTxs);
    const over = budgetLines(withCarry(goals, rolloverCarry(goals, transactions, lastPeriod)), lastTxs);
    const overLabels = [...(over.total && over.total.spent > over.total.budget ? [over.total] : []), ...over.cats.filter((c) => c.spent > c.budget)].map((l) => l.label);
    const body = t(sum.net < 0 ? "notif.summaryShort" : "notif.summaryBody", {
      income: baht(sum.income),
      expense: baht(sum.expense),
      left: baht(Math.abs(sum.net)),
    });
    out.push({
      id: `summary:${lastMonth}`,
      kind: "summary",
      at: at(period.start, 8),
      title: t("notif.summary", { month: monthLabel(lastMonth) }),
      body: overLabels.length ? `${body} · ${t("notif.summaryOver", { list: overLabels.join(", ") })}` : body,
      href: "/insights",
    });
  }

  // Weekly summary every Monday 08:00 for the previous Mon–Sun.
  const d = fromISO(today);
  const monday = addDays(today, -((d.getDay() + 6) % 7));
  for (let w = 0; w < 4; w++) {
    const start = addDays(monday, -7 * (w + 1));
    const end = addDays(start, 6);
    const spent = transactions.filter((t) => t.type === "out" && t.date >= start && t.date <= end).reduce((a, t) => a + t.amount, 0);
    if (!spent) continue;
    out.push({
      id: `weekly:${start}`,
      kind: "weekly",
      at: at(addDays(end, 1), 8),
      title: t("notif.weekly"),
      body: t("notif.weeklyBody", { amount: baht(spent) }),
      href: "/transactions",
    });
  }

  return out.filter((n) => n.at <= now && now - n.at <= 30 * DAY).sort((a, b) => b.at - a.at);
}

export function isUnread(n: AppNotification, settings: Settings) {
  return n.at > (settings.notifReadBefore ?? 0) && !(settings.notifReadIds ?? []).includes(n.id);
}

/** "วันนี้" / "เมื่อวาน" / "ก่อนหน้านี้" bucket for a timestamp. */
export function dayBucket(ms: number, today: string): "today" | "yesterday" | "earlier" {
  const date = toISO(new Date(ms));
  if (date === today) return "today";
  if (date === addDays(today, -1)) return "yesterday";
  return "earlier";
}
