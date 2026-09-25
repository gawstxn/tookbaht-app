import { budgetLines } from "./budget";
import { baht, addDays, fromISO, monthKey, nextDueDate, toISO } from "./format";
import { daysLeftInMonth, monthTransactions, summarize } from "./selectors";
import type { Account, Goals, Settings, Subscription, Transaction } from "./types";

export type NotifKind = "due" | "over" | "near" | "autolog" | "income" | "weekly";

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
function crossedAt(txs: Transaction[], limit: number, pick: (t: Transaction) => number): number | null {
  let sum = 0;
  for (const t of [...txs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    sum += pick(t);
    if (sum > limit) return Math.max(t.createdAt, at(t.date, 0));
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
}): AppNotification[] {
  const { accounts, transactions, subscriptions, goals, today, now } = input;
  const accName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "";
  const out: AppNotification[] = [];

  // Charges due today or tomorrow (announced 09:00 the day before).
  for (const s of subscriptions) {
    if (s.paused) continue;
    const due = nextDueDate(s.startDate, s.cycle, today);
    if (due > addDays(today, 1)) continue;
    out.push({
      id: `due:${s.id}:${due}`,
      kind: "due",
      at: Math.min(now, at(addDays(due, -1), 9)),
      title: due === today ? `วันนี้ตัดบัญชี ${s.name}` : `พรุ่งนี้ตัดบัญชี ${s.name}`,
      body: `${baht(s.amount)} จาก${accName(s.accountId)}`,
      href: `/subscriptions/${s.id}`,
    });
  }

  // Budget alerts for this month, timed at the transaction that crossed the line.
  const month = monthKey(today);
  const monthTxs = monthTransactions(transactions, month);
  const { cats, total } = budgetLines(goals, monthTxs);
  const daysLeft = daysLeftInMonth(month, today);
  for (const line of [...(total ? [total] : []), ...cats]) {
    const pick = (t: Transaction) => (t.type === "out" && (line.key === "total" || t.category === line.key) ? t.amount : 0);
    const overAt = crossedAt(monthTxs, line.budget, pick);
    if (overAt) {
      out.push({
        id: `over:${line.key}:${month}`,
        kind: "over",
        at: overAt,
        title: line.key === "total" ? "เกินงบรวมแล้ว" : `งบ${line.label}เกินแล้ว`,
        body: `ใช้ไป ${baht(line.spent)} จากงบ ${baht(line.budget)}`,
        href: "/goals",
      });
    }
    const nearAt = goals.alertAt80 ? crossedAt(monthTxs, line.budget * 0.8, pick) : null;
    if (nearAt && (!overAt || nearAt < overAt)) {
      out.push({
        id: `near:${line.key}:${month}`,
        kind: "near",
        at: nearAt,
        title: `${line.label}ใช้ไป ${Math.min(99, Math.round(line.pct * 100))}% ของงบ`,
        body: line.spent <= line.budget ? `เหลือ ${baht(line.budget - line.spent)}${daysLeft ? ` อีก ${daysLeft} วัน` : ""}` : "ใช้เกิน 80% แล้ว",
        href: "/goals",
      });
    }
  }

  // Income goal: close (90%) or reached.
  if (goals.incomeTarget > 0) {
    const income = summarize(monthTxs).income;
    const pickIn = (t: Transaction) => (t.type === "in" ? t.amount : 0);
    const reachedAt = crossedAt(monthTxs, goals.incomeTarget - 0.005, pickIn);
    const closeAt = crossedAt(monthTxs, goals.incomeTarget * 0.9, pickIn);
    const when = reachedAt ?? closeAt;
    if (when) {
      out.push({
        id: `income:${reachedAt ? "reached" : "close"}:${month}`,
        kind: "income",
        at: when,
        title: reachedAt ? "รายรับถึงเป้าแล้ว" : "รายรับใกล้ถึงเป้าแล้ว",
        body: `${baht(income)} จากเป้า ${baht(goals.incomeTarget)}`,
        href: "/goals",
      });
    }
  }

  // Charges the database logged automatically.
  for (const t of transactions) {
    if (!t.subscriptionId || now - t.createdAt > 30 * DAY) continue;
    out.push({
      id: `autolog:${t.id}`,
      kind: "autolog",
      at: t.createdAt,
      title: `บันทึก ${t.title} อัตโนมัติแล้ว`,
      body: `−${baht(t.amount)} จาก${accName(t.accountId)}`,
      href: "/transactions",
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
      title: "สรุปสัปดาห์ที่ผ่านมา",
      body: `ใช้จ่ายไป ${baht(spent)} · ดูรายการทั้งหมด`,
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
